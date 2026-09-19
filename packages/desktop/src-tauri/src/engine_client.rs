use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, oneshot};
use tokio::time::sleep;

pub struct EngineProcess {
    pub client: EngineClient,
    #[allow(dead_code)]
    child: Child,
}

pub struct EngineClient {
    write_half: Arc<Mutex<tokio::net::unix::OwnedWriteHalf>>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<Result<Value, String>>>>>,
}

fn resolve_node_binary() -> PathBuf {
    if let Ok(override_path) = std::env::var("AGENTIC_NODE_PATH") {
        let p = PathBuf::from(override_path);
        if p.exists() {
            return p;
        }
    }

    let mut candidates = Vec::new();
    if let Ok(home) = std::env::var("HOME") {
        let home = PathBuf::from(home);
        candidates.push(home.join(".local/bin/node"));
        candidates.push(home.join(".nvm/current/bin/node"));
        candidates.push(home.join(".volta/bin/node"));
        candidates.push(home.join(".asdf/shims/node"));
        candidates.push(home.join(".fnm/current/bin/node"));
        candidates.push(home.join("Library/pnpm/node"));
    }
    candidates.push(PathBuf::from("/opt/homebrew/bin/node"));
    candidates.push(PathBuf::from("/usr/local/bin/node"));
    candidates.push(PathBuf::from("/usr/bin/node"));

    for candidate in candidates {
        if candidate.exists() {
            return candidate;
        }
    }

    PathBuf::from("node")
}

fn build_enriched_path() -> String {
    let current_path = std::env::var("PATH").unwrap_or_default();
    let mut extra_paths = Vec::new();

    if let Ok(home) = std::env::var("HOME") {
        let h = PathBuf::from(&home);
        let user_dirs = [
            h.join(".local/bin"),
            h.join(".nvm/current/bin"),
            h.join(".volta/bin"),
            h.join(".asdf/shims"),
            h.join(".fnm/current/bin"),
            h.join("Library/pnpm"),
            h.join(".cargo/bin"),
        ];
        for d in user_dirs {
            if d.exists() {
                extra_paths.push(d.to_string_lossy().to_string());
            }
        }
    }

    let system_dirs = [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        "/usr/local/sbin",
        "/usr/bin",
        "/bin",
        "/usr/sbin",
        "/sbin",
    ];
    for d in system_dirs {
        if Path::new(d).exists() {
            extra_paths.push(d.to_string());
        }
    }

    if current_path.is_empty() {
        extra_paths.join(":")
    } else {
        format!("{}:{}", extra_paths.join(":"), current_path)
    }
}

impl EngineProcess {
    pub async fn spawn(
        app: AppHandle,
        bridge_script: PathBuf,
        engine_root: PathBuf,
    ) -> Result<Self, String> {
        let bridge_script = bridge_script
            .canonicalize()
            .map_err(|e| format!("Engine bridge script not found at {}: {e}", bridge_script.display()))?;
        let engine_root = engine_root
            .canonicalize()
            .map_err(|e| format!("Engine root not found at {}: {e}", engine_root.display()))?;

        let socket_path = std::env::temp_dir().join(format!("agentic-engine-{}.sock", uuid::Uuid::new_v4()));

        if socket_path.exists() {
            std::fs::remove_file(&socket_path).map_err(|e| e.to_string())?;
        }

        let node_bin = resolve_node_binary();
        let enriched_path = build_enriched_path();

        let mut child = Command::new(&node_bin)
            .current_dir(&engine_root)
            .arg(&bridge_script)
            .env("PATH", enriched_path)
            .env("AGENTIC_ENGINE_SOCKET", socket_path.as_os_str())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| format!("Failed to spawn engine bridge using '{}': {e}", node_bin.display()))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Engine bridge stdout unavailable".to_string())?;
        let stderr = child.stderr.take();

        let mut stdout_reader = BufReader::new(stdout);
        let mut ready_line = String::new();
        let ready_deadline = sleep(Duration::from_secs(30));
        tokio::pin!(ready_deadline);

        loop {
            ready_line.clear();
            tokio::select! {
                _ = &mut ready_deadline => {
                    return Err(read_child_diagnostics(&mut child, stderr, "Engine bridge timed out waiting for ready signal").await);
                }
                res = stdout_reader.read_line(&mut ready_line) => {
                    match res {
                        Ok(0) => {
                            return Err(read_child_diagnostics(&mut child, stderr, "Engine bridge exited before ready signal").await);
                        }
                        Ok(_) => {
                            let trimmed = ready_line.trim();
                            if trimmed.starts_with("ready:") {
                                break;
                            }
                            // Ignore other informational lines (e.g. http-ready:... or notices)
                        }
                        Err(error) => return Err(format!("Failed to read engine bridge output: {error}")),
                    }
                }
            }
        }

        let client = EngineClient::wait_and_connect(app, &socket_path, stderr).await?;

        Ok(Self { client, child })
    }
}

async fn read_child_diagnostics(
    child: &mut Child,
    stderr: Option<tokio::process::ChildStderr>,
    prefix: &str,
) -> String {
    let mut message = prefix.to_string();

    if let Some(stderr) = stderr {
        let mut stderr_reader = BufReader::new(stderr);
        let mut stderr_output = String::new();
        let _ = stderr_reader.read_to_string(&mut stderr_output).await;
        if !stderr_output.trim().is_empty() {
            message.push_str(&format!(": {}", stderr_output.trim()));
        }
    }

    if let Ok(Some(status)) = child.try_wait() {
        message.push_str(&format!(" (exit: {status})"));
    }

    message
}

impl EngineClient {
    async fn wait_and_connect(
        app: AppHandle,
        socket_path: &Path,
        stderr: Option<tokio::process::ChildStderr>,
    ) -> Result<Self, String> {
        for _ in 0..100 {
            match UnixStream::connect(socket_path).await {
                Ok(stream) => return Self::connect(app, stream).await,
                Err(_) => sleep(Duration::from_millis(100)).await,
            }
        }

        let mut message = format!("Engine socket was not created at {}", socket_path.display());
        if let Some(stderr) = stderr {
            let mut stderr_reader = BufReader::new(stderr);
            let mut stderr_output = String::new();
            let _ = stderr_reader.read_to_string(&mut stderr_output).await;
            if !stderr_output.trim().is_empty() {
                message.push_str(&format!(": {}", stderr_output.trim()));
            }
        }

        Err(message)
    }

    async fn connect(app: AppHandle, stream: UnixStream) -> Result<Self, String> {
        let (read_half, write_half) = stream.into_split();
        let write_half = Arc::new(Mutex::new(write_half));
        let pending: Arc<Mutex<HashMap<String, oneshot::Sender<Result<Value, String>>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        let client = Self {
            write_half,
            pending: pending.clone(),
        };

        tokio::spawn(async move {
            let mut reader = BufReader::new(read_half);
            let mut line = String::new();

            while reader.read_line(&mut line).await.unwrap_or(0) > 0 {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    line.clear();
                    continue;
                }

                if let Ok(json) = serde_json::from_str::<Value>(trimmed) {
                    if json.get("type").and_then(|v| v.as_str()) == Some("event") {
                        let name = json
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or_default();
                        let payload = json.get("payload").cloned().unwrap_or(Value::Null);
                        let event_name = format!("agentic:event:{name}");
                        let _ = app.emit(&event_name, payload);
                    } else if let Some(id) = json.get("id").and_then(|v| v.as_str()) {
                        if let Some(sender) = pending.lock().await.remove(id) {
                            let result = if let Some(error) = json.get("error").and_then(|v| v.as_str()) {
                                Err(error.to_string())
                            } else {
                                Ok(json.get("result").cloned().unwrap_or(Value::Null))
                            };
                            let _ = sender.send(result);
                        }
                    }
                }

                line.clear();
            }
        });

        Ok(client)
    }

    pub async fn request(&self, method: String, params: Value) -> Result<Value, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id.clone(), tx);

        let request = serde_json::json!({
            "id": id,
            "method": method,
            "params": params
        });

        {
            let mut writer = self.write_half.lock().await;
            writer
                .write_all(format!("{request}\n").as_bytes())
                .await
                .map_err(|e| e.to_string())?;
            writer.flush().await.map_err(|e| e.to_string())?;
        }

        rx.await
            .map_err(|_| "Engine request cancelled".to_string())?
    }
}

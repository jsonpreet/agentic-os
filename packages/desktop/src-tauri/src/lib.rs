mod engine_client;

use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use engine_client::EngineProcess;
use serde::Serialize;
use serde_json::Value;
use tauri::{Manager, State};
use tokio::sync::{Mutex, Notify};

struct AppState {
    engine: Arc<Mutex<Option<EngineProcess>>>,
    engine_ready: Arc<Notify>,
    engine_error: Arc<Mutex<Option<String>>>,
}

fn resolve_engine_root(app: &tauri::AppHandle) -> PathBuf {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_candidates = [
        manifest_dir.join("../../local-engine"),
        manifest_dir.join("../../../local-engine"),
    ];

    for candidate in dev_candidates {
        if candidate.exists() {
            return candidate;
        }
    }

    if let Ok(resource) = app.path().resolve("engine", tauri::path::BaseDirectory::Resource) {
        if resource.exists() {
            return resource;
        }
    }

    manifest_dir.join("../../local-engine")
}

fn resolve_bridge_script(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("AGENTIC_BRIDGE_SCRIPT") {
        let resolved = PathBuf::from(path);
        if resolved.exists() {
            return Ok(resolved);
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_candidates = [
        manifest_dir.join("../../local-engine/dist/bridge.js"),
        manifest_dir.join("../../../local-engine/dist/bridge.js"),
    ];

    for candidate in dev_candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    if let Ok(resource) = app.path().resolve(
        "engine/bridge.js",
        tauri::path::BaseDirectory::Resource,
    ) {
        if resource.exists() {
            return Ok(resource);
        }
    }

    Err("Could not locate local-engine bridge script. Build @agentic/local-engine first.".into())
}

async fn wait_for_engine(state: &AppState) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(60);

    loop {
        if state.engine.lock().await.is_some() {
            return Ok(());
        }

        if let Some(error) = state.engine_error.lock().await.clone() {
            return Err(error);
        }

        if Instant::now() >= deadline {
            return Err("Engine startup timed out after 60 seconds.".into());
        }

        tokio::select! {
            _ = state.engine_ready.notified() => {}
            _ = tokio::time::sleep(Duration::from_millis(150)) => {}
        }
    }
}

#[derive(Serialize)]
struct EngineStatusPayload {
    ready: bool,
    error: Option<String>,
}

#[tauri::command]
async fn engine_status(state: State<'_, AppState>) -> Result<EngineStatusPayload, String> {
    Ok(EngineStatusPayload {
        ready: state.engine.lock().await.is_some(),
        error: state.engine_error.lock().await.clone(),
    })
}

#[tauri::command]
async fn agentic_invoke(
    method: String,
    params: Value,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    wait_for_engine(state.inner()).await?;
    let engine = state.engine.lock().await;
    let process = engine
        .as_ref()
        .ok_or_else(|| "Engine is not available.".to_string())?;
    process.client.request(method, params).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.center();
                let _ = window.show();
                let _ = window.set_focus();
            }

            let engine = Arc::new(Mutex::new(None));
            let engine_ready = Arc::new(Notify::new());
            let engine_error = Arc::new(Mutex::new(None));
            let engine_slot = engine.clone();
            let ready = engine_ready.clone();
            let error_slot = engine_error.clone();

            app.manage(AppState {
                engine,
                engine_ready,
                engine_error,
            });

            let bridge_script = resolve_bridge_script(app.handle())?;
            let engine_root = resolve_engine_root(app.handle());
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                match EngineProcess::spawn(handle, bridge_script, engine_root).await {
                    Ok(process) => {
                        *engine_slot.lock().await = Some(process);
                    }
                    Err(error) => {
                        eprintln!("[agentic-desktop] engine startup failed: {error}");
                        *error_slot.lock().await = Some(error);
                    }
                }
                ready.notify_waiters();
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![agentic_invoke, engine_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import fs from "node:fs";
import { execa } from "execa";
import { EventEmitter } from "node:events";
import pty from "node-pty";
import { webcrypto } from "node:crypto";
import os from "node:os";
class EngineDatabase {
  constructor(dbPath) {
    __publicField(this, "db");
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }
  migrate() {
    const schema = `
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        repositories TEXT NOT NULL DEFAULT '[]',
        active_desktop_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS desktops (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'custom',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        desktop_id TEXT NOT NULL,
        repo_path TEXT,
        worktree_path TEXT,
        branch_name TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        voice TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (desktop_id) REFERENCES desktops(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS instruction_queue (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        attachments TEXT NOT NULL DEFAULT '[]',
        queued_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES agent_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS window_layouts (
        window_id TEXT NOT NULL,
        desktop_id TEXT NOT NULL,
        x REAL NOT NULL,
        y REAL NOT NULL,
        width REAL NOT NULL,
        height REAL NOT NULL,
        state TEXT NOT NULL DEFAULT 'normal',
        z_index INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (window_id, desktop_id),
        FOREIGN KEY (desktop_id) REFERENCES desktops(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_desktops_workspace ON desktops(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON agent_sessions(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_queue_session ON instruction_queue(session_id, status);
      CREATE INDEX IF NOT EXISTS idx_layouts_desktop ON window_layouts(desktop_id);
    `;
    this.db.exec(schema);
  }
  // Workspaces
  getWorkspaces() {
    const rows = this.db.prepare(`SELECT * FROM workspaces ORDER BY created_at ASC`).all();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon ?? void 0,
      repositories: JSON.parse(r.repositories || "[]"),
      activeDesktopId: r.active_desktop_id ?? void 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }
  getWorkspace(id) {
    const r = this.db.prepare(`SELECT * FROM workspaces WHERE id = ?`).get(id);
    if (!r)
      return null;
    return {
      id: r.id,
      name: r.name,
      icon: r.icon ?? void 0,
      repositories: JSON.parse(r.repositories || "[]"),
      activeDesktopId: r.active_desktop_id ?? void 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
  saveWorkspace(ws) {
    const stmt = this.db.prepare(`
      INSERT INTO workspaces (id, name, icon, repositories, active_desktop_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        icon = excluded.icon,
        repositories = excluded.repositories,
        active_desktop_id = excluded.active_desktop_id,
        updated_at = excluded.updated_at
    `);
    stmt.run(ws.id, ws.name, ws.icon ?? null, JSON.stringify(ws.repositories), ws.activeDesktopId ?? null, ws.createdAt, ws.updatedAt);
  }
  deleteWorkspace(id) {
    const res = this.db.prepare(`DELETE FROM workspaces WHERE id = ?`).run(id);
    return res.changes > 0;
  }
  // Desktops
  getDesktops(workspaceId) {
    const rows = this.db.prepare(`SELECT * FROM desktops WHERE workspace_id = ? ORDER BY sort_order ASC, created_at ASC`).all(workspaceId);
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      type: r.type,
      order: r.sort_order,
      createdAt: r.created_at
    }));
  }
  saveDesktop(desktop) {
    const stmt = this.db.prepare(`
      INSERT INTO desktops (id, workspace_id, name, type, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        sort_order = excluded.sort_order
    `);
    stmt.run(desktop.id, desktop.workspaceId, desktop.name, desktop.type, desktop.order, desktop.createdAt);
  }
  deleteDesktop(id) {
    const res = this.db.prepare(`DELETE FROM desktops WHERE id = ?`).run(id);
    return res.changes > 0;
  }
  // Agent Sessions
  getAgentSessions(workspaceId) {
    const rows = this.db.prepare(`SELECT * FROM agent_sessions WHERE workspace_id = ? ORDER BY created_at ASC`).all(workspaceId);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      provider: r.provider,
      workspaceId: r.workspace_id,
      desktopId: r.desktop_id,
      repoPath: r.repo_path ?? void 0,
      worktreePath: r.worktree_path ?? void 0,
      branchName: r.branch_name ?? void 0,
      status: r.status,
      voice: r.voice ?? void 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }
  getAgentSession(id) {
    const r = this.db.prepare(`SELECT * FROM agent_sessions WHERE id = ?`).get(id);
    if (!r)
      return null;
    return {
      id: r.id,
      name: r.name,
      provider: r.provider,
      workspaceId: r.workspace_id,
      desktopId: r.desktop_id,
      repoPath: r.repo_path ?? void 0,
      worktreePath: r.worktree_path ?? void 0,
      branchName: r.branch_name ?? void 0,
      status: r.status,
      voice: r.voice ?? void 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
  saveAgentSession(session) {
    const stmt = this.db.prepare(`
      INSERT INTO agent_sessions (
        id, name, provider, workspace_id, desktop_id,
        repo_path, worktree_path, branch_name, status, voice,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        provider = excluded.provider,
        desktop_id = excluded.desktop_id,
        repo_path = excluded.repo_path,
        worktree_path = excluded.worktree_path,
        branch_name = excluded.branch_name,
        status = excluded.status,
        voice = excluded.voice,
        updated_at = excluded.updated_at
    `);
    stmt.run(session.id, session.name, session.provider, session.workspaceId, session.desktopId, session.repoPath ?? null, session.worktreePath ?? null, session.branchName ?? null, session.status, session.voice ?? null, session.createdAt, session.updatedAt);
  }
  deleteAgentSession(id) {
    const res = this.db.prepare(`DELETE FROM agent_sessions WHERE id = ?`).run(id);
    return res.changes > 0;
  }
  // Instruction Queue
  getQueue(sessionId) {
    const rows = this.db.prepare(`SELECT * FROM instruction_queue WHERE session_id = ? AND status = 'queued' ORDER BY sort_order ASC, queued_at ASC`).all(sessionId);
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      prompt: r.prompt,
      attachments: JSON.parse(r.attachments || "[]"),
      queuedAt: r.queued_at,
      status: r.status
    }));
  }
  saveInstruction(instruction, sortOrder = 0) {
    const stmt = this.db.prepare(`
      INSERT INTO instruction_queue (id, session_id, prompt, attachments, queued_at, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        sort_order = excluded.sort_order
    `);
    stmt.run(instruction.id, instruction.sessionId, instruction.prompt, JSON.stringify(instruction.attachments || []), instruction.queuedAt, instruction.status, sortOrder);
  }
  updateInstructionStatus(id, status) {
    this.db.prepare(`UPDATE instruction_queue SET status = ? WHERE id = ?`).run(status, id);
  }
  deleteInstruction(id) {
    const res = this.db.prepare(`DELETE FROM instruction_queue WHERE id = ?`).run(id);
    return res.changes > 0;
  }
  // Window Layouts
  getWindowLayouts(desktopId) {
    const rows = this.db.prepare(`SELECT * FROM window_layouts WHERE desktop_id = ?`).all(desktopId);
    return rows.map((r) => ({
      windowId: r.window_id,
      desktopId: r.desktop_id,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      state: r.state,
      zIndex: r.z_index,
      updatedAt: r.updated_at
    }));
  }
  saveWindowLayout(layout) {
    const stmt = this.db.prepare(`
      INSERT INTO window_layouts (window_id, desktop_id, x, y, width, height, state, z_index, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(window_id, desktop_id) DO UPDATE SET
        x = excluded.x,
        y = excluded.y,
        width = excluded.width,
        height = excluded.height,
        state = excluded.state,
        z_index = excluded.z_index,
        updated_at = excluded.updated_at
    `);
    stmt.run(layout.windowId, layout.desktopId, layout.x, layout.y, layout.width, layout.height, layout.state, layout.zIndex, layout.updatedAt);
  }
  close() {
    this.db.close();
  }
}
let cachedEnv = null;
async function getShellEnvironment() {
  if (cachedEnv) {
    return cachedEnv;
  }
  const shell = process.env.SHELL || "/bin/zsh";
  try {
    const { stdout } = await execa(shell, ["-ilc", "env"], {
      timeout: 3e3,
      env: { ...process.env, TERM: "dumb" }
    });
    const env = {};
    for (const line of stdout.split("\n")) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.slice(0, idx);
        const val = line.slice(idx + 1);
        env[key] = val;
      }
    }
    cachedEnv = env;
    return env;
  } catch {
    return process.env;
  }
}
async function getSearchPaths() {
  const env = await getShellEnvironment();
  const pathStr = env.PATH || process.env.PATH || "";
  const paths = pathStr.split(":").filter(Boolean);
  const home = env.HOME || process.env.HOME || "";
  const standardPaths = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    `${home}/.local/bin`,
    `${home}/.cargo/bin`,
    `${home}/.gemini/bin`,
    `${home}/Library/Application Support/cursor/bin`
  ];
  const unique = /* @__PURE__ */ new Set();
  for (const p of [...paths, ...standardPaths]) {
    if (p)
      unique.add(p);
  }
  return Array.from(unique);
}
const SUPPORTED_CLIS = [
  {
    provider: "claude",
    name: "Claude Code",
    command: "claude",
    versionArgs: ["--version"],
    capabilities: {
      supportsPromptDelivery: true,
      supportsAttachments: true,
      supportsReadinessEvents: true,
      supportsResumption: true
    }
  },
  {
    provider: "gemini",
    name: "Gemini CLI",
    command: "gemini",
    versionArgs: ["--version"],
    capabilities: {
      supportsPromptDelivery: true,
      supportsAttachments: true,
      supportsReadinessEvents: true,
      supportsResumption: true
    }
  },
  {
    provider: "codex",
    name: "Codex CLI",
    command: "codex",
    versionArgs: ["--version"],
    capabilities: {
      supportsPromptDelivery: true,
      supportsAttachments: true,
      supportsReadinessEvents: false,
      supportsResumption: false
    }
  },
  {
    provider: "cursor",
    name: "Cursor CLI",
    command: "cursor",
    versionArgs: ["--version"],
    capabilities: {
      supportsPromptDelivery: true,
      supportsAttachments: false,
      supportsReadinessEvents: false,
      supportsResumption: false
    }
  }
];
class CLIDiscoveryService {
  constructor() {
    __publicField(this, "cache", null);
  }
  async scan() {
    const searchPaths = await getSearchPaths();
    const env = await getShellEnvironment();
    const results = [];
    for (const def of SUPPORTED_CLIS) {
      let executablePath = null;
      let version = null;
      let isAvailable = false;
      for (const dir of searchPaths) {
        const candidate = path.join(dir, def.command);
        try {
          if (fs.existsSync(candidate)) {
            const stat = fs.statSync(candidate);
            if (stat.isFile()) {
              executablePath = candidate;
              break;
            }
          }
        } catch {
        }
      }
      if (executablePath) {
        try {
          const { stdout } = await execa(executablePath, def.versionArgs, {
            env,
            timeout: 2e3
          });
          version = stdout.trim().split("\n")[0] || "Unknown";
          isAvailable = true;
        } catch {
          version = "Detected (version check timed out)";
          isAvailable = true;
        }
      }
      results.push({
        provider: def.provider,
        name: def.name,
        command: def.command,
        executablePath,
        version,
        isAvailable,
        capabilities: def.capabilities
      });
    }
    this.cache = results;
    return results;
  }
  getCached() {
    return this.cache;
  }
}
class GitWorktreeManager {
  /**
   * Inspects a directory to see if it is a Git repository and has an initial commit.
   */
  async checkRepo(dirPath) {
    try {
      const { stdout: isGitOutput } = await execa("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd: dirPath
      });
      const isGit = isGitOutput.trim() === "true";
      if (!isGit) {
        return { isGit: false, hasCommits: false };
      }
      try {
        const { stdout: headOutput } = await execa("git", ["rev-parse", "HEAD"], {
          cwd: dirPath
        });
        const headCommit = headOutput.trim();
        return { isGit: true, hasCommits: Boolean(headCommit), headCommit };
      } catch {
        return { isGit: true, hasCommits: false };
      }
    } catch {
      return { isGit: false, hasCommits: false };
    }
  }
  /**
   * Initializes a Git repository and creates an initial commit so worktrees can branch off.
   */
  async initRepo(dirPath) {
    await execa("git", ["init"], { cwd: dirPath });
    await this.ensureExclude(dirPath);
    const files = fs.readdirSync(dirPath).filter((f) => f !== ".git" && f !== ".agentic");
    if (files.length === 0) {
      fs.writeFileSync(path.join(dirPath, ".gitkeep"), "");
    }
    await execa("git", ["add", "-A"], { cwd: dirPath });
    await execa("git", ["commit", "-m", "chore: initial repository commit"], { cwd: dirPath });
    const { stdout: headOutput } = await execa("git", ["rev-parse", "HEAD"], { cwd: dirPath });
    return { success: true, headCommit: headOutput.trim() };
  }
  /**
   * Creates an isolated worktree and branch for an agent task.
   */
  async createWorktree(repoPath, agentName, sessionId) {
    const check = await this.checkRepo(repoPath);
    if (!check.isGit || !check.hasCommits) {
      throw new Error(`Repository at ${repoPath} must have a valid commit before creating worktrees.`);
    }
    await this.ensureExclude(repoPath);
    const safeName = agentName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const shortId = sessionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    const branchName = `agent/${safeName}-${shortId}`;
    const worktreesDir = path.join(repoPath, ".agentic", "worktrees");
    const worktreePath = path.join(worktreesDir, `${safeName}-${shortId}`);
    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }
    await execa("git", ["worktree", "add", "-b", branchName, worktreePath, "HEAD"], {
      cwd: repoPath
    });
    return {
      worktreePath,
      branchName
    };
  }
  /**
   * Removes an isolated worktree when an agent task finishes or is cleaned up.
   */
  async removeWorktree(repoPath, worktreePath, force = true) {
    if (!fs.existsSync(worktreePath)) {
      return;
    }
    const args = ["worktree", "remove"];
    if (force) {
      args.push("--force");
    }
    args.push(worktreePath);
    await execa("git", args, { cwd: repoPath });
  }
  /**
   * Appends .agentic/ to .git/info/exclude to avoid dirtying git status.
   */
  async ensureExclude(repoPath) {
    try {
      const gitDir = path.join(repoPath, ".git");
      if (!fs.existsSync(gitDir))
        return;
      const excludePath = path.join(gitDir, "info", "exclude");
      const excludeDir = path.dirname(excludePath);
      if (!fs.existsSync(excludeDir)) {
        fs.mkdirSync(excludeDir, { recursive: true });
      }
      let content = "";
      if (fs.existsSync(excludePath)) {
        content = fs.readFileSync(excludePath, "utf-8");
      }
      if (!content.includes(".agentic")) {
        fs.appendFileSync(excludePath, "\n.agentic/\n");
      }
    } catch {
    }
  }
}
const NAMES = [
  "Tim",
  "Jade",
  "Stark",
  "Nova",
  "Atlas",
  "Echo",
  "Orion",
  "Lyra",
  "Sage",
  "Pixel",
  "Cortex",
  "Vesper",
  "Zenith",
  "Blaze",
  "Frost",
  "Phoenix",
  "Kestrel",
  "Apollo",
  "Athena",
  "Aura",
  "Cygnus",
  "Draco",
  "Helix",
  "Iris",
  "Luna",
  "Mirage",
  "Nexus",
  "Pulsar",
  "Rift",
  "Sol",
  "Vortex"
];
function generateAgentName(existingNames) {
  const lowercaseExisting = new Set(existingNames.map((n) => n.toLowerCase()));
  const available = NAMES.filter((name) => !lowercaseExisting.has(name.toLowerCase()));
  if (available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    return available[idx];
  }
  const base = NAMES[Math.floor(Math.random() * NAMES.length)];
  let counter = 2;
  while (lowercaseExisting.has(`${base}-${counter}`.toLowerCase())) {
    counter++;
  }
  return `${base}-${counter}`;
}
let urlAlphabet = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
const POOL_SIZE_MULTIPLIER = 128;
let pool, poolOffset;
function fillPool(bytes) {
  if (bytes < 0) throw new RangeError("Wrong ID size");
  try {
    if (!pool || pool.length < bytes) {
      pool = Buffer.allocUnsafe(bytes * POOL_SIZE_MULTIPLIER);
      webcrypto.getRandomValues(pool);
      poolOffset = 0;
    } else if (poolOffset + bytes > pool.length) {
      webcrypto.getRandomValues(pool);
      poolOffset = 0;
    }
  } catch (e) {
    pool = void 0;
    throw e;
  }
  poolOffset += bytes;
}
function nanoid(size = 21) {
  fillPool(size |= 0);
  let id = "";
  for (let i = poolOffset - size; i < poolOffset; i++) {
    id += urlAlphabet[pool[i] & 63];
  }
  return id;
}
class InstructionQueueManager extends EventEmitter {
  constructor(db) {
    super();
    __publicField(this, "db");
    this.db = db;
  }
  enqueue(sessionId, prompt, attachments = []) {
    const instruction = {
      id: nanoid(),
      sessionId,
      prompt,
      attachments,
      queuedAt: Date.now(),
      status: "queued"
    };
    const currentQueue = this.db.getQueue(sessionId);
    this.db.saveInstruction(instruction, currentQueue.length);
    const updated = this.db.getQueue(sessionId);
    this.emit("queue_updated", { sessionId, queue: updated });
    return instruction;
  }
  getQueue(sessionId) {
    return this.db.getQueue(sessionId);
  }
  getNext(sessionId) {
    const queue = this.db.getQueue(sessionId);
    return queue.length > 0 ? queue[0] : null;
  }
  markDelivered(instructionId, sessionId) {
    this.db.updateInstructionStatus(instructionId, "delivered");
    const updated = this.db.getQueue(sessionId);
    this.emit("queue_updated", { sessionId, queue: updated });
  }
  cancel(instructionId, sessionId) {
    const success = this.db.deleteInstruction(instructionId);
    if (success) {
      const updated = this.db.getQueue(sessionId);
      this.emit("queue_updated", { sessionId, queue: updated });
    }
    return success;
  }
}
class PTYManager extends EventEmitter {
  constructor() {
    super(...arguments);
    __publicField(this, "sessions", /* @__PURE__ */ new Map());
    __publicField(this, "sessionStatuses", /* @__PURE__ */ new Map());
    __publicField(this, "outputBuffers", /* @__PURE__ */ new Map());
  }
  async spawn(options) {
    const { sessionId, command, args = [], cwd, cols = 80, rows = 24 } = options;
    if (this.sessions.has(sessionId)) {
      throw new Error(`PTY session ${sessionId} already exists.`);
    }
    const env = await getShellEnvironment();
    const effectiveCwd = fs.existsSync(cwd) ? cwd : process.env.HOME || "/";
    const ptyProcess = pty.spawn(command, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: effectiveCwd,
      env: {
        ...env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        AGENTIC_SESSION_ID: sessionId
      }
    });
    this.sessions.set(sessionId, ptyProcess);
    this.sessionStatuses.set(sessionId, "working");
    this.outputBuffers.set(sessionId, "");
    ptyProcess.onData((data) => {
      const buf = (this.outputBuffers.get(sessionId) || "") + data;
      this.outputBuffers.set(sessionId, buf.slice(-1e4));
      this.emit("terminal_output", {
        sessionId,
        data,
        timestamp: Date.now()
      });
      if (data.includes("> ") || data.includes("$ ") || data.includes("% ") || data.includes("ready")) {
        this.setStatus(sessionId, "idle");
      }
    });
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.sessions.delete(sessionId);
      this.setStatus(sessionId, "terminated");
      this.emit("session_exit", { sessionId, exitCode, signal });
    });
  }
  sendInput(sessionId, data) {
    const ptyProcess = this.sessions.get(sessionId);
    if (!ptyProcess) {
      throw new Error(`Cannot send input: PTY session ${sessionId} not found.`);
    }
    this.setStatus(sessionId, "working");
    ptyProcess.write(data);
  }
  resize(sessionId, cols, rows) {
    const ptyProcess = this.sessions.get(sessionId);
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
      } catch {
      }
    }
  }
  interrupt(sessionId) {
    const ptyProcess = this.sessions.get(sessionId);
    if (ptyProcess) {
      ptyProcess.write("");
      this.setStatus(sessionId, "idle");
    }
  }
  kill(sessionId) {
    const ptyProcess = this.sessions.get(sessionId);
    if (ptyProcess) {
      ptyProcess.kill();
      this.sessions.delete(sessionId);
      this.setStatus(sessionId, "terminated");
    }
  }
  getStatus(sessionId) {
    return this.sessionStatuses.get(sessionId) || "idle";
  }
  setStatus(sessionId, status) {
    const prev = this.sessionStatuses.get(sessionId);
    if (prev !== status) {
      this.sessionStatuses.set(sessionId, status);
      this.emit("status_changed", { sessionId, status, timestamp: Date.now() });
    }
  }
  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }
}
class PromptRouter {
  /**
   * Evaluates a prompt to determine whether it addresses an existing agent,
   * requests an app command, or requires spawning a new agent.
   */
  static parsePrompt(rawPrompt) {
    const trimmed = rawPrompt.trim();
    const match = trimmed.match(/^(?:hey\s+)?([a-zA-Z0-9_-]+)[,:]\s*(.*)$/i);
    if (match) {
      return {
        targetName: match[1],
        instruction: match[2].trim()
      };
    }
    const spaceMatch = trimmed.match(/^hey\s+([a-zA-Z0-9_-]+)\s+(.*)$/i);
    if (spaceMatch) {
      return {
        targetName: spaceMatch[1],
        instruction: spaceMatch[2].trim()
      };
    }
    return {
      targetName: null,
      instruction: trimmed
    };
  }
  static async route(options) {
    const { prompt, activeSessions, ptyManager, queueManager } = options;
    const { targetName, instruction } = this.parsePrompt(prompt);
    if (targetName) {
      const matchedSession = activeSessions.find((s) => s.name.toLowerCase() === targetName.toLowerCase());
      if (matchedSession) {
        const isWorking = ptyManager.getStatus(matchedSession.id) === "working";
        if (isWorking) {
          const queuedItem = queueManager.enqueue(matchedSession.id, instruction);
          return {
            action: "queued_for_active",
            sessionId: matchedSession.id,
            agentName: matchedSession.name,
            instructionId: queuedItem.id,
            message: `Queued follow-up instruction for ${matchedSession.name}`
          };
        } else {
          ptyManager.sendInput(matchedSession.id, instruction + "\n");
          return {
            action: "sent_to_active",
            sessionId: matchedSession.id,
            agentName: matchedSession.name,
            message: `Delivered instruction directly to ${matchedSession.name}`
          };
        }
      } else {
        return {
          action: "ambiguous",
          agentName: targetName,
          message: `No active agent named "${targetName}" was found in this workspace.`
        };
      }
    }
    return {
      action: "spawned_new_agent",
      message: instruction
    };
  }
}
class LocalEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    __publicField(this, "db");
    __publicField(this, "cliDiscovery");
    __publicField(this, "gitManager");
    __publicField(this, "ptyManager");
    __publicField(this, "queueManager");
    const defaultDbPath = config.dbPath || path.join(os.homedir(), ".agentic", "data", "agentic.db");
    this.db = new EngineDatabase(defaultDbPath);
    this.cliDiscovery = new CLIDiscoveryService();
    this.gitManager = new GitWorktreeManager();
    this.ptyManager = new PTYManager();
    this.queueManager = new InstructionQueueManager(this.db);
    this.wireEvents();
  }
  wireEvents() {
    this.ptyManager.on("terminal_output", (event) => {
      this.emit("terminal_output", event);
    });
    this.ptyManager.on("status_changed", (event) => {
      const session = this.db.getAgentSession(event.sessionId);
      if (session) {
        session.status = event.status;
        session.updatedAt = Date.now();
        this.db.saveAgentSession(session);
      }
      this.emit("status_changed", event);
      if (event.status === "idle") {
        const next = this.queueManager.getNext(event.sessionId);
        if (next) {
          this.queueManager.markDelivered(next.id, event.sessionId);
          this.ptyManager.sendInput(event.sessionId, next.prompt + "\n");
        }
      }
    });
    this.queueManager.on("queue_updated", (event) => {
      this.emit("queue_updated", event);
    });
  }
  // Workspaces
  async getWorkspaces() {
    let list = this.db.getWorkspaces();
    if (list.length === 0) {
      const defaultWs = await this.createWorkspace({
        name: "Default Workspace",
        icon: "folder"
      });
      list = [defaultWs];
    }
    return list;
  }
  async createWorkspace(params) {
    const wsId = nanoid();
    const now = Date.now();
    const buildDesktopId = nanoid();
    const defaultDesktops = [
      { id: buildDesktopId, workspaceId: wsId, name: "Build", type: "build", order: 0, createdAt: now },
      { id: nanoid(), workspaceId: wsId, name: "Design", type: "design", order: 1, createdAt: now + 1 },
      { id: nanoid(), workspaceId: wsId, name: "Research", type: "research", order: 2, createdAt: now + 2 },
      { id: nanoid(), workspaceId: wsId, name: "Review", type: "review", order: 3, createdAt: now + 3 }
    ];
    const workspace = {
      id: wsId,
      name: params.name,
      icon: params.icon,
      repositories: params.repositories || [],
      activeDesktopId: buildDesktopId,
      createdAt: now,
      updatedAt: now
    };
    this.db.saveWorkspace(workspace);
    for (const d of defaultDesktops) {
      this.db.saveDesktop(d);
    }
    return workspace;
  }
  async updateWorkspace(id, updates) {
    const ws = this.db.getWorkspace(id);
    if (!ws)
      throw new Error(`Workspace ${id} not found.`);
    const updated = { ...ws, ...updates, updatedAt: Date.now() };
    this.db.saveWorkspace(updated);
    return updated;
  }
  async deleteWorkspace(id) {
    return this.db.deleteWorkspace(id);
  }
  // Desktops
  async getDesktops(workspaceId) {
    return this.db.getDesktops(workspaceId);
  }
  async createDesktop(params) {
    const desktops = this.db.getDesktops(params.workspaceId);
    const desktop = {
      id: nanoid(),
      workspaceId: params.workspaceId,
      name: params.name,
      type: params.type || "custom",
      order: desktops.length,
      createdAt: Date.now()
    };
    this.db.saveDesktop(desktop);
    return desktop;
  }
  async deleteDesktop(id) {
    return this.db.deleteDesktop(id);
  }
  // CLI Discovery
  async getDiscoveredCLIs() {
    const cached = this.cliDiscovery.getCached();
    if (cached)
      return cached;
    return this.cliDiscovery.scan();
  }
  async rescanCLIs() {
    return this.cliDiscovery.scan();
  }
  // Agent Sessions
  async getAgentSessions(workspaceId) {
    return this.db.getAgentSessions(workspaceId);
  }
  async createAgentSession(params) {
    const existing = this.db.getAgentSessions(params.workspaceId);
    const agentName = params.name || generateAgentName(existing.map((s) => s.name));
    const sessionId = nanoid();
    let worktreePath;
    let branchName;
    if (params.repoPath) {
      const repoCheck = await this.gitManager.checkRepo(params.repoPath);
      if (repoCheck.isGit && repoCheck.hasCommits) {
        try {
          const wt = await this.gitManager.createWorktree(params.repoPath, agentName, sessionId);
          worktreePath = wt.worktreePath;
          branchName = wt.branchName;
        } catch (err) {
          console.warn(`Failed to create worktree for ${agentName}:`, err.message);
        }
      }
    }
    const session = {
      id: sessionId,
      name: agentName,
      provider: params.provider,
      workspaceId: params.workspaceId,
      desktopId: params.desktopId,
      repoPath: params.repoPath,
      worktreePath,
      branchName,
      status: "working",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.db.saveAgentSession(session);
    const clis = await this.getDiscoveredCLIs();
    const discovered = clis.find((c) => c.provider === params.provider && c.isAvailable);
    const cwd = worktreePath || params.repoPath || process.env.HOME || "/";
    const command = (discovered == null ? void 0 : discovered.executablePath) || process.env.SHELL || "/bin/zsh";
    const args = discovered ? [] : ["-i"];
    await this.ptyManager.spawn({
      sessionId,
      command,
      args,
      cwd
    });
    return session;
  }
  async renameAgentSession(sessionId, newName) {
    const session = this.db.getAgentSession(sessionId);
    if (!session)
      throw new Error(`Agent session ${sessionId} not found.`);
    session.name = newName;
    session.updatedAt = Date.now();
    this.db.saveAgentSession(session);
    return session;
  }
  async terminateAgentSession(sessionId) {
    this.ptyManager.kill(sessionId);
    const session = this.db.getAgentSession(sessionId);
    if (session) {
      session.status = "terminated";
      session.updatedAt = Date.now();
      this.db.saveAgentSession(session);
      if (session.repoPath && session.worktreePath) {
        try {
          await this.gitManager.removeWorktree(session.repoPath, session.worktreePath);
        } catch {
        }
      }
    }
    return true;
  }
  async sendPrompt(params) {
    var _a;
    const activeSessions = this.db.getAgentSessions(params.workspaceId).filter((s) => s.status !== "terminated");
    const routeResult = await PromptRouter.route({
      prompt: params.prompt,
      activeSessions,
      ptyManager: this.ptyManager,
      queueManager: this.queueManager
    });
    if (routeResult.action === "spawned_new_agent") {
      const ws = this.db.getWorkspace(params.workspaceId);
      const desktops = this.db.getDesktops(params.workspaceId);
      const desktopId = (ws == null ? void 0 : ws.activeDesktopId) || ((_a = desktops[0]) == null ? void 0 : _a.id) || "default";
      const provider = params.fallbackProvider || "claude";
      const repoPath = params.repoPath || (ws == null ? void 0 : ws.repositories[0]);
      const newSession = await this.createAgentSession({
        workspaceId: params.workspaceId,
        desktopId,
        provider,
        repoPath
      });
      setTimeout(() => {
        if (this.ptyManager.hasSession(newSession.id)) {
          this.ptyManager.sendInput(newSession.id, params.prompt + "\n");
        }
      }, 500);
      return {
        action: "spawned_new_agent",
        sessionId: newSession.id,
        agentName: newSession.name,
        message: `Created agent ${newSession.name} (${provider}) and delivered prompt`
      };
    }
    return routeResult;
  }
  async interruptAgent(sessionId) {
    this.ptyManager.interrupt(sessionId);
    return true;
  }
  async cancelInstruction(instructionId) {
    var _a;
    const queue = this.db.getQueue(instructionId);
    return this.queueManager.cancel(instructionId, ((_a = queue[0]) == null ? void 0 : _a.sessionId) || "");
  }
  async getAgentQueue(sessionId) {
    return this.queueManager.getQueue(sessionId);
  }
  // Terminal PTY
  async sendTerminalInput(sessionId, data) {
    this.ptyManager.sendInput(sessionId, data);
  }
  async resizeTerminal(sessionId, cols, rows) {
    this.ptyManager.resize(sessionId, cols, rows);
  }
  // Window Layouts
  async getWindowLayouts(desktopId) {
    return this.db.getWindowLayouts(desktopId);
  }
  async saveWindowLayout(layout) {
    this.db.saveWindowLayout(layout);
  }
  // Git repo helpers
  async checkGitRepo(dirPath) {
    return this.gitManager.checkRepo(dirPath);
  }
  async initGitRepo(dirPath) {
    return this.gitManager.initRepo(dirPath);
  }
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
let engine = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: "#0d0f12",
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname$1, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function initEngineAndIPC() {
  engine = new LocalEngine();
  engine.on("terminal_output", (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agentic:event:terminal_output", event);
    }
  });
  engine.on("status_changed", (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agentic:event:status_changed", event);
    }
  });
  engine.on("queue_updated", (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("agentic:event:queue_updated", event);
    }
  });
  ipcMain.handle("agentic:workspace:getWorkspaces", async () => {
    return engine.getWorkspaces();
  });
  ipcMain.handle("agentic:workspace:createWorkspace", async (_e, params) => {
    return engine.createWorkspace(params);
  });
  ipcMain.handle("agentic:workspace:updateWorkspace", async (_e, id, updates) => {
    return engine.updateWorkspace(id, updates);
  });
  ipcMain.handle("agentic:workspace:deleteWorkspace", async (_e, id) => {
    return engine.deleteWorkspace(id);
  });
  ipcMain.handle("agentic:desktop:getDesktops", async (_e, workspaceId) => {
    return engine.getDesktops(workspaceId);
  });
  ipcMain.handle("agentic:desktop:createDesktop", async (_e, params) => {
    return engine.createDesktop(params);
  });
  ipcMain.handle("agentic:desktop:deleteDesktop", async (_e, id) => {
    return engine.deleteDesktop(id);
  });
  ipcMain.handle("agentic:cli:getDiscoveredCLIs", async () => {
    return engine.getDiscoveredCLIs();
  });
  ipcMain.handle("agentic:cli:rescanCLIs", async () => {
    return engine.rescanCLIs();
  });
  ipcMain.handle("agentic:agent:getSessions", async (_e, workspaceId) => {
    return engine.getAgentSessions(workspaceId);
  });
  ipcMain.handle("agentic:agent:createSession", async (_e, params) => {
    return engine.createAgentSession(params);
  });
  ipcMain.handle("agentic:agent:renameSession", async (_e, sessionId, newName) => {
    return engine.renameAgentSession(sessionId, newName);
  });
  ipcMain.handle("agentic:agent:terminateSession", async (_e, sessionId) => {
    return engine.terminateAgentSession(sessionId);
  });
  ipcMain.handle("agentic:agent:sendPrompt", async (_e, params) => {
    return engine.sendPrompt(params);
  });
  ipcMain.handle("agentic:agent:interrupt", async (_e, sessionId) => {
    return engine.interruptAgent(sessionId);
  });
  ipcMain.handle("agentic:agent:cancelInstruction", async (_e, instructionId) => {
    return engine.cancelInstruction(instructionId);
  });
  ipcMain.handle("agentic:agent:getQueue", async (_e, sessionId) => {
    return engine.getAgentQueue(sessionId);
  });
  ipcMain.handle("agentic:terminal:sendInput", async (_e, sessionId, data) => {
    return engine.sendTerminalInput(sessionId, data);
  });
  ipcMain.handle("agentic:terminal:resize", async (_e, sessionId, cols, rows) => {
    return engine.resizeTerminal(sessionId, cols, rows);
  });
  ipcMain.handle("agentic:layout:getLayouts", async (_e, desktopId) => {
    return engine.getWindowLayouts(desktopId);
  });
  ipcMain.handle("agentic:layout:saveLayout", async (_e, layout) => {
    return engine.saveWindowLayout(layout);
  });
  ipcMain.handle("agentic:git:checkRepo", async (_e, dirPath) => {
    return engine.checkGitRepo(dirPath);
  });
  ipcMain.handle("agentic:git:initRepo", async (_e, dirPath) => {
    return engine.initGitRepo(dirPath);
  });
}
app.whenReady().then(() => {
  initEngineAndIPC();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
//# sourceMappingURL=index.js.map

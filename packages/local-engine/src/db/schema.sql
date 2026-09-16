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

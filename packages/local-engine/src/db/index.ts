import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {
  Workspace,
  Desktop,
  AgentSession,
  AgentInstruction,
  WindowLayout,
  AgentStatus,
  WindowState,
  DesktopType
} from '@agentic/shared-contracts';

export class EngineDatabase {
  private db: DatabaseType;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
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
  getWorkspaces(): Workspace[] {
    const rows = this.db.prepare(`SELECT * FROM workspaces ORDER BY created_at ASC`).all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon ?? undefined,
      repositories: JSON.parse(r.repositories || '[]'),
      activeDesktopId: r.active_desktop_id ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  getWorkspace(id: string): Workspace | null {
    const r = this.db.prepare(`SELECT * FROM workspaces WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      icon: r.icon ?? undefined,
      repositories: JSON.parse(r.repositories || '[]'),
      activeDesktopId: r.active_desktop_id ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  saveWorkspace(ws: Workspace): void {
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
    stmt.run(
      ws.id,
      ws.name,
      ws.icon ?? null,
      JSON.stringify(ws.repositories),
      ws.activeDesktopId ?? null,
      ws.createdAt,
      ws.updatedAt
    );
  }

  deleteWorkspace(id: string): boolean {
    const res = this.db.prepare(`DELETE FROM workspaces WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  // Desktops
  getDesktops(workspaceId: string): Desktop[] {
    const rows = this.db
      .prepare(`SELECT * FROM desktops WHERE workspace_id = ? ORDER BY sort_order ASC, created_at ASC`)
      .all(workspaceId) as any[];
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      type: r.type as DesktopType,
      order: r.sort_order,
      createdAt: r.created_at
    }));
  }

  saveDesktop(desktop: Desktop): void {
    const stmt = this.db.prepare(`
      INSERT INTO desktops (id, workspace_id, name, type, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        sort_order = excluded.sort_order
    `);
    stmt.run(
      desktop.id,
      desktop.workspaceId,
      desktop.name,
      desktop.type,
      desktop.order,
      desktop.createdAt
    );
  }

  deleteDesktop(id: string): boolean {
    const res = this.db.prepare(`DELETE FROM desktops WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  // Agent Sessions
  getAgentSessions(workspaceId: string): AgentSession[] {
    const rows = this.db
      .prepare(`SELECT * FROM agent_sessions WHERE workspace_id = ? ORDER BY created_at ASC`)
      .all(workspaceId) as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      provider: r.provider,
      workspaceId: r.workspace_id,
      desktopId: r.desktop_id,
      repoPath: r.repo_path ?? undefined,
      worktreePath: r.worktree_path ?? undefined,
      branchName: r.branch_name ?? undefined,
      status: r.status as AgentStatus,
      voice: r.voice ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  getAgentSession(id: string): AgentSession | null {
    const r = this.db.prepare(`SELECT * FROM agent_sessions WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      provider: r.provider,
      workspaceId: r.workspace_id,
      desktopId: r.desktop_id,
      repoPath: r.repo_path ?? undefined,
      worktreePath: r.worktree_path ?? undefined,
      branchName: r.branch_name ?? undefined,
      status: r.status as AgentStatus,
      voice: r.voice ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  saveAgentSession(session: AgentSession): void {
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
    stmt.run(
      session.id,
      session.name,
      session.provider,
      session.workspaceId,
      session.desktopId,
      session.repoPath ?? null,
      session.worktreePath ?? null,
      session.branchName ?? null,
      session.status,
      session.voice ?? null,
      session.createdAt,
      session.updatedAt
    );
  }

  deleteAgentSession(id: string): boolean {
    const res = this.db.prepare(`DELETE FROM agent_sessions WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  // Instruction Queue
  getQueue(sessionId: string): AgentInstruction[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM instruction_queue WHERE session_id = ? AND status = 'queued' ORDER BY sort_order ASC, queued_at ASC`
      )
      .all(sessionId) as any[];
    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      prompt: r.prompt,
      attachments: JSON.parse(r.attachments || '[]'),
      queuedAt: r.queued_at,
      status: r.status
    }));
  }

  saveInstruction(instruction: AgentInstruction, sortOrder = 0): void {
    const stmt = this.db.prepare(`
      INSERT INTO instruction_queue (id, session_id, prompt, attachments, queued_at, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        sort_order = excluded.sort_order
    `);
    stmt.run(
      instruction.id,
      instruction.sessionId,
      instruction.prompt,
      JSON.stringify(instruction.attachments || []),
      instruction.queuedAt,
      instruction.status,
      sortOrder
    );
  }

  updateInstructionStatus(id: string, status: AgentInstruction['status']): void {
    this.db.prepare(`UPDATE instruction_queue SET status = ? WHERE id = ?`).run(status, id);
  }

  deleteInstruction(id: string): boolean {
    const res = this.db.prepare(`DELETE FROM instruction_queue WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  // Window Layouts
  getWindowLayouts(desktopId: string): WindowLayout[] {
    const rows = this.db
      .prepare(`SELECT * FROM window_layouts WHERE desktop_id = ?`)
      .all(desktopId) as any[];
    return rows.map((r) => ({
      windowId: r.window_id,
      desktopId: r.desktop_id,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      state: r.state as WindowState,
      zIndex: r.z_index,
      updatedAt: r.updated_at
    }));
  }

  saveWindowLayout(layout: WindowLayout): void {
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
    stmt.run(
      layout.windowId,
      layout.desktopId,
      layout.x,
      layout.y,
      layout.width,
      layout.height,
      layout.state,
      layout.zIndex,
      layout.updatedAt
    );
  }

  close(): void {
    this.db.close();
  }
}

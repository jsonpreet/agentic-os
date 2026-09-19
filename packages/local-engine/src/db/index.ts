import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Workspace,
  Desktop,
  AgentSession,
  AgentInstruction,
  WindowLayout,
  AgentStatus,
  WindowState,
  DesktopType,
  DiscoveredCLI,
  AgentProvider,
  BrowserSession,
  WorkspaceNote,
  KanbanTask,
  KanbanColumn,
  DeviceIdentity,
  SyncPreferences,
  AccountSession,
  SubscriptionEntitlement,
  PairedDevice,
  PairingCode,
  AgenticNotification,
  SavedHttpRequest,
  ActivityEvent,
  CreateActivityEventParams,
  ActivityEventQuery
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
      CREATE TABLE IF NOT EXISTS cli_integrations (
        provider TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        executable_path TEXT,
        version TEXT,
        is_available INTEGER NOT NULL DEFAULT 0,
        is_manual INTEGER NOT NULL DEFAULT 0,
        capabilities TEXT NOT NULL DEFAULT '{}',
        last_scan_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_layouts_desktop ON window_layouts(desktop_id);

      CREATE TABLE IF NOT EXISTS browser_sessions (
        id TEXT PRIMARY KEY,
        desktop_id TEXT NOT NULL,
        url TEXT NOT NULL DEFAULT 'about:blank',
        title TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (desktop_id) REFERENCES desktops(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_browser_desktop ON browser_sessions(desktop_id);

      CREATE TABLE IF NOT EXISTS workspace_notes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        desktop_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (desktop_id) REFERENCES desktops(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notes_desktop ON workspace_notes(workspace_id, desktop_id);

      CREATE TABLE IF NOT EXISTS kanban_tasks (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        desktop_id TEXT NOT NULL,
        column_name TEXT NOT NULL DEFAULT 'todo',
        title TEXT NOT NULL,
        description TEXT,
        linked_session_id TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (desktop_id) REFERENCES desktops(id) ON DELETE CASCADE,
        FOREIGN KEY (linked_session_id) REFERENCES agent_sessions(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kanban_desktop ON kanban_tasks(workspace_id, desktop_id);

      CREATE TABLE IF NOT EXISTS device_identity (
        device_id TEXT PRIMARY KEY,
        device_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_preferences (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        local_only_mode INTEGER NOT NULL DEFAULT 0,
        auto_sync_enabled INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_synced_at INTEGER,
        latest_snapshot_version INTEGER NOT NULL DEFAULT 0
      );

      INSERT OR IGNORE INTO sync_preferences (id, local_only_mode, auto_sync_enabled)
      VALUES (1, 0, 1);

      INSERT OR IGNORE INTO sync_state (id, last_synced_at, latest_snapshot_version)
      VALUES (1, NULL, 0);

      CREATE TABLE IF NOT EXISTS account_session (
        account_id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        signed_in_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscription_entitlement (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        plan TEXT NOT NULL,
        device_limit INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        offline_lease_until INTEGER NOT NULL,
        cloud_snapshots INTEGER NOT NULL DEFAULT 1,
        relay_access INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS paired_devices (
        device_id TEXT PRIMARY KEY,
        device_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        paired_at INTEGER NOT NULL,
        last_seen_at INTEGER,
        trusted INTEGER NOT NULL DEFAULT 1,
        revoked INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS pairing_codes (
        code TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        approved INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS processed_stripe_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        processed_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        generic_push_body TEXT NOT NULL,
        session_id TEXT,
        desktop_id TEXT,
        workspace_id TEXT,
        dedupe_key TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(dedupe_key, created_at DESC);

      CREATE TABLE IF NOT EXISTS http_requests (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        desktop_id TEXT NOT NULL,
        name TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'GET',
        url TEXT NOT NULL DEFAULT '',
        headers TEXT NOT NULL DEFAULT '[]',
        body TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (desktop_id) REFERENCES desktops(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_http_requests_desktop ON http_requests(workspace_id, desktop_id);

      CREATE TABLE IF NOT EXISTS activity_events (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        desktop_id TEXT,
        category TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_category ON activity_events(category, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity_events(workspace_id, created_at DESC);
    `;

    this.db.exec(schema);
    this.migrateSyncPreferences();
  }

  private migrateSyncPreferences(): void {
    const columns = this.db.prepare(`PRAGMA table_info(sync_preferences)`).all() as Array<{
      name: string;
    }>;
    if (!columns.some((column) => column.name === 'relay_url')) {
      this.db.exec(`ALTER TABLE sync_preferences ADD COLUMN relay_url TEXT`);
    }
  }

  // CLI Integrations
  getCLIIntegrations(): DiscoveredCLI[] {
    const rows = this.db
      .prepare(`SELECT * FROM cli_integrations ORDER BY provider ASC`)
      .all() as any[];
    return rows.map((r) => this.rowToCLIIntegration(r));
  }

  saveCLIIntegration(cli: DiscoveredCLI, isManual = false): void {
    const stmt = this.db.prepare(`
      INSERT INTO cli_integrations (
        provider, name, command, executable_path, version,
        is_available, is_manual, capabilities, last_scan_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        name = excluded.name,
        command = excluded.command,
        executable_path = excluded.executable_path,
        version = excluded.version,
        is_available = excluded.is_available,
        is_manual = excluded.is_manual,
        capabilities = excluded.capabilities,
        last_scan_at = excluded.last_scan_at
    `);

    stmt.run(
      cli.provider,
      cli.name,
      cli.command,
      cli.executablePath,
      cli.version,
      cli.isAvailable ? 1 : 0,
      isManual ? 1 : 0,
      JSON.stringify(cli.capabilities),
      Date.now()
    );
  }

  getManualCLIPaths(): Partial<Record<AgentProvider, string>> {
    const rows = this.db
      .prepare(
        `SELECT provider, executable_path FROM cli_integrations WHERE is_manual = 1 AND executable_path IS NOT NULL`
      )
      .all() as any[];

    const paths: Partial<Record<AgentProvider, string>> = {};
    for (const row of rows) {
      paths[row.provider as AgentProvider] = row.executable_path;
    }
    return paths;
  }

  clearManualCLIPath(provider: AgentProvider): void {
    this.db
      .prepare(`UPDATE cli_integrations SET is_manual = 0 WHERE provider = ?`)
      .run(provider);
  }

  private rowToCLIIntegration(r: any): DiscoveredCLI {
    return {
      provider: r.provider as AgentProvider,
      name: r.name,
      command: r.command,
      executablePath: r.executable_path ?? null,
      version: r.version ?? null,
      isAvailable: Boolean(r.is_available),
      isManual: Boolean(r.is_manual),
      capabilities: JSON.parse(r.capabilities || '{}')
    };
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
  getDesktop(id: string): Desktop | null {
    const r = this.db.prepare(`SELECT * FROM desktops WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      type: r.type as DesktopType,
      order: r.sort_order,
      createdAt: r.created_at
    };
  }

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
    return rows.map((r) => this.rowToAgentSession(r));
  }

  getAllAgentSessions(): AgentSession[] {
    const rows = this.db
      .prepare(`SELECT * FROM agent_sessions ORDER BY created_at ASC`)
      .all() as any[];
    return rows.map((r) => this.rowToAgentSession(r));
  }

  getAgentSession(id: string): AgentSession | null {
    const r = this.db.prepare(`SELECT * FROM agent_sessions WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return this.rowToAgentSession(r);
  }

  private rowToAgentSession(r: any): AgentSession {
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
    return rows.map((r) => this.rowToInstruction(r));
  }

  getInstructionById(id: string): AgentInstruction | null {
    const r = this.db.prepare(`SELECT * FROM instruction_queue WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return this.rowToInstruction(r);
  }

  private rowToInstruction(r: any): AgentInstruction {
    return {
      id: r.id,
      sessionId: r.session_id,
      prompt: r.prompt,
      attachments: JSON.parse(r.attachments || '[]'),
      queuedAt: r.queued_at,
      status: r.status
    };
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

  updateInstructionPrompt(id: string, prompt: string): boolean {
    const res = this.db
      .prepare(`UPDATE instruction_queue SET prompt = ? WHERE id = ? AND status = 'queued'`)
      .run(prompt, id);
    return res.changes > 0;
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

  // Browser Sessions
  getBrowserSessions(desktopId: string): BrowserSession[] {
    const rows = this.db
      .prepare(`SELECT * FROM browser_sessions WHERE desktop_id = ? ORDER BY created_at ASC`)
      .all(desktopId) as any[];
    return rows.map((r) => this.rowToBrowserSession(r));
  }

  getBrowserSession(id: string): BrowserSession | null {
    const r = this.db.prepare(`SELECT * FROM browser_sessions WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return this.rowToBrowserSession(r);
  }

  saveBrowserSession(session: BrowserSession): void {
    const stmt = this.db.prepare(`
      INSERT INTO browser_sessions (id, desktop_id, url, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        url = excluded.url,
        title = excluded.title,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      session.id,
      session.desktopId,
      session.url,
      session.title ?? null,
      session.createdAt,
      session.updatedAt
    );
  }

  deleteBrowserSession(id: string): boolean {
    const res = this.db.prepare(`DELETE FROM browser_sessions WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  private rowToBrowserSession(r: any): BrowserSession {
    return {
      id: r.id,
      desktopId: r.desktop_id,
      url: r.url,
      title: r.title ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // Notes
  getNotes(workspaceId: string, desktopId: string): WorkspaceNote[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM workspace_notes WHERE workspace_id = ? AND desktop_id = ? ORDER BY updated_at DESC`
      )
      .all(workspaceId, desktopId) as any[];
    return rows.map((r) => this.rowToNote(r));
  }

  getNote(id: string): WorkspaceNote | null {
    const r = this.db.prepare(`SELECT * FROM workspace_notes WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return this.rowToNote(r);
  }

  saveNote(note: WorkspaceNote): void {
    const stmt = this.db.prepare(`
      INSERT INTO workspace_notes (id, workspace_id, desktop_id, title, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      note.id,
      note.workspaceId,
      note.desktopId,
      note.title,
      note.content,
      note.createdAt,
      note.updatedAt
    );
  }

  deleteNote(id: string): boolean {
    const res = this.db.prepare(`DELETE FROM workspace_notes WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  private rowToNote(r: any): WorkspaceNote {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      desktopId: r.desktop_id,
      title: r.title,
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // Kanban
  getKanbanTasks(workspaceId: string, desktopId: string): KanbanTask[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM kanban_tasks WHERE workspace_id = ? AND desktop_id = ? ORDER BY sort_order ASC, created_at ASC`
      )
      .all(workspaceId, desktopId) as any[];
    return rows.map((r) => this.rowToKanbanTask(r));
  }

  getKanbanTask(id: string): KanbanTask | null {
    const r = this.db.prepare(`SELECT * FROM kanban_tasks WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return this.rowToKanbanTask(r);
  }

  saveKanbanTask(task: KanbanTask): void {
    const stmt = this.db.prepare(`
      INSERT INTO kanban_tasks (
        id, workspace_id, desktop_id, column_name, title, description,
        linked_session_id, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        column_name = excluded.column_name,
        title = excluded.title,
        description = excluded.description,
        linked_session_id = excluded.linked_session_id,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      task.id,
      task.workspaceId,
      task.desktopId,
      task.column,
      task.title,
      task.description ?? null,
      task.linkedSessionId ?? null,
      task.sortOrder,
      task.createdAt,
      task.updatedAt
    );
  }

  deleteKanbanTask(id: string): boolean {
    const res = this.db.prepare(`DELETE FROM kanban_tasks WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  private rowToKanbanTask(r: any): KanbanTask {
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      desktopId: r.desktop_id,
      column: r.column_name as KanbanColumn,
      title: r.title,
      description: r.description ?? undefined,
      linkedSessionId: r.linked_session_id ?? undefined,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // Sync metadata
  getDeviceIdentity(): DeviceIdentity | null {
    const r = this.db.prepare(`SELECT * FROM device_identity LIMIT 1`).get() as any;
    if (!r) return null;
    return {
      deviceId: r.device_id,
      deviceName: r.device_name,
      platform: r.platform,
      createdAt: r.created_at
    };
  }

  saveDeviceIdentity(identity: DeviceIdentity): void {
    this.db.prepare(`DELETE FROM device_identity`).run();
    this.db
      .prepare(
        `INSERT INTO device_identity (device_id, device_name, platform, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(identity.deviceId, identity.deviceName, identity.platform, identity.createdAt);
  }

  getSyncPreferences(): SyncPreferences {
    const r = this.db.prepare(`SELECT * FROM sync_preferences WHERE id = 1`).get() as any;
    return {
      localOnlyMode: Boolean(r?.local_only_mode),
      autoSyncEnabled: Boolean(r?.auto_sync_enabled ?? true),
      relayUrl: r?.relay_url ?? undefined
    };
  }

  saveSyncPreferences(preferences: SyncPreferences): void {
    this.db
      .prepare(
        `UPDATE sync_preferences SET local_only_mode = ?, auto_sync_enabled = ?, relay_url = ? WHERE id = 1`
      )
      .run(
        preferences.localOnlyMode ? 1 : 0,
        preferences.autoSyncEnabled ? 1 : 0,
        preferences.relayUrl ?? null
      );
  }

  getSyncState(): { lastSyncedAt?: number; latestSnapshotVersion: number } {
    const r = this.db.prepare(`SELECT * FROM sync_state WHERE id = 1`).get() as any;
    return {
      lastSyncedAt: r?.last_synced_at ?? undefined,
      latestSnapshotVersion: r?.latest_snapshot_version ?? 0
    };
  }

  saveSyncState(lastSyncedAt: number, latestSnapshotVersion: number): void {
    this.db
      .prepare(
        `UPDATE sync_state SET last_synced_at = ?, latest_snapshot_version = ? WHERE id = 1`
      )
      .run(lastSyncedAt, latestSnapshotVersion);
  }

  getAccountSession(): AccountSession | null {
    const r = this.db.prepare(`SELECT * FROM account_session LIMIT 1`).get() as any;
    if (!r) return null;
    return {
      accountId: r.account_id,
      email: r.email,
      signedInAt: r.signed_in_at
    };
  }

  saveAccountSession(session: AccountSession): void {
    this.db.prepare(`DELETE FROM account_session`).run();
    this.db
      .prepare(
        `INSERT INTO account_session (account_id, email, signed_in_at) VALUES (?, ?, ?)`
      )
      .run(session.accountId, session.email, session.signedInAt);
  }

  clearAccountSession(): void {
    this.db.prepare(`DELETE FROM account_session`).run();
  }

  getSubscriptionEntitlement(): SubscriptionEntitlement | null {
    const r = this.db.prepare(`SELECT * FROM subscription_entitlement WHERE id = 1`).get() as any;
    if (!r) return null;
    return {
      plan: r.plan,
      deviceLimit: r.device_limit,
      expiresAt: r.expires_at,
      offlineLeaseUntil: r.offline_lease_until,
      cloudSnapshots: Boolean(r.cloud_snapshots),
      relayAccess: Boolean(r.relay_access)
    };
  }

  saveSubscriptionEntitlement(entitlement: SubscriptionEntitlement): void {
    this.db.prepare(`DELETE FROM subscription_entitlement`).run();
    this.db
      .prepare(
        `INSERT INTO subscription_entitlement (
          id, plan, device_limit, expires_at, offline_lease_until, cloud_snapshots, relay_access
        ) VALUES (1, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entitlement.plan,
        entitlement.deviceLimit,
        entitlement.expiresAt,
        entitlement.offlineLeaseUntil,
        entitlement.cloudSnapshots ? 1 : 0,
        entitlement.relayAccess ? 1 : 0
      );
  }

  clearSubscriptionEntitlement(): void {
    this.db.prepare(`DELETE FROM subscription_entitlement`).run();
  }

  isStripeEventProcessed(id: string): boolean {
    const row = this.db.prepare(`SELECT id FROM processed_stripe_events WHERE id = ?`).get(id);
    return Boolean(row);
  }

  recordStripeEvent(id: string, eventType: string): boolean {
    try {
      this.db
        .prepare(`INSERT INTO processed_stripe_events (id, event_type, processed_at) VALUES (?, ?, ?)`)
        .run(id, eventType, Date.now());
      return true;
    } catch {
      return false;
    }
  }

  listPairedDevices(): PairedDevice[] {
    const rows = this.db
      .prepare(`SELECT * FROM paired_devices ORDER BY paired_at ASC`)
      .all() as any[];
    return rows.map((r) => this.rowToPairedDevice(r));
  }

  getPairedDevice(deviceId: string): PairedDevice | null {
    const r = this.db
      .prepare(`SELECT * FROM paired_devices WHERE device_id = ?`)
      .get(deviceId) as any;
    return r ? this.rowToPairedDevice(r) : null;
  }

  savePairedDevice(device: PairedDevice): void {
    this.db
      .prepare(
        `INSERT INTO paired_devices (
          device_id, device_name, platform, paired_at, last_seen_at, trusted, revoked
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET
          device_name = excluded.device_name,
          platform = excluded.platform,
          paired_at = excluded.paired_at,
          last_seen_at = excluded.last_seen_at,
          trusted = excluded.trusted,
          revoked = excluded.revoked`
      )
      .run(
        device.deviceId,
        device.deviceName,
        device.platform,
        device.pairedAt,
        device.lastSeenAt ?? null,
        device.trusted ? 1 : 0,
        device.revoked ? 1 : 0
      );
  }

  revokePairedDevice(deviceId: string): void {
    this.db
      .prepare(`UPDATE paired_devices SET revoked = 1, trusted = 0 WHERE device_id = ?`)
      .run(deviceId);
  }

  savePairingCode(pairing: PairingCode): void {
    this.db
      .prepare(
        `INSERT INTO pairing_codes (code, device_id, device_name, platform, expires_at, approved)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           device_id = excluded.device_id,
           device_name = excluded.device_name,
           platform = excluded.platform,
           expires_at = excluded.expires_at,
           approved = excluded.approved`
      )
      .run(
        pairing.code,
        pairing.deviceId,
        pairing.deviceName,
        pairing.platform,
        pairing.expiresAt,
        pairing.approved ? 1 : 0
      );
  }

  getPairingCode(code: string): PairingCode | null {
    const r = this.db
      .prepare(`SELECT * FROM pairing_codes WHERE code = ?`)
      .get(code) as any;
    if (!r) return null;
    return this.rowToPairingCode(r);
  }

  markPairingCodeApproved(code: string): void {
    this.db.prepare(`UPDATE pairing_codes SET approved = 1 WHERE code = ?`).run(code);
  }

  deleteExpiredPairingCodes(now: number): void {
    this.db.prepare(`DELETE FROM pairing_codes WHERE expires_at < ?`).run(now);
  }

  private rowToPairedDevice(r: any): PairedDevice {
    return {
      deviceId: r.device_id,
      deviceName: r.device_name,
      platform: r.platform,
      pairedAt: r.paired_at,
      lastSeenAt: r.last_seen_at ?? undefined,
      trusted: Boolean(r.trusted),
      revoked: Boolean(r.revoked)
    };
  }

  private rowToPairingCode(r: any): PairingCode {
    return {
      code: r.code,
      deviceId: r.device_id,
      deviceName: r.device_name,
      platform: r.platform,
      expiresAt: r.expires_at,
      approved: Boolean(r.approved)
    };
  }

  listNotifications(limit: number, unreadOnly: boolean): AgenticNotification[] {
    const query = unreadOnly
      ? `SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC LIMIT ?`
      : `SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`;
    const rows = this.db.prepare(query).all(limit) as any[];
    return rows.map((r) => this.rowToNotification(r));
  }

  countUnreadNotifications(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as count FROM notifications WHERE read = 0`)
      .get() as { count: number };
    return row.count;
  }

  findRecentNotificationByDedupeKey(dedupeKey: string, since: number): AgenticNotification | null {
    const r = this.db
      .prepare(
        `SELECT * FROM notifications WHERE dedupe_key = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(dedupeKey, since) as any;
    return r ? this.rowToNotification(r) : null;
  }

  saveNotification(notification: AgenticNotification, dedupeKey: string): void {
    this.db
      .prepare(
        `INSERT INTO notifications (
          id, type, title, body, generic_push_body, session_id, desktop_id, workspace_id, dedupe_key, read, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        notification.id,
        notification.type,
        notification.title,
        notification.body,
        notification.genericPushBody,
        notification.sessionId ?? null,
        notification.desktopId ?? null,
        notification.workspaceId ?? null,
        dedupeKey,
        notification.read ? 1 : 0,
        notification.createdAt
      );
  }

  markNotificationRead(notificationId: string): AgenticNotification | null {
    this.db.prepare(`UPDATE notifications SET read = 1 WHERE id = ?`).run(notificationId);
    const r = this.db
      .prepare(`SELECT * FROM notifications WHERE id = ?`)
      .get(notificationId) as any;
    return r ? this.rowToNotification(r) : null;
  }

  markAllNotificationsRead(): number {
    const result = this.db.prepare(`UPDATE notifications SET read = 1 WHERE read = 0`).run();
    return result.changes;
  }

  dismissNotification(notificationId: string): boolean {
    const result = this.db.prepare(`DELETE FROM notifications WHERE id = ?`).run(notificationId);
    return result.changes > 0;
  }

  private rowToNotification(r: any): AgenticNotification {
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      genericPushBody: r.generic_push_body,
      sessionId: r.session_id ?? undefined,
      desktopId: r.desktop_id ?? undefined,
      workspaceId: r.workspace_id ?? undefined,
      read: Boolean(r.read),
      createdAt: r.created_at
    };
  }

  getAllNotes(): WorkspaceNote[] {
    const rows = this.db
      .prepare(`SELECT * FROM workspace_notes ORDER BY updated_at DESC`)
      .all() as any[];
    return rows.map((r) => this.rowToNote(r));
  }

  getAllKanbanTasks(): KanbanTask[] {
    const rows = this.db
      .prepare(`SELECT * FROM kanban_tasks ORDER BY updated_at DESC`)
      .all() as any[];
    return rows.map((r) => this.rowToKanbanTask(r));
  }

  getAllWindowLayouts(): WindowLayout[] {
    const rows = this.db.prepare(`SELECT * FROM window_layouts`).all() as any[];
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

  getAllBrowserSessions(): BrowserSession[] {
    const rows = this.db
      .prepare(`SELECT * FROM browser_sessions ORDER BY created_at ASC`)
      .all() as any[];
    return rows.map((r) => this.rowToBrowserSession(r));
  }

  getAllQueuedInstructions(): AgentInstruction[] {
    const rows = this.db
      .prepare(`SELECT * FROM instruction_queue WHERE status = 'queued' ORDER BY queued_at ASC`)
      .all() as any[];
    return rows.map((r) => this.rowToInstruction(r));
  }

  getAllDesktops(): Desktop[] {
    const rows = this.db
      .prepare(`SELECT * FROM desktops ORDER BY workspace_id ASC, sort_order ASC`)
      .all() as any[];
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      type: r.type as DesktopType,
      order: r.sort_order,
      createdAt: r.created_at
    }));
  }

  // HTTP Requests (API Client)
  listHttpRequests(workspaceId: string, desktopId: string): SavedHttpRequest[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM http_requests WHERE workspace_id = ? AND desktop_id = ? ORDER BY updated_at DESC, created_at DESC`
      )
      .all(workspaceId, desktopId) as any[];
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      desktopId: r.desktop_id,
      name: r.name,
      method: r.method,
      url: r.url,
      headers: JSON.parse(r.headers || '[]'),
      body: r.body || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  getHttpRequest(id: string): SavedHttpRequest | null {
    const r = this.db.prepare(`SELECT * FROM http_requests WHERE id = ?`).get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      workspaceId: r.workspace_id,
      desktopId: r.desktop_id,
      name: r.name,
      method: r.method,
      url: r.url,
      headers: JSON.parse(r.headers || '[]'),
      body: r.body || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  saveHttpRequest(req: SavedHttpRequest): void {
    const stmt = this.db.prepare(`
      INSERT INTO http_requests (id, workspace_id, desktop_id, name, method, url, headers, body, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        method = excluded.method,
        url = excluded.url,
        headers = excluded.headers,
        body = excluded.body,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      req.id,
      req.workspaceId,
      req.desktopId,
      req.name,
      req.method,
      req.url,
      JSON.stringify(req.headers || []),
      req.body || '',
      req.createdAt,
      req.updatedAt
    );
  }

  deleteHttpRequest(id: string): boolean {
    const res = this.db.prepare(`DELETE FROM http_requests WHERE id = ?`).run(id);
    return res.changes > 0;
  }

  listActivityEvents(query: ActivityEventQuery = {}): ActivityEvent[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.workspaceId) {
      conditions.push('(workspace_id = ? OR workspace_id IS NULL)');
      params.push(query.workspaceId);
    }
    if (query.desktopId) {
      conditions.push('(desktop_id = ? OR desktop_id IS NULL)');
      params.push(query.desktopId);
    }
    if (query.category) {
      conditions.push('category = ?');
      params.push(query.category);
    }
    if (query.severity) {
      conditions.push('severity = ?');
      params.push(query.severity);
    }
    if (query.search && query.search.trim()) {
      conditions.push('(title LIKE ? OR message LIKE ? OR metadata LIKE ?)');
      const term = `%${query.search.trim()}%`;
      params.push(term, term, term);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = query.limit && query.limit > 0 ? query.limit : 200;
    const offset = query.offset && query.offset > 0 ? query.offset : 0;

    const sql = `
      SELECT id, workspace_id, desktop_id, category, severity, title, message, metadata, created_at
      FROM activity_events
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      workspace_id: string | null;
      desktop_id: string | null;
      category: any;
      severity: any;
      title: string;
      message: string;
      metadata: string;
      created_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      desktopId: r.desktop_id,
      category: r.category,
      severity: r.severity,
      title: r.title,
      message: r.message,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      createdAt: r.created_at
    }));
  }

  recordActivityEvent(params: CreateActivityEventParams): ActivityEvent {
    const id = `act_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const createdAt = Date.now();
    const metaStr = params.metadata ? JSON.stringify(params.metadata) : '{}';

    const stmt = this.db.prepare(`
      INSERT INTO activity_events (id, workspace_id, desktop_id, category, severity, title, message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.workspaceId || null,
      params.desktopId || null,
      params.category,
      params.severity,
      params.title,
      params.message,
      metaStr,
      createdAt
    );

    return {
      id,
      workspaceId: params.workspaceId || null,
      desktopId: params.desktopId || null,
      category: params.category,
      severity: params.severity,
      title: params.title,
      message: params.message,
      metadata: params.metadata || null,
      createdAt
    };
  }

  clearActivityEvents(workspaceId?: string): boolean {
    if (workspaceId) {
      const res = this.db.prepare(`DELETE FROM activity_events WHERE workspace_id = ?`).run(workspaceId);
      return res.changes > 0;
    }
    const res = this.db.prepare(`DELETE FROM activity_events`).run();
    return res.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}

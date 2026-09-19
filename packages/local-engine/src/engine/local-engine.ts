import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { nanoid } from 'nanoid';
import path from 'node:path';
import os from 'node:os';
import {
  Workspace,
  Desktop,
  AgentSession,
  AgentInstruction,
  WindowLayout,
  DiscoveredCLI,
  AgentProvider,
  CreateWorkspaceParams,
  CreateDesktopParams,
  CreateAgentParams,
  SendPromptParams,
  PromptRouteResult,
  TerminalOutputEvent,
  AgentStatusChangedEvent,
  QueueUpdatedEvent,
  BrowserSession,
  BrowserSnapshot,
  BrowserCommandResultEvent,
  SpeakRequest,
  VoiceOption,
  SpeechModelStatus,
  FileEntry,
  FilePreview,
  GitStatusResult,
  GitDiffResult,
  GitCommitResult,
  GitPushResult,
  GitHubAuthStatus,
  CreatePullRequestResult,
  DevServerSession,
  DevServerLogEntry,
  StartDevServerParams,
  WorkspaceNote,
  CreateNoteParams,
  UpdateNoteParams,
  KanbanTask,
  CreateKanbanTaskParams,
  UpdateKanbanTaskParams,
  SyncStatus,
  CreateSyncSnapshotResult,
  RestoreSyncSnapshotResult,
  SyncSnapshotMeta,
  UpdateSyncPreferencesParams,
  ConnectRelayParams,
  RelayStatus,
  AccountStatus,
  SignInDevParams,
  RequestPairingParams,
  ApprovePairingParams,
  RevokeDeviceParams,
  PairingCode,
  AgenticNotification,
  ListNotificationsParams,
  MarkNotificationReadParams,
  DismissNotificationParams,
  UsageOverview,
  InstalledExtension,
  InstallExtensionParams,
  ExtensionWidgetDescriptor,
  PublishNotificationParams,
  SavedHttpRequest,
  CreateHttpRequestParams,
  UpdateHttpRequestParams,
  SendHttpRequestParams,
  HttpResponseResult,
  SqliteInspectResult,
  SqliteQueryResult,
  InspectSqliteParams,
  QuerySqliteParams,
  DesignOverview,
  ActivityEvent,
  CreateActivityEventParams,
  ActivityEventQuery
} from '@agentic/shared-contracts';
import * as speechService from './speech-service.js';
import * as speechModels from './speech-models.js';
import { BrowserToolService } from './browser-tool-service.js';
import { FileService } from './file-service.js';
import { GitService } from '../git/git-service.js';
import { GitHubService } from '../git/github-service.js';
import { DevServerService } from './dev-server-service.js';
import { NotesService } from './notes-service.js';
import { KanbanService } from './kanban-service.js';
import { HttpClientService } from './http-client-service.js';
import { DatabaseExplorerService } from './database-explorer-service.js';
import { DesignAssetsService } from './design-assets-service.js';
import { ActivityService } from './activity-service.js';
import { SyncService } from '../sync/sync-service.js';
import { RelayHostService } from '../relay/relay-host-service.js';
import { AccountService } from '../account/account-service.js';
import { NotificationService } from '../notifications/notification-service.js';
import { UsageService } from '../usage/usage-service.js';
import { ExtensionService } from '../extensions/extension-service.js';
import { EngineDatabase } from '../db/index.js';
import { CLIDiscoveryService } from '../discovery/cli-discovery.js';
import { GitWorktreeManager } from '../git/worktree-manager.js';
import { PTYManager } from './pty-manager.js';
import { InstructionQueueManager } from './instruction-queue.js';
import { PromptRouter } from './prompt-router.js';
import { generateAgentName } from './name-generator.js';

export interface EngineConfig {
  dbPath?: string;
  syncSnapshotDir?: string;
  relayUrl?: string;
  autoConnectRelay?: boolean;
}

export class LocalEngine extends EventEmitter {
  public db: EngineDatabase;
  public cliDiscovery: CLIDiscoveryService;
  public gitManager: GitWorktreeManager;
  public ptyManager: PTYManager;
  public queueManager: InstructionQueueManager;
  public browserTools: BrowserToolService;
  public fileService: FileService;
  public gitService: GitService;
  public githubService: GitHubService;
  public devServerService: DevServerService;
  public notesService: NotesService;
  public kanbanService: KanbanService;
  public httpClientService: HttpClientService;
  public databaseExplorerService: DatabaseExplorerService;
  public designAssetsService: DesignAssetsService;
  public activityService: ActivityService;
  public syncService: SyncService;
  public relayHost: RelayHostService;
  public accountService: AccountService;
  public notificationService: NotificationService;
  public usageService: UsageService;
  public extensionService: ExtensionService;
  private relayWasConnected = false;

  constructor(config: EngineConfig = {}) {
    super();
    const defaultDbPath =
      config.dbPath || path.join(os.homedir(), '.agentic', 'data', 'agentic.db');
    this.db = new EngineDatabase(defaultDbPath);
    this.cliDiscovery = new CLIDiscoveryService();
    this.gitManager = new GitWorktreeManager();
    this.ptyManager = new PTYManager();
    this.queueManager = new InstructionQueueManager(this.db);
    this.browserTools = new BrowserToolService(this.db);
    this.fileService = new FileService(this.db);
    this.gitService = new GitService(this.fileService);
    this.githubService = new GitHubService(this.fileService);
    this.devServerService = new DevServerService();
    this.notesService = new NotesService(this.db);
    this.kanbanService = new KanbanService(this.db);
    this.httpClientService = new HttpClientService();
    this.databaseExplorerService = new DatabaseExplorerService();
    this.designAssetsService = new DesignAssetsService();
    this.activityService = new ActivityService(this.db);
    this.relayHost = new RelayHostService(this.db, this.ptyManager);
    this.syncService = new SyncService(this.db, {
      snapshotDir: config.syncSnapshotDir,
      getRelayStatus: () => this.relayHost.getStatus()
    });
    this.accountService = new AccountService(this.db);
    this.notificationService = new NotificationService(this.db);
    this.usageService = new UsageService(this.db);
    this.extensionService = new ExtensionService();

    this.wireEvents();
    this.reconcileInterruptedSessions();

    if (config.autoConnectRelay !== false) {
      void this.maybeAutoConnectRelay(config.relayUrl);
    }
  }

  private async maybeAutoConnectRelay(configRelayUrl?: string): Promise<void> {
    const preferences = this.db.getSyncPreferences();
    if (preferences.localOnlyMode) return;

    const relayUrl =
      configRelayUrl ?? preferences.relayUrl ?? process.env.AGENTIC_RELAY_URL;
    if (!relayUrl) return;

    try {
      await this.connectRelay({ relayUrl });
    } catch {
      // Relay is optional during startup.
    }
  }

  private reconcileInterruptedSessions(): void {
    const sessions = this.db.getAllAgentSessions();

    for (const session of sessions) {
      if (session.status === 'terminated') continue;
      if (this.ptyManager.hasSession(session.id)) continue;

      session.status = 'interrupted';
      session.updatedAt = Date.now();
      this.db.saveAgentSession(session);

      this.emit('status_changed', {
        sessionId: session.id,
        status: 'interrupted',
        timestamp: Date.now()
      });
    }
  }

  private wireEvents(): void {
    this.ptyManager.on('terminal_output', (event: TerminalOutputEvent) => {
      this.emit('terminal_output', event);
    });

    this.activityService.on('activity_event', (event) => {
      this.emit('activity_event', event);
    });

    this.ptyManager.on('status_changed', (event: AgentStatusChangedEvent) => {
      try {
        const session = this.db.getAgentSession(event.sessionId);
        const previousStatus = session?.status;

        if (session) {
          session.status = event.status;
          session.updatedAt = Date.now();
          this.db.saveAgentSession(session);
        }

        const sev =
          event.status === 'interrupted'
            ? 'warn'
            : event.status === 'awaiting_approval'
              ? 'warn'
              : 'info';
        this.activityService.logAgent(
          `Agent ${session?.name || event.sessionId} is ${event.status}`,
          `Status transitioned from ${previousStatus || 'unknown'} to ${event.status}`,
          { sessionId: event.sessionId, status: event.status, previousStatus },
          sev,
          session?.workspaceId,
          session?.desktopId
        );

        const notification = this.notificationService.handleAgentStatusChange(
          event.sessionId,
          event.status,
          previousStatus
        );
        if (notification) {
          this.emit('notification_created', notification);
        }

        this.emit('status_changed', event);

        // If agent transitioned to idle, check if there is a queued instruction to dispatch
        if (event.status === 'idle') {
          const next = this.queueManager.getNext(event.sessionId);
          if (next) {
            this.queueManager.markDelivered(next.id, event.sessionId);
            this.ptyManager.sendInput(event.sessionId, next.prompt + '\n');
          }
        }
      } catch {
        // Engine is shutting down or database is closed
      }
    });

    this.queueManager.on('queue_updated', (event: QueueUpdatedEvent) => {
      this.emit('queue_updated', event);
    });

    this.browserTools.on('browser_command', (event) => {
      this.emit('browser_command', event);
    });

    this.devServerService.on('dev_server_log', (event) => {
      this.emit('dev_server_log', event);
    });

    this.devServerService.on('dev_server_status', (event) => {
      const session = this.devServerService.getSession(event.sessionId);
      const devSev =
        event.status === 'crashed'
          ? 'error'
          : event.status === 'running'
            ? 'success'
            : 'info';
      this.activityService.logDevServer(
        `Dev Server "${session?.name || event.sessionId}" ${event.status}`,
        `Port: ${session?.port || 'auto'}, Status: ${event.status}`,
        { sessionId: event.sessionId, status: event.status, port: session?.port },
        devSev,
        session?.desktopId
      );

      const notification = this.notificationService.handleDevServerStatus(
        event.sessionId,
        event.status,
        session?.name ?? 'Dev server',
        session?.desktopId
      );
      if (notification) {
        this.emit('notification_created', notification);
      }
      this.emit('dev_server_status', event);
    });

    this.relayHost.on('state', (state) => {
      if (state.connectionState === 'connected') {
        this.relayWasConnected = true;
        return;
      }
      if (this.relayWasConnected && state.connectionState === 'offline') {
        this.relayWasConnected = false;
        const notification = this.notificationService.handleRelayDisconnected();
        if (notification) {
          this.emit('notification_created', notification);
        }
      }
    });

    this.relayHost.wireTerminalEvents(
      (listener) => this.on('terminal_output', listener),
      (listener) => this.on('status_changed', listener)
    );
  }

  // Workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    let list = this.db.getWorkspaces();
    if (list.length === 0) {
      // Seed default initial workspace
      const defaultWs = await this.createWorkspace({
        name: 'Default Workspace',
        icon: 'folder'
      });
      list = [defaultWs];
    }
    return list;
  }

  async createWorkspace(params: CreateWorkspaceParams): Promise<Workspace> {
    const wsId = nanoid();
    const now = Date.now();

    // Default desktops for every new workspace: Build, Design, Research, Review
    const buildDesktopId = nanoid();
    const defaultDesktops: Desktop[] = [
      { id: buildDesktopId, workspaceId: wsId, name: 'Build', type: 'build', order: 0, createdAt: now },
      { id: nanoid(), workspaceId: wsId, name: 'Design', type: 'design', order: 1, createdAt: now + 1 },
      { id: nanoid(), workspaceId: wsId, name: 'Research', type: 'research', order: 2, createdAt: now + 2 },
      { id: nanoid(), workspaceId: wsId, name: 'Review', type: 'review', order: 3, createdAt: now + 3 }
    ];

    const workspace: Workspace = {
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

  async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace> {
    const ws = this.db.getWorkspace(id);
    if (!ws) throw new Error(`Workspace ${id} not found.`);
    const updated: Workspace = { ...ws, ...updates, updatedAt: Date.now() };
    this.db.saveWorkspace(updated);
    return updated;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    return this.db.deleteWorkspace(id);
  }

  // Desktops
  async getDesktops(workspaceId: string): Promise<Desktop[]> {
    return this.db.getDesktops(workspaceId);
  }

  async createDesktop(params: CreateDesktopParams): Promise<Desktop> {
    const desktops = this.db.getDesktops(params.workspaceId);
    const desktop: Desktop = {
      id: nanoid(),
      workspaceId: params.workspaceId,
      name: params.name,
      type: params.type || 'custom',
      order: desktops.length,
      createdAt: Date.now()
    };
    this.db.saveDesktop(desktop);
    return desktop;
  }

  async renameDesktop(id: string, name: string): Promise<Desktop> {
    const desktop = this.db.getDesktop(id);
    if (!desktop) throw new Error(`Desktop ${id} not found.`);
    const updated: Desktop = { ...desktop, name: name.trim() };
    this.db.saveDesktop(updated);
    return updated;
  }

  async deleteDesktop(id: string): Promise<boolean> {
    return this.db.deleteDesktop(id);
  }

  // CLI Discovery
  async getDiscoveredCLIs(): Promise<DiscoveredCLI[]> {
    const cached = this.cliDiscovery.getCached();
    if (cached) return cached;

    const stored = this.db.getCLIIntegrations();
    if (stored.length > 0) {
      this.cliDiscovery.setCache(stored);
      return stored;
    }

    return this.refreshCLIs();
  }

  async rescanCLIs(): Promise<DiscoveredCLI[]> {
    return this.refreshCLIs();
  }

  async setManualCLIPath(
    provider: AgentProvider,
    executablePath: string | null
  ): Promise<DiscoveredCLI[]> {
    if (executablePath === null || executablePath.trim() === '') {
      this.db.clearManualCLIPath(provider);
      return this.refreshCLIs();
    }

    const resolved = path.resolve(executablePath.trim());
    if (!fs.existsSync(resolved)) {
      throw new Error(`Executable not found: ${resolved}`);
    }

    const manualPaths = { ...this.db.getManualCLIPaths(), [provider]: resolved };
    return this.refreshCLIs(manualPaths);
  }

  private async refreshCLIs(
    manualPaths?: Partial<Record<AgentProvider, string>>
  ): Promise<DiscoveredCLI[]> {
    const paths = manualPaths ?? this.db.getManualCLIPaths();
    const discovered = await this.cliDiscovery.scan(paths);

    for (const cli of discovered) {
      const isManual = Boolean(paths[cli.provider]);
      this.db.saveCLIIntegration(cli, isManual);
    }

    this.cliDiscovery.setCache(discovered);
    return discovered;
  }

  // Agent Sessions
  async getAgentSessions(workspaceId: string): Promise<AgentSession[]> {
    return this.db.getAgentSessions(workspaceId);
  }

  async createAgentSession(params: CreateAgentParams): Promise<AgentSession> {
    const existing = this.db.getAgentSessions(params.workspaceId);
    const agentName = params.name || generateAgentName(existing.map((s) => s.name));
    const sessionId = nanoid();

    let worktreePath: string | undefined;
    let branchName: string | undefined;

    // Isolate in a git worktree if repoPath is provided
    if (params.repoPath) {
      const repoCheck = await this.gitManager.checkRepo(params.repoPath);
      if (!repoCheck.isGit) {
        throw new Error(`Repository path is not a git repository: ${params.repoPath}`);
      }
      if (!repoCheck.hasCommits) {
        throw new Error(
          'Repository must have at least one commit before creating an isolated worktree.'
        );
      }

      const wt = await this.gitManager.createWorktree(params.repoPath, agentName, sessionId);
      worktreePath = wt.worktreePath;
      branchName = wt.branchName;
    }

    const session: AgentSession = {
      id: sessionId,
      name: agentName,
      provider: params.provider,
      workspaceId: params.workspaceId,
      desktopId: params.desktopId,
      repoPath: params.repoPath,
      worktreePath,
      branchName,
      status: 'working',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.db.saveAgentSession(session);

    // Determine executable command
    const clis = await this.getDiscoveredCLIs();
    const discovered = clis.find((c) => c.provider === params.provider && c.isAvailable);

    const cwd = worktreePath || params.repoPath || process.env.HOME || '/';
    const command = discovered?.executablePath || process.env.SHELL || '/bin/zsh';
    const args = discovered ? [] : ['-i'];

    await this.ptyManager.spawn({
      sessionId,
      command,
      args,
      cwd
    });

    return session;
  }

  async renameAgentSession(sessionId: string, newName: string): Promise<AgentSession> {
    const session = this.db.getAgentSession(sessionId);
    if (!session) throw new Error(`Agent session ${sessionId} not found.`);
    session.name = newName;
    session.updatedAt = Date.now();
    this.db.saveAgentSession(session);
    return session;
  }

  async terminateAgentSession(sessionId: string): Promise<boolean> {
    this.ptyManager.kill(sessionId);
    const session = this.db.getAgentSession(sessionId);
    if (session) {
      session.status = 'terminated';
      session.updatedAt = Date.now();
      this.db.saveAgentSession(session);

      // Clean up worktree if one was allocated
      if (session.repoPath && session.worktreePath) {
        try {
          await this.gitManager.removeWorktree(session.repoPath, session.worktreePath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    return true;
  }

  async sendPrompt(params: SendPromptParams): Promise<PromptRouteResult> {
    const activeSessions = this.db
      .getAgentSessions(params.workspaceId)
      .filter((s) => s.status !== 'terminated');

    if (params.targetSessionId) {
      const targetSession = activeSessions.find((s) => s.id === params.targetSessionId);
      if (!targetSession) {
        return {
          action: 'ambiguous',
          message: 'The selected agent session is no longer active.'
        };
      }

      const { instruction } = PromptRouter.parsePrompt(params.prompt);
      const promptText = instruction || params.prompt;
      const isWorking = this.ptyManager.getStatus(targetSession.id) === 'working';

      if (isWorking) {
        const queuedItem = this.queueManager.enqueue(targetSession.id, promptText);
        return {
          action: 'queued_for_active',
          sessionId: targetSession.id,
          agentName: targetSession.name,
          instructionId: queuedItem.id,
          message: `Queued follow-up instruction for ${targetSession.name}`
        };
      }

      this.ptyManager.sendInput(targetSession.id, promptText + '\n');
      return {
        action: 'sent_to_active',
        sessionId: targetSession.id,
        agentName: targetSession.name,
        message: `Delivered instruction directly to ${targetSession.name}`
      };
    }

    // Route prompt
    const routeResult = await PromptRouter.route({
      prompt: params.prompt,
      activeSessions,
      ptyManager: this.ptyManager,
      queueManager: this.queueManager
    });

    if (routeResult.action === 'spawned_new_agent') {
      // Find workspace and active desktop
      const ws = this.db.getWorkspace(params.workspaceId);
      const desktops = this.db.getDesktops(params.workspaceId);
      const desktopId =
        params.desktopId || ws?.activeDesktopId || desktops[0]?.id || 'default';

      const provider = params.fallbackProvider || 'claude';
      const repoPath = params.repoPath || ws?.repositories[0];

      const newSession = await this.createAgentSession({
        workspaceId: params.workspaceId,
        desktopId,
        provider,
        repoPath
      });

      // Send initial instruction after spawn
      setTimeout(() => {
        if (this.ptyManager.hasSession(newSession.id)) {
          this.ptyManager.sendInput(newSession.id, params.prompt + '\n');
        }
      }, 500);

      return {
        action: 'spawned_new_agent',
        sessionId: newSession.id,
        agentName: newSession.name,
        message: `Created agent ${newSession.name} (${provider}) and delivered prompt`
      };
    }

    return routeResult;
  }

  async interruptAgent(sessionId: string): Promise<boolean> {
    this.ptyManager.interrupt(sessionId);
    return true;
  }

  async cancelInstruction(instructionId: string): Promise<boolean> {
    return this.queueManager.cancelById(instructionId);
  }

  async editInstruction(
    instructionId: string,
    newPrompt: string
  ): Promise<AgentInstruction | null> {
    return this.queueManager.edit(instructionId, newPrompt);
  }

  async getAgentQueue(sessionId: string): Promise<AgentInstruction[]> {
    return this.queueManager.getQueue(sessionId);
  }

  // Terminal PTY
  async sendTerminalInput(sessionId: string, data: string): Promise<void> {
    this.ptyManager.sendInput(sessionId, data);
  }

  async resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void> {
    this.ptyManager.resize(sessionId, cols, rows);
  }

  // Window Layouts
  async getWindowLayouts(desktopId: string): Promise<WindowLayout[]> {
    return this.db.getWindowLayouts(desktopId);
  }

  async saveWindowLayout(layout: WindowLayout): Promise<void> {
    this.db.saveWindowLayout(layout);
  }

  // Git repo helpers
  async checkGitRepo(dirPath: string): Promise<{ isGit: boolean; hasCommits: boolean; headCommit?: string }> {
    return this.gitManager.checkRepo(dirPath);
  }

  async initGitRepo(dirPath: string): Promise<{ success: boolean; headCommit: string }> {
    return this.gitManager.initRepo(dirPath);
  }

  // Files
  async listDirectory(workspaceId: string, dirPath: string): Promise<FileEntry[]> {
    return this.fileService.listDirectory(workspaceId, dirPath);
  }

  async readTextFile(workspaceId: string, filePath: string): Promise<FilePreview> {
    return this.fileService.readTextFile(workspaceId, filePath);
  }

  async writeTextFile(workspaceId: string, filePath: string, content: string): Promise<void> {
    return this.fileService.writeTextFile(workspaceId, filePath, content);
  }

  // Source control
  async getGitStatus(workspaceId: string, repoPath: string): Promise<GitStatusResult> {
    return this.gitService.getStatus(workspaceId, repoPath);
  }

  async getGitDiff(
    workspaceId: string,
    repoPath: string,
    filePath: string,
    staged?: boolean
  ): Promise<GitDiffResult> {
    return this.gitService.getDiff(workspaceId, repoPath, filePath, staged);
  }

  async stageGitFiles(
    workspaceId: string,
    repoPath: string,
    paths: string[]
  ): Promise<GitStatusResult> {
    return this.gitService.stageFiles(workspaceId, repoPath, paths);
  }

  async unstageGitFiles(
    workspaceId: string,
    repoPath: string,
    paths: string[]
  ): Promise<GitStatusResult> {
    return this.gitService.unstageFiles(workspaceId, repoPath, paths);
  }

  async commitGit(
    workspaceId: string,
    repoPath: string,
    message: string
  ): Promise<GitCommitResult> {
    return this.gitService.commit(workspaceId, repoPath, message);
  }

  async pushGit(workspaceId: string, repoPath: string): Promise<GitPushResult> {
    return this.gitService.push(workspaceId, repoPath);
  }

  async getGitHubAuthStatus(): Promise<GitHubAuthStatus> {
    return this.githubService.getAuthStatus();
  }

  async createPullRequest(
    workspaceId: string,
    repoPath: string,
    options: { title: string; body?: string; base?: string; draft?: boolean }
  ): Promise<CreatePullRequestResult> {
    return this.githubService.createPullRequest(workspaceId, repoPath, options);
  }

  async getDevServerSessions(desktopId: string): Promise<DevServerSession[]> {
    return this.devServerService.getSessions(desktopId);
  }

  async startDevServer(params: StartDevServerParams): Promise<DevServerSession> {
    return this.devServerService.startServer(params);
  }

  async stopDevServer(sessionId: string): Promise<boolean> {
    return this.devServerService.stopServer(sessionId);
  }

  async getDevServerLogs(sessionId: string): Promise<DevServerLogEntry[]> {
    return this.devServerService.getLogs(sessionId);
  }

  listNotes(workspaceId: string, desktopId: string): WorkspaceNote[] {
    return this.notesService.listNotes(workspaceId, desktopId);
  }

  createNote(params: CreateNoteParams): WorkspaceNote {
    return this.notesService.createNote(params);
  }

  updateNote(params: UpdateNoteParams): WorkspaceNote {
    return this.notesService.updateNote(params);
  }

  deleteNote(noteId: string): boolean {
    return this.notesService.deleteNote(noteId);
  }

  listKanbanTasks(workspaceId: string, desktopId: string): KanbanTask[] {
    return this.kanbanService.listTasks(workspaceId, desktopId);
  }

  createKanbanTask(params: CreateKanbanTaskParams): KanbanTask {
    return this.kanbanService.createTask(params);
  }

  updateKanbanTask(params: UpdateKanbanTaskParams): KanbanTask {
    return this.kanbanService.updateTask(params);
  }

  deleteKanbanTask(taskId: string): boolean {
    return this.kanbanService.deleteTask(taskId);
  }

  getSyncStatus(): SyncStatus {
    return this.syncService.getSyncStatus();
  }

  updateSyncPreferences(params: UpdateSyncPreferencesParams): SyncStatus {
    return this.syncService.updatePreferences(params);
  }

  createSyncSnapshot(): CreateSyncSnapshotResult {
    return this.syncService.createSnapshot();
  }

  listSyncSnapshots(): SyncSnapshotMeta[] {
    return this.syncService.listSnapshots();
  }

  restoreLatestSyncSnapshot(): RestoreSyncSnapshotResult {
    return this.syncService.restoreLatestSnapshot();
  }

  getRecoveryKey(): string {
    return this.syncService.getRecoveryKey();
  }

  async connectRelay(params: ConnectRelayParams = {}): Promise<RelayStatus> {
    const preferences = this.db.getSyncPreferences();
    if (preferences.localOnlyMode) {
      throw new Error('Local-only mode is enabled. Disable it before connecting to relay.');
    }

    const relayUrl = params.relayUrl ?? preferences.relayUrl ?? process.env.AGENTIC_RELAY_URL;
    if (!relayUrl) {
      throw new Error('Relay URL is required. Set AGENTIC_RELAY_URL or pass relayUrl.');
    }

    const device = this.syncService.ensureDeviceIdentity();
    this.accountService.assertCanUseRelay(device.deviceId);
    this.accountService.touchDevice(device.deviceId);
    const status = await this.relayHost.connect(relayUrl, device);

    this.db.saveSyncPreferences({
      ...preferences,
      relayUrl
    });

    return status;
  }

  disconnectRelay(): RelayStatus {
    return this.relayHost.disconnect();
  }

  getRelayStatus(): RelayStatus {
    return this.relayHost.getStatus();
  }

  getAccountStatus(): AccountStatus {
    const device = this.syncService.ensureDeviceIdentity();
    return this.accountService.getAccountStatus(device.deviceId);
  }

  signInDev(params: SignInDevParams): AccountStatus {
    const device = this.syncService.ensureDeviceIdentity();
    return this.accountService.signInDev(params, device);
  }

  signOutAccount(): AccountStatus {
    const device = this.syncService.ensureDeviceIdentity();
    return this.accountService.signOut(device.deviceId);
  }

  requestPairing(params: RequestPairingParams): PairingCode {
    return this.accountService.requestPairing(params);
  }

  approvePairing(params: ApprovePairingParams): AccountStatus {
    const device = this.syncService.ensureDeviceIdentity();
    return this.accountService.approvePairing(params, device.deviceId);
  }

  revokePairedDevice(params: RevokeDeviceParams): AccountStatus {
    const device = this.syncService.ensureDeviceIdentity();
    return this.accountService.revokeDevice(params, device.deviceId);
  }

  listNotifications(params: ListNotificationsParams = {}): AgenticNotification[] {
    return this.notificationService.listNotifications(params);
  }

  getUnreadNotificationCount(): number {
    return this.notificationService.getUnreadCount();
  }

  markNotificationRead(params: MarkNotificationReadParams): AgenticNotification | null {
    return this.notificationService.markRead(params.notificationId);
  }

  markAllNotificationsRead(): number {
    return this.notificationService.markAllRead();
  }

  dismissNotification(params: DismissNotificationParams): boolean {
    return this.notificationService.dismiss(params.notificationId);
  }

  async getUsageOverview(): Promise<UsageOverview> {
    return this.usageService.getUsageOverview();
  }

  listInstalledExtensions(): InstalledExtension[] {
    return this.extensionService.listInstalled();
  }

  installExtension(params: InstallExtensionParams): InstalledExtension {
    return this.extensionService.installFromPath(params);
  }

  getExtensionWidgets(httpBaseUrl?: string): ExtensionWidgetDescriptor[] {
    return this.extensionService.getWidgetDescriptors(httpBaseUrl);
  }

  publishNotification(params: PublishNotificationParams): boolean {
    const notification = this.notificationService.record({
      type: params.type ?? 'completion',
      title: params.title,
      body: params.body,
      genericPushBody: params.genericPushBody ?? params.title,
      dedupeKey: params.dedupeKey ?? `publish:${params.title}:${params.body}`
    });
    if (notification) {
      this.emit('notification_created', notification);
      return true;
    }
    return false;
  }

  // Browser
  async getBrowserSessions(desktopId: string): Promise<BrowserSession[]> {
    return this.browserTools.getSessions(desktopId);
  }

  async createBrowserSession(desktopId: string, url?: string): Promise<BrowserSession> {
    return this.browserTools.createSession(desktopId, url);
  }

  async closeBrowserSession(sessionId: string): Promise<boolean> {
    return this.browserTools.closeSession(sessionId);
  }

  async updateBrowserSession(
    sessionId: string,
    updates: { url?: string; title?: string }
  ): Promise<BrowserSession> {
    return this.browserTools.updateSession(sessionId, updates);
  }

  async browserNavigate(sessionId: string, url: string): Promise<BrowserSnapshot> {
    return this.browserTools.navigate(sessionId, url);
  }

  async browserSnapshot(sessionId: string): Promise<BrowserSnapshot> {
    return this.browserTools.snapshot(sessionId);
  }

  async submitBrowserCommandResult(result: BrowserCommandResultEvent): Promise<void> {
    this.browserTools.submitResult(result);
  }

  // Speech
  async setAgentVoice(sessionId: string, voiceId: string | null): Promise<AgentSession> {
    const session = this.db.getAgentSession(sessionId);
    if (!session) throw new Error(`Agent session ${sessionId} not found.`);
    session.voice = voiceId || undefined;
    session.updatedAt = Date.now();
    this.db.saveAgentSession(session);
    return session;
  }

  async getMacOSVoices(): Promise<VoiceOption[]> {
    return speechService.listMacOSVoices();
  }

  async speakText(request: SpeakRequest): Promise<void> {
    return speechService.speakWithMacOS(request);
  }

  async stopSpeech(): Promise<void> {
    return speechService.stopMacOSSpeech();
  }

  async listSpeechModels(): Promise<SpeechModelStatus[]> {
    return speechModels.listSpeechModels();
  }

  async downloadSpeechModel(modelId: string): Promise<SpeechModelStatus> {
    return speechModels.downloadSpeechModel(modelId);
  }

  // API Client
  async listHttpRequests(workspaceId: string, desktopId: string): Promise<SavedHttpRequest[]> {
    return this.db.listHttpRequests(workspaceId, desktopId);
  }

  async createHttpRequest(params: CreateHttpRequestParams): Promise<SavedHttpRequest> {
    const item: SavedHttpRequest = {
      id: nanoid(),
      workspaceId: params.workspaceId,
      desktopId: params.desktopId,
      name: params.name || 'New Request',
      method: params.method || 'GET',
      url: params.url || '',
      headers: params.headers || [],
      body: params.body || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.db.saveHttpRequest(item);
    return item;
  }

  async updateHttpRequest(params: UpdateHttpRequestParams): Promise<SavedHttpRequest> {
    const existing = this.db.getHttpRequest(params.requestId);
    if (!existing) {
      throw new Error(`HTTP request ${params.requestId} not found.`);
    }
    const updated: SavedHttpRequest = {
      ...existing,
      name: params.name ?? existing.name,
      method: params.method ?? existing.method,
      url: params.url ?? existing.url,
      headers: params.headers ?? existing.headers,
      body: params.body !== undefined ? params.body : existing.body,
      updatedAt: Date.now()
    };
    this.db.saveHttpRequest(updated);
    return updated;
  }

  async deleteHttpRequest(requestId: string): Promise<boolean> {
    return this.db.deleteHttpRequest(requestId);
  }

  async sendHttpRequest(params: SendHttpRequestParams): Promise<HttpResponseResult> {
    const result = await this.httpClientService.sendRequest(params);
    this.activityService.logNetwork(
      `${params.method} ${params.url}`,
      `Response: ${result.status} ${result.statusText} (${result.durationMs}ms)`,
      {
        method: params.method,
        url: params.url,
        status: result.status,
        durationMs: result.durationMs,
        headersCount: Object.keys(result.headers || {}).length
      },
      result.ok ? 'success' : 'warn'
    );
    return result;
  }

  // Database Explorer
  async listWorkspaceDatabases(workspaceId: string): Promise<string[]> {
    const workspace = this.db.getWorkspace(workspaceId);
    const repoPaths = workspace ? workspace.repositories : [];
    return this.databaseExplorerService.listDatabases(repoPaths);
  }

  async inspectSqliteDatabase(params: InspectSqliteParams): Promise<SqliteInspectResult> {
    return this.databaseExplorerService.inspectDatabase(params.filePath);
  }

  async querySqliteDatabase(params: QuerySqliteParams): Promise<SqliteQueryResult> {
    const result = await this.databaseExplorerService.queryDatabase(params.filePath, params.sql);
    this.activityService.logDatabase(
      'SQL Query Executed',
      params.sql.slice(0, 100),
      {
        dbPath: params.filePath,
        sql: params.sql,
        rowsCount: result.rows.length,
        truncated: result.truncated
      },
      result.error ? 'error' : 'info',
      params.workspaceId
    );
    return result;
  }

  // Design & Assets
  async getDesignOverview(workspaceId: string): Promise<DesignOverview> {
    const workspace = this.db.getWorkspace(workspaceId);
    const repoPaths = workspace ? workspace.repositories : [];
    return this.designAssetsService.getOverview(repoPaths);
  }

  async readAssetContent(filePath: string): Promise<{ dataUrl: string; text?: string }> {
    return this.designAssetsService.readAsset(filePath);
  }

  // Activity & Audit Logs
  listActivityEvents(query?: ActivityEventQuery): ActivityEvent[] {
    return this.activityService.listEvents(query);
  }

  logActivityEvent(params: CreateActivityEventParams): ActivityEvent {
    return this.activityService.recordEvent(params);
  }

  clearActivityEvents(workspaceId?: string): boolean {
    return this.activityService.clearEvents(workspaceId);
  }
}

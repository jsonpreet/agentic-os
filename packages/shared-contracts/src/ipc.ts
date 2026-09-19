import { Workspace, Desktop, WindowLayout } from './workspace.js';
import { AgentSession, AgentInstruction, AgentProvider } from './agent.js';
import { DiscoveredCLI } from './cli.js';
import {
  BrowserSession,
  BrowserSnapshot,
  BrowserCommandEvent,
  BrowserCommandResultEvent
} from './browser.js';
import { SpeakRequest, SpeechModelStatus, VoiceOption } from './speech.js';
import { FileEntry, FilePreview } from './files.js';
import {
  GitStatusResult,
  GitDiffResult,
  GitCommitResult,
  GitPushResult
} from './git.js';
import {
  GitHubAuthStatus,
  CreatePullRequestResult
} from './github.js';
import {
  DevServerSession,
  DevServerLogEntry,
  DevServerLogEvent,
  DevServerStatusEvent,
  StartDevServerParams
} from './dev-servers.js';
import {
  WorkspaceNote,
  CreateNoteParams,
  UpdateNoteParams
} from './notes.js';
import {
  KanbanTask,
  CreateKanbanTaskParams,
  UpdateKanbanTaskParams
} from './kanban.js';
import {
  SyncStatus,
  CreateSyncSnapshotResult,
  RestoreSyncSnapshotResult,
  SyncSnapshotMeta,
  UpdateSyncPreferencesParams
} from './sync.js';
import { ConnectRelayParams, RelayStatus } from './relay.js';
import {
  AccountStatus,
  SignInDevParams,
  RequestPairingParams,
  ApprovePairingParams,
  RevokeDeviceParams,
  PairingCode,
  StripeWebhookPayload,
  StripeWebhookResult
} from './account.js';
import {
  AgenticNotification,
  ListNotificationsParams,
  MarkNotificationReadParams,
  DismissNotificationParams
} from './notifications.js';
import { UsageOverview } from './usage.js';
import {
  InstalledExtension,
  InstallExtensionParams,
  ExtensionWidgetDescriptor
} from './extension.js';
import { PublishNotificationParams } from './extension-sdk.js';
import {
  SavedHttpRequest,
  CreateHttpRequestParams,
  UpdateHttpRequestParams,
  SendHttpRequestParams,
  HttpResponseResult
} from './http-client.js';
import {
  SqliteInspectResult,
  SqliteQueryResult,
  InspectSqliteParams,
  QuerySqliteParams
} from './database.js';
import { DesignOverview } from './design-assets.js';
import {
  ActivityEvent,
  CreateActivityEventParams,
  ActivityEventQuery
} from './activity.js';
import { TerminalOutputEvent, AgentStatusChangedEvent, QueueUpdatedEvent, ApprovalRequestedEvent } from './events.js';

export type AppCommandType =
  | 'switch_desktop'
  | 'open_browser'
  | 'open_files'
  | 'open_editor'
  | 'open_source_control'
  | 'open_dev_servers'
  | 'open_notes'
  | 'open_kanban'
  | 'open_api_client'
  | 'open_database'
  | 'open_design'
  | 'open_activity_logs'
  | 'focus_agent';

export interface CreateWorkspaceParams {
  name: string;
  icon?: string;
  repositories?: string[];
}

export interface CreateDesktopParams {
  workspaceId: string;
  name: string;
  type?: 'build' | 'design' | 'research' | 'review' | 'custom';
}

export interface CreateAgentParams {
  workspaceId: string;
  desktopId: string;
  name?: string;
  provider: AgentProvider;
  repoPath?: string;
}

export interface SendPromptParams {
  workspaceId: string;
  prompt: string;
  targetSessionId?: string;
  fallbackProvider?: AgentProvider;
  repoPath?: string;
  desktopId?: string;
}

export interface PromptRouteResult {
  action: 'sent_to_active' | 'queued_for_active' | 'spawned_new_agent' | 'app_command' | 'ambiguous';
  sessionId?: string;
  agentName?: string;
  instructionId?: string;
  desktopName?: string;
  browserUrl?: string;
  appCommand?: AppCommandType;
  message?: string;
}

export interface AgenticApi {
  // Workspaces
  getWorkspaces(): Promise<Workspace[]>;
  createWorkspace(params: CreateWorkspaceParams): Promise<Workspace>;
  updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace>;
  deleteWorkspace(id: string): Promise<boolean>;

  // Desktops
  getDesktops(workspaceId: string): Promise<Desktop[]>;
  createDesktop(params: CreateDesktopParams): Promise<Desktop>;
  renameDesktop(id: string, name: string): Promise<Desktop>;
  deleteDesktop(id: string): Promise<boolean>;

  // CLI Discovery
  getDiscoveredCLIs(): Promise<DiscoveredCLI[]>;
  rescanCLIs(): Promise<DiscoveredCLI[]>;
  setManualCLIPath(provider: AgentProvider, executablePath: string | null): Promise<DiscoveredCLI[]>;

  // Agent Sessions
  getAgentSessions(workspaceId: string): Promise<AgentSession[]>;
  createAgentSession(params: CreateAgentParams): Promise<AgentSession>;
  renameAgentSession(sessionId: string, newName: string): Promise<AgentSession>;
  terminateAgentSession(sessionId: string): Promise<boolean>;
  sendPrompt(params: SendPromptParams): Promise<PromptRouteResult>;
  interruptAgent(sessionId: string): Promise<boolean>;
  cancelInstruction(instructionId: string): Promise<boolean>;
  editInstruction(instructionId: string, newPrompt: string): Promise<AgentInstruction | null>;
  getAgentQueue(sessionId: string): Promise<AgentInstruction[]>;

  // Terminal PTY interaction
  sendTerminalInput(sessionId: string, data: string): Promise<void>;
  resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void>;

  // Window Layouts
  getWindowLayouts(desktopId: string): Promise<WindowLayout[]>;
  saveWindowLayout(layout: WindowLayout): Promise<void>;

  // Browser
  getBrowserSessions(desktopId: string): Promise<BrowserSession[]>;
  createBrowserSession(desktopId: string, url?: string): Promise<BrowserSession>;
  closeBrowserSession(sessionId: string): Promise<boolean>;
  updateBrowserSession(
    sessionId: string,
    updates: { url?: string; title?: string }
  ): Promise<BrowserSession>;
  browserNavigate(sessionId: string, url: string): Promise<BrowserSnapshot>;
  browserSnapshot(sessionId: string): Promise<BrowserSnapshot>;
  submitBrowserCommandResult(result: BrowserCommandResultEvent): Promise<void>;

  // Speech
  setAgentVoice(sessionId: string, voiceId: string | null): Promise<AgentSession>;
  getMacOSVoices(): Promise<VoiceOption[]>;
  speakText(request: SpeakRequest): Promise<void>;
  stopSpeech(): Promise<void>;
  listSpeechModels(): Promise<SpeechModelStatus[]>;
  downloadSpeechModel(modelId: string): Promise<SpeechModelStatus>;

  // Git repository helpers
  checkGitRepo(dirPath: string): Promise<{ isGit: boolean; hasCommits: boolean; headCommit?: string }>;
  initGitRepo(dirPath: string): Promise<{ success: boolean; headCommit: string }>;

  // Files (sandboxed to workspace repositories and agent worktrees)
  listDirectory(workspaceId: string, dirPath: string): Promise<FileEntry[]>;
  readTextFile(workspaceId: string, filePath: string): Promise<FilePreview>;
  writeTextFile(workspaceId: string, filePath: string, content: string): Promise<void>;

  // Source control (git)
  getGitStatus(workspaceId: string, repoPath: string): Promise<GitStatusResult>;
  getGitDiff(
    workspaceId: string,
    repoPath: string,
    filePath: string,
    staged?: boolean
  ): Promise<GitDiffResult>;
  stageGitFiles(workspaceId: string, repoPath: string, paths: string[]): Promise<GitStatusResult>;
  unstageGitFiles(workspaceId: string, repoPath: string, paths: string[]): Promise<GitStatusResult>;
  commitGit(
    workspaceId: string,
    repoPath: string,
    message: string
  ): Promise<GitCommitResult>;
  pushGit(workspaceId: string, repoPath: string): Promise<GitPushResult>;

  // GitHub (gh CLI)
  getGitHubAuthStatus(): Promise<GitHubAuthStatus>;
  createPullRequest(
    workspaceId: string,
    repoPath: string,
    options: { title: string; body?: string; base?: string; draft?: boolean }
  ): Promise<CreatePullRequestResult>;

  // Dev servers
  getDevServerSessions(desktopId: string): Promise<DevServerSession[]>;
  startDevServer(params: StartDevServerParams): Promise<DevServerSession>;
  stopDevServer(sessionId: string): Promise<boolean>;
  getDevServerLogs(sessionId: string): Promise<DevServerLogEntry[]>;

  // Notes
  listNotes(workspaceId: string, desktopId: string): Promise<WorkspaceNote[]>;
  createNote(params: CreateNoteParams): Promise<WorkspaceNote>;
  updateNote(params: UpdateNoteParams): Promise<WorkspaceNote>;
  deleteNote(noteId: string): Promise<boolean>;

  // Kanban
  listKanbanTasks(workspaceId: string, desktopId: string): Promise<KanbanTask[]>;
  createKanbanTask(params: CreateKanbanTaskParams): Promise<KanbanTask>;
  updateKanbanTask(params: UpdateKanbanTaskParams): Promise<KanbanTask>;
  deleteKanbanTask(taskId: string): Promise<boolean>;

  // Cloud sync (encrypted local snapshots; relay in M4 phase 2)
  getSyncStatus(): Promise<SyncStatus>;
  updateSyncPreferences(params: UpdateSyncPreferencesParams): Promise<SyncStatus>;
  createSyncSnapshot(): Promise<CreateSyncSnapshotResult>;
  listSyncSnapshots(): Promise<SyncSnapshotMeta[]>;
  restoreLatestSyncSnapshot(): Promise<RestoreSyncSnapshotResult>;
  getRecoveryKey(): Promise<string>;
  connectRelay(params?: ConnectRelayParams): Promise<RelayStatus>;
  disconnectRelay(): Promise<RelayStatus>;
  getRelayStatus(): Promise<RelayStatus>;

  // Account, pairing, and licensing
  getAccountStatus(): Promise<AccountStatus>;
  signInDev(params: SignInDevParams): Promise<AccountStatus>;
  signOutAccount(): Promise<AccountStatus>;
  requestPairing(params: RequestPairingParams): Promise<PairingCode>;
  approvePairing(params: ApprovePairingParams): Promise<AccountStatus>;
  revokePairedDevice(params: RevokeDeviceParams): Promise<AccountStatus>;
  handleStripeWebhook(payload: StripeWebhookPayload): Promise<StripeWebhookResult>;

  // Notifications and usage
  listNotifications(params?: ListNotificationsParams): Promise<AgenticNotification[]>;
  getUnreadNotificationCount(): Promise<number>;
  markNotificationRead(params: MarkNotificationReadParams): Promise<AgenticNotification | null>;
  markAllNotificationsRead(): Promise<number>;
  dismissNotification(params: DismissNotificationParams): Promise<boolean>;
  getUsageOverview(): Promise<UsageOverview>;

  // Extensions
  listInstalledExtensions(): Promise<InstalledExtension[]>;
  installExtension(params: InstallExtensionParams): Promise<InstalledExtension>;
  getExtensionWidgets(): Promise<ExtensionWidgetDescriptor[]>;
  publishNotification(params: PublishNotificationParams): Promise<boolean>;

  // API Client
  listHttpRequests(workspaceId: string, desktopId: string): Promise<SavedHttpRequest[]>;
  createHttpRequest(params: CreateHttpRequestParams): Promise<SavedHttpRequest>;
  updateHttpRequest(params: UpdateHttpRequestParams): Promise<SavedHttpRequest>;
  deleteHttpRequest(requestId: string): Promise<boolean>;
  sendHttpRequest(params: SendHttpRequestParams): Promise<HttpResponseResult>;

  // Database Explorer
  listWorkspaceDatabases(workspaceId: string): Promise<string[]>;
  inspectSqliteDatabase(params: InspectSqliteParams): Promise<SqliteInspectResult>;
  querySqliteDatabase(params: QuerySqliteParams): Promise<SqliteQueryResult>;

  // Design & Assets
  getDesignOverview(workspaceId: string): Promise<DesignOverview>;
  readAssetContent(filePath: string): Promise<{ dataUrl: string; text?: string }>;

  // Activity & Audit Logs
  listActivityEvents(query?: ActivityEventQuery): Promise<ActivityEvent[]>;
  logActivityEvent(params: CreateActivityEventParams): Promise<ActivityEvent>;
  clearActivityEvents(workspaceId?: string): Promise<boolean>;

  // Event Listeners
  onTerminalOutput(callback: (event: TerminalOutputEvent) => void): () => void;
  onAgentStatus(callback: (event: AgentStatusChangedEvent) => void): () => void;
  onQueueUpdated(callback: (event: QueueUpdatedEvent) => void): () => void;
  onApprovalRequested(callback: (event: ApprovalRequestedEvent) => void): () => void;
  onBrowserCommand(callback: (event: BrowserCommandEvent) => void): () => void;
  onDevServerLog(callback: (event: DevServerLogEvent) => void): () => void;
  onDevServerStatus(callback: (event: DevServerStatusEvent) => void): () => void;
  onNotificationCreated(callback: (notification: AgenticNotification) => void): () => void;
  onActivityEvent(callback: (event: ActivityEvent) => void): () => void;
}

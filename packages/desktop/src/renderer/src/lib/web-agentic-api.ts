import {
  AgenticApi,
  CreateWorkspaceParams,
  CreateDesktopParams,
  CreateAgentParams,
  SendPromptParams,
  WindowLayout,
  TerminalOutputEvent,
  AgentStatusChangedEvent,
  QueueUpdatedEvent,
  ApprovalRequestedEvent,
  AgentProvider,
  AgentInstruction,
  BrowserSession,
  BrowserSnapshot,
  BrowserCommandEvent,
  BrowserCommandResultEvent,
  VoiceOption,
  SpeechModelStatus,
  SpeakRequest,
  AgentSession,
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
  DevServerLogEvent,
  DevServerStatusEvent,
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

type RpcResponse = { id: string; result?: unknown; error?: string };
type RpcEvent = { type: 'event'; name: string; payload: unknown };

let requestCounter = 0;
const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
let eventSource: EventSource | null = null;

function ensureEventSource(): void {
  if (eventSource) return;

  eventSource = new EventSource('/agentic/events');
  eventSource.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as RpcEvent;
      if (event.type !== 'event') return;
      const handlers = eventHandlers.get(event.name);
      if (!handlers) return;
      for (const handler of handlers) {
        handler(event.payload);
      }
    } catch {
      // ignore malformed events
    }
  };
}

async function call<T>(method: string, params: unknown = {}): Promise<T> {
  const id = String(++requestCounter);
  const response = await fetch('/agentic/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, method, params })
  });

  if (!response.ok) {
    throw new Error(`Engine request failed (${response.status})`);
  }

  const data = (await response.json()) as RpcResponse;
  if (data.error) {
    throw new Error(data.error);
  }

  return data.result as T;
}

function onEvent<T>(name: string, callback: (event: T) => void): () => void {
  ensureEventSource();
  const handlers = eventHandlers.get(name) ?? new Set();
  const wrapped = (payload: unknown) => callback(payload as T);
  handlers.add(wrapped);
  eventHandlers.set(name, handlers);

  return () => {
    handlers.delete(wrapped);
    if (handlers.size === 0) {
      eventHandlers.delete(name);
    }
  };
}

function speakWithWebSpeech(request: SpeakRequest): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(request.text);
    if (request.rate) utterance.rate = request.rate;
    if (request.voiceId) {
      const voice = window.speechSynthesis
        .getVoices()
        .find((v) => v.voiceURI === request.voiceId || v.name === request.voiceId);
      if (voice) utterance.voice = voice;
    }
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export const webAgenticApi: AgenticApi = {
  getWorkspaces: () => call('getWorkspaces'),
  createWorkspace: (params: CreateWorkspaceParams) => call('createWorkspace', params),
  updateWorkspace: (id: string, updates: Record<string, unknown>) =>
    call('updateWorkspace', { id, updates }),
  deleteWorkspace: (id: string) => call('deleteWorkspace', { id }),

  getDesktops: (workspaceId: string) => call('getDesktops', { workspaceId }),
  createDesktop: (params: CreateDesktopParams) => call('createDesktop', params),
  renameDesktop: (id: string, name: string) => call('renameDesktop', { id, name }),
  deleteDesktop: (id: string) => call('deleteDesktop', { id }),

  getDiscoveredCLIs: () => call('getDiscoveredCLIs'),
  rescanCLIs: () => call('rescanCLIs'),
  setManualCLIPath: (provider: AgentProvider, executablePath: string | null) =>
    call('setManualCLIPath', { provider, executablePath }),

  getAgentSessions: (workspaceId: string) => call('getAgentSessions', { workspaceId }),
  createAgentSession: (params: CreateAgentParams) => call('createAgentSession', params),
  renameAgentSession: (sessionId: string, newName: string) =>
    call('renameAgentSession', { sessionId, newName }),
  terminateAgentSession: (sessionId: string) => call('terminateAgentSession', { sessionId }),
  sendPrompt: (params: SendPromptParams) => call('sendPrompt', params),
  interruptAgent: (sessionId: string) => call('interruptAgent', { sessionId }),
  cancelInstruction: (instructionId: string) => call('cancelInstruction', { instructionId }),
  editInstruction: (instructionId: string, newPrompt: string) =>
    call<AgentInstruction | null>('editInstruction', { instructionId, newPrompt }),
  getAgentQueue: (sessionId: string) => call('getAgentQueue', { sessionId }),

  sendTerminalInput: (sessionId: string, data: string) =>
    call('sendTerminalInput', { sessionId, data }),
  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    call('resizeTerminal', { sessionId, cols, rows }),

  getWindowLayouts: (desktopId: string) => call('getWindowLayouts', { desktopId }),
  saveWindowLayout: (layout: WindowLayout) => call('saveWindowLayout', { layout }),

  checkGitRepo: (dirPath: string) => call('checkGitRepo', { dirPath }),
  initGitRepo: (dirPath: string) => call('initGitRepo', { dirPath }),

  getBrowserSessions: (desktopId: string) => call('getBrowserSessions', { desktopId }),
  createBrowserSession: (desktopId: string, url?: string) =>
    call('createBrowserSession', { desktopId, url }),
  closeBrowserSession: (sessionId: string) => call('closeBrowserSession', { sessionId }),
  updateBrowserSession: (sessionId: string, updates: { url?: string; title?: string }) =>
    call<BrowserSession>('updateBrowserSession', { sessionId, updates }),
  browserNavigate: (sessionId: string, url: string) =>
    call<BrowserSnapshot>('browserNavigate', { sessionId, url }),
  browserSnapshot: (sessionId: string) => call<BrowserSnapshot>('browserSnapshot', { sessionId }),
  submitBrowserCommandResult: (result: BrowserCommandResultEvent) =>
    call('submitBrowserCommandResult', result),

  setAgentVoice: (sessionId: string, voiceId: string | null) =>
    call<AgentSession>('setAgentVoice', { sessionId, voiceId }),
  getMacOSVoices: () => Promise.resolve<VoiceOption[]>([]),
  speakText: (request: SpeakRequest) => speakWithWebSpeech(request),
  stopSpeech: () => {
    window.speechSynthesis?.cancel();
    return Promise.resolve();
  },
  listSpeechModels: () => call<SpeechModelStatus[]>('listSpeechModels'),
  downloadSpeechModel: (modelId: string) =>
    call<SpeechModelStatus>('downloadSpeechModel', { modelId }),

  listDirectory: (workspaceId: string, dirPath: string) =>
    call<FileEntry[]>('listDirectory', { workspaceId, dirPath }),
  readTextFile: (workspaceId: string, filePath: string) =>
    call<FilePreview>('readTextFile', { workspaceId, filePath }),
  writeTextFile: (workspaceId: string, filePath: string, content: string) =>
    call('writeTextFile', { workspaceId, filePath, content }),

  getGitStatus: (workspaceId: string, repoPath: string) =>
    call<GitStatusResult>('getGitStatus', { workspaceId, repoPath }),
  getGitDiff: (workspaceId: string, repoPath: string, filePath: string, staged?: boolean) =>
    call<GitDiffResult>('getGitDiff', { workspaceId, repoPath, filePath, staged }),
  stageGitFiles: (workspaceId: string, repoPath: string, paths: string[]) =>
    call<GitStatusResult>('stageGitFiles', { workspaceId, repoPath, paths }),
  unstageGitFiles: (workspaceId: string, repoPath: string, paths: string[]) =>
    call<GitStatusResult>('unstageGitFiles', { workspaceId, repoPath, paths }),
  commitGit: (workspaceId: string, repoPath: string, message: string) =>
    call<GitCommitResult>('commitGit', { workspaceId, repoPath, message }),
  pushGit: (workspaceId: string, repoPath: string) =>
    call<GitPushResult>('pushGit', { workspaceId, repoPath }),

  getGitHubAuthStatus: () => call<GitHubAuthStatus>('getGitHubAuthStatus'),
  createPullRequest: (
    workspaceId: string,
    repoPath: string,
    options: { title: string; body?: string; base?: string; draft?: boolean }
  ) =>
    call<CreatePullRequestResult>('createPullRequest', {
      workspaceId,
      repoPath,
      ...options
    }),

  getDevServerSessions: (desktopId: string) =>
    call<DevServerSession[]>('getDevServerSessions', { desktopId }),
  startDevServer: (params: StartDevServerParams) =>
    call<DevServerSession>('startDevServer', params),
  stopDevServer: (sessionId: string) => call<boolean>('stopDevServer', { sessionId }),
  getDevServerLogs: (sessionId: string) =>
    call<DevServerLogEntry[]>('getDevServerLogs', { sessionId }),

  listNotes: (workspaceId: string, desktopId: string) =>
    call<WorkspaceNote[]>('listNotes', { workspaceId, desktopId }),
  createNote: (params: CreateNoteParams) => call<WorkspaceNote>('createNote', params),
  updateNote: (params: UpdateNoteParams) => call<WorkspaceNote>('updateNote', params),
  deleteNote: (noteId: string) => call<boolean>('deleteNote', { noteId }),

  listKanbanTasks: (workspaceId: string, desktopId: string) =>
    call<KanbanTask[]>('listKanbanTasks', { workspaceId, desktopId }),
  createKanbanTask: (params: CreateKanbanTaskParams) =>
    call<KanbanTask>('createKanbanTask', params),
  updateKanbanTask: (params: UpdateKanbanTaskParams) =>
    call<KanbanTask>('updateKanbanTask', params),
  deleteKanbanTask: (taskId: string) => call<boolean>('deleteKanbanTask', { taskId }),

  getSyncStatus: () => call<SyncStatus>('getSyncStatus'),
  updateSyncPreferences: (params: UpdateSyncPreferencesParams) =>
    call<SyncStatus>('updateSyncPreferences', params),
  createSyncSnapshot: () => call<CreateSyncSnapshotResult>('createSyncSnapshot'),
  listSyncSnapshots: () => call<SyncSnapshotMeta[]>('listSyncSnapshots'),
  restoreLatestSyncSnapshot: () => call<RestoreSyncSnapshotResult>('restoreLatestSyncSnapshot'),
  getRecoveryKey: () => call<string>('getRecoveryKey'),
  connectRelay: (params?: ConnectRelayParams) => call<RelayStatus>('connectRelay', params ?? {}),
  disconnectRelay: () => call<RelayStatus>('disconnectRelay'),
  getRelayStatus: () => call<RelayStatus>('getRelayStatus'),
  getAccountStatus: () => call<AccountStatus>('getAccountStatus'),
  signInDev: (params: SignInDevParams) => call<AccountStatus>('signInDev', params),
  signOutAccount: () => call<AccountStatus>('signOutAccount'),
  requestPairing: (params: RequestPairingParams) => call<PairingCode>('requestPairing', params),
  approvePairing: (params: ApprovePairingParams) => call<AccountStatus>('approvePairing', params),
  revokePairedDevice: (params: RevokeDeviceParams) =>
    call<AccountStatus>('revokePairedDevice', params),
  listNotifications: (params?: ListNotificationsParams) =>
    call<AgenticNotification[]>('listNotifications', params ?? {}),
  getUnreadNotificationCount: () => call<number>('getUnreadNotificationCount'),
  markNotificationRead: (params: MarkNotificationReadParams) =>
    call<AgenticNotification | null>('markNotificationRead', params),
  markAllNotificationsRead: () => call<number>('markAllNotificationsRead'),
  dismissNotification: (params: DismissNotificationParams) =>
    call<boolean>('dismissNotification', params),
  getUsageOverview: () => call<UsageOverview>('getUsageOverview'),
  listInstalledExtensions: () => call<InstalledExtension[]>('listInstalledExtensions'),
  installExtension: (params: InstallExtensionParams) =>
    call<InstalledExtension>('installExtension', params),
  getExtensionWidgets: () => call<ExtensionWidgetDescriptor[]>('getExtensionWidgets'),
  publishNotification: (params: PublishNotificationParams) =>
    call<boolean>('publishNotification', params),

  // API Client
  listHttpRequests: (workspaceId: string, desktopId: string) =>
    call<SavedHttpRequest[]>('listHttpRequests', { workspaceId, desktopId }),
  createHttpRequest: (params: CreateHttpRequestParams) =>
    call<SavedHttpRequest>('createHttpRequest', params),
  updateHttpRequest: (params: UpdateHttpRequestParams) =>
    call<SavedHttpRequest>('updateHttpRequest', params),
  deleteHttpRequest: (requestId: string) =>
    call<boolean>('deleteHttpRequest', { requestId }),
  sendHttpRequest: (params: SendHttpRequestParams) =>
    call<HttpResponseResult>('sendHttpRequest', params),

  // Database Explorer
  listWorkspaceDatabases: (workspaceId: string) =>
    call<string[]>('listWorkspaceDatabases', { workspaceId }),
  inspectSqliteDatabase: (params: InspectSqliteParams) =>
    call<SqliteInspectResult>('inspectSqliteDatabase', params),
  querySqliteDatabase: (params: QuerySqliteParams) =>
    call<SqliteQueryResult>('querySqliteDatabase', params),

  // Design & Assets
  getDesignOverview: (workspaceId: string) =>
    call<DesignOverview>('getDesignOverview', { workspaceId }),
  readAssetContent: (filePath: string) =>
    call<{ dataUrl: string; text?: string }>('readAssetContent', { filePath }),

  // Activity & Audit Logs
  listActivityEvents: (query?: ActivityEventQuery) =>
    call<ActivityEvent[]>('listActivityEvents', { query }),
  logActivityEvent: (params: CreateActivityEventParams) =>
    call<ActivityEvent>('logActivityEvent', params),
  clearActivityEvents: (workspaceId?: string) =>
    call<boolean>('clearActivityEvents', { workspaceId }),

  onTerminalOutput: (callback) => onEvent<TerminalOutputEvent>('terminal_output', callback),
  onAgentStatus: (callback) => onEvent<AgentStatusChangedEvent>('status_changed', callback),
  onQueueUpdated: (callback) => onEvent<QueueUpdatedEvent>('queue_updated', callback),
  onApprovalRequested: (callback) =>
    onEvent<ApprovalRequestedEvent>('approval_requested', callback),
  onBrowserCommand: (callback) => onEvent<BrowserCommandEvent>('browser_command', callback),
  onDevServerLog: (callback) => onEvent<DevServerLogEvent>('dev_server_log', callback),
  onDevServerStatus: (callback) => onEvent<DevServerStatusEvent>('dev_server_status', callback),
  onNotificationCreated: (callback) => onEvent<AgenticNotification>('notification_created', callback),
  onActivityEvent: (callback) => onEvent<ActivityEvent>('activity_event', callback)
};

export async function checkWebEngineConnection(): Promise<boolean> {
  try {
    await webAgenticApi.getWorkspaces();
    return true;
  } catch {
    return false;
  }
}

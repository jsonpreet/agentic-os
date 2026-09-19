import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
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
  SpeakRequest,
  SpeechModelStatus,
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
  StripeWebhookPayload,
  StripeWebhookResult,
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

async function call<T>(method: string, params: unknown = {}): Promise<T> {
  const result = await invoke<unknown>('agentic_invoke', { method, params });
  return result as T;
}

function listenFor<T>(eventName: string, callback: (event: T) => void): Promise<UnlistenFn> {
  return listen<T>(eventName, (event) => {
    callback(event.payload);
  });
}

export const agenticApi: AgenticApi = {
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
  getMacOSVoices: () => call<VoiceOption[]>('getMacOSVoices'),
  speakText: (request: SpeakRequest) => call('speakText', request),
  stopSpeech: () => call('stopSpeech'),
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
  handleStripeWebhook: (payload: StripeWebhookPayload) =>
    call<StripeWebhookResult>('handleStripeWebhook', { payload }),
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

  onTerminalOutput: (callback) => {
    let unlisten: UnlistenFn | null = null;
    listenFor<TerminalOutputEvent>('agentic:event:terminal_output', callback).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  },

  onAgentStatus: (callback) => {
    let unlisten: UnlistenFn | null = null;
    listenFor<AgentStatusChangedEvent>('agentic:event:status_changed', callback).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  },

  onQueueUpdated: (callback) => {
    let unlisten: UnlistenFn | null = null;
    listenFor<QueueUpdatedEvent>('agentic:event:queue_updated', callback).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  },

  onApprovalRequested: (callback) => {
    let unlisten: UnlistenFn | null = null;
    listenFor<ApprovalRequestedEvent>('agentic:event:approval_requested', callback).then(
      (fn) => {
        unlisten = fn;
      }
    );
    return () => {
      unlisten?.();
    };
  },

  onBrowserCommand: (callback) => {
    let unlisten: UnlistenFn | null = null;
    listenFor<BrowserCommandEvent>('agentic:event:browser_command', callback).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  },

  onDevServerLog: (callback) => {
    let unlisten: UnlistenFn | null = null;
    listenFor<DevServerLogEvent>('agentic:event:dev_server_log', callback).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  },

  onDevServerStatus: (callback) => {
    let unlisten: UnlistenFn | null = null;
    listenFor<DevServerStatusEvent>('agentic:event:dev_server_status', callback).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  },

  onNotificationCreated: (callback) => {
    let unlisten: UnlistenFn | null = null;
    listenFor<AgenticNotification>('agentic:event:notification_created', callback).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  },

  onActivityEvent: (callback) => {
    let unlisten: UnlistenFn | null = null;
    listenFor<ActivityEvent>('agentic:event:activity_event', callback).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }
};

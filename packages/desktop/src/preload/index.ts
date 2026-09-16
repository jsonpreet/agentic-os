import { contextBridge, ipcRenderer } from 'electron';
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
  ApprovalRequestedEvent
} from '@agentic/shared-contracts';

const api: AgenticApi = {
  // Workspaces
  getWorkspaces: () => ipcRenderer.invoke('agentic:workspace:getWorkspaces'),
  createWorkspace: (params: CreateWorkspaceParams) =>
    ipcRenderer.invoke('agentic:workspace:createWorkspace', params),
  updateWorkspace: (id: string, updates: any) =>
    ipcRenderer.invoke('agentic:workspace:updateWorkspace', id, updates),
  deleteWorkspace: (id: string) =>
    ipcRenderer.invoke('agentic:workspace:deleteWorkspace', id),

  // Desktops
  getDesktops: (workspaceId: string) =>
    ipcRenderer.invoke('agentic:desktop:getDesktops', workspaceId),
  createDesktop: (params: CreateDesktopParams) =>
    ipcRenderer.invoke('agentic:desktop:createDesktop', params),
  deleteDesktop: (id: string) =>
    ipcRenderer.invoke('agentic:desktop:deleteDesktop', id),

  // CLI Discovery
  getDiscoveredCLIs: () => ipcRenderer.invoke('agentic:cli:getDiscoveredCLIs'),
  rescanCLIs: () => ipcRenderer.invoke('agentic:cli:rescanCLIs'),

  // Agent Sessions
  getAgentSessions: (workspaceId: string) =>
    ipcRenderer.invoke('agentic:agent:getSessions', workspaceId),
  createAgentSession: (params: CreateAgentParams) =>
    ipcRenderer.invoke('agentic:agent:createSession', params),
  renameAgentSession: (sessionId: string, newName: string) =>
    ipcRenderer.invoke('agentic:agent:renameSession', sessionId, newName),
  terminateAgentSession: (sessionId: string) =>
    ipcRenderer.invoke('agentic:agent:terminateSession', sessionId),
  sendPrompt: (params: SendPromptParams) =>
    ipcRenderer.invoke('agentic:agent:sendPrompt', params),
  interruptAgent: (sessionId: string) =>
    ipcRenderer.invoke('agentic:agent:interrupt', sessionId),
  cancelInstruction: (instructionId: string) =>
    ipcRenderer.invoke('agentic:agent:cancelInstruction', instructionId),
  getAgentQueue: (sessionId: string) =>
    ipcRenderer.invoke('agentic:agent:getQueue', sessionId),

  // Terminal PTY interaction
  sendTerminalInput: (sessionId: string, data: string) =>
    ipcRenderer.invoke('agentic:terminal:sendInput', sessionId, data),
  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('agentic:terminal:resize', sessionId, cols, rows),

  // Window Layouts
  getWindowLayouts: (desktopId: string) =>
    ipcRenderer.invoke('agentic:layout:getLayouts', desktopId),
  saveWindowLayout: (layout: WindowLayout) =>
    ipcRenderer.invoke('agentic:layout:saveLayout', layout),

  // Git repo helpers
  checkGitRepo: (dirPath: string) =>
    ipcRenderer.invoke('agentic:git:checkRepo', dirPath),
  initGitRepo: (dirPath: string) =>
    ipcRenderer.invoke('agentic:git:initRepo', dirPath),

  // Event Listeners
  onTerminalOutput: (callback: (event: TerminalOutputEvent) => void) => {
    const handler = (_: any, data: TerminalOutputEvent) => callback(data);
    ipcRenderer.on('agentic:event:terminal_output', handler);
    return () => {
      ipcRenderer.removeListener('agentic:event:terminal_output', handler);
    };
  },

  onAgentStatus: (callback: (event: AgentStatusChangedEvent) => void) => {
    const handler = (_: any, data: AgentStatusChangedEvent) => callback(data);
    ipcRenderer.on('agentic:event:status_changed', handler);
    return () => {
      ipcRenderer.removeListener('agentic:event:status_changed', handler);
    };
  },

  onQueueUpdated: (callback: (event: QueueUpdatedEvent) => void) => {
    const handler = (_: any, data: QueueUpdatedEvent) => callback(data);
    ipcRenderer.on('agentic:event:queue_updated', handler);
    return () => {
      ipcRenderer.removeListener('agentic:event:queue_updated', handler);
    };
  },

  onApprovalRequested: (callback: (event: ApprovalRequestedEvent) => void) => {
    const handler = (_: any, data: ApprovalRequestedEvent) => callback(data);
    ipcRenderer.on('agentic:event:approval_requested', handler);
    return () => {
      ipcRenderer.removeListener('agentic:event:approval_requested', handler);
    };
  }
};

contextBridge.exposeInMainWorld('agenticApi', api);

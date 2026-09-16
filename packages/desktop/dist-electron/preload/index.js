import { contextBridge, ipcRenderer } from "electron";
const api = {
  // Workspaces
  getWorkspaces: () => ipcRenderer.invoke("agentic:workspace:getWorkspaces"),
  createWorkspace: (params) => ipcRenderer.invoke("agentic:workspace:createWorkspace", params),
  updateWorkspace: (id, updates) => ipcRenderer.invoke("agentic:workspace:updateWorkspace", id, updates),
  deleteWorkspace: (id) => ipcRenderer.invoke("agentic:workspace:deleteWorkspace", id),
  // Desktops
  getDesktops: (workspaceId) => ipcRenderer.invoke("agentic:desktop:getDesktops", workspaceId),
  createDesktop: (params) => ipcRenderer.invoke("agentic:desktop:createDesktop", params),
  deleteDesktop: (id) => ipcRenderer.invoke("agentic:desktop:deleteDesktop", id),
  // CLI Discovery
  getDiscoveredCLIs: () => ipcRenderer.invoke("agentic:cli:getDiscoveredCLIs"),
  rescanCLIs: () => ipcRenderer.invoke("agentic:cli:rescanCLIs"),
  // Agent Sessions
  getAgentSessions: (workspaceId) => ipcRenderer.invoke("agentic:agent:getSessions", workspaceId),
  createAgentSession: (params) => ipcRenderer.invoke("agentic:agent:createSession", params),
  renameAgentSession: (sessionId, newName) => ipcRenderer.invoke("agentic:agent:renameSession", sessionId, newName),
  terminateAgentSession: (sessionId) => ipcRenderer.invoke("agentic:agent:terminateSession", sessionId),
  sendPrompt: (params) => ipcRenderer.invoke("agentic:agent:sendPrompt", params),
  interruptAgent: (sessionId) => ipcRenderer.invoke("agentic:agent:interrupt", sessionId),
  cancelInstruction: (instructionId) => ipcRenderer.invoke("agentic:agent:cancelInstruction", instructionId),
  getAgentQueue: (sessionId) => ipcRenderer.invoke("agentic:agent:getQueue", sessionId),
  // Terminal PTY interaction
  sendTerminalInput: (sessionId, data) => ipcRenderer.invoke("agentic:terminal:sendInput", sessionId, data),
  resizeTerminal: (sessionId, cols, rows) => ipcRenderer.invoke("agentic:terminal:resize", sessionId, cols, rows),
  // Window Layouts
  getWindowLayouts: (desktopId) => ipcRenderer.invoke("agentic:layout:getLayouts", desktopId),
  saveWindowLayout: (layout) => ipcRenderer.invoke("agentic:layout:saveLayout", layout),
  // Git repo helpers
  checkGitRepo: (dirPath) => ipcRenderer.invoke("agentic:git:checkRepo", dirPath),
  initGitRepo: (dirPath) => ipcRenderer.invoke("agentic:git:initRepo", dirPath),
  // Event Listeners
  onTerminalOutput: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("agentic:event:terminal_output", handler);
    return () => {
      ipcRenderer.removeListener("agentic:event:terminal_output", handler);
    };
  },
  onAgentStatus: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("agentic:event:status_changed", handler);
    return () => {
      ipcRenderer.removeListener("agentic:event:status_changed", handler);
    };
  },
  onQueueUpdated: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("agentic:event:queue_updated", handler);
    return () => {
      ipcRenderer.removeListener("agentic:event:queue_updated", handler);
    };
  },
  onApprovalRequested: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("agentic:event:approval_requested", handler);
    return () => {
      ipcRenderer.removeListener("agentic:event:approval_requested", handler);
    };
  }
};
contextBridge.exposeInMainWorld("agenticApi", api);
//# sourceMappingURL=index.js.map

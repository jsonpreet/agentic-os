import { Workspace, Desktop, WindowLayout } from './workspace.js';
import { AgentSession, AgentInstruction, AgentProvider } from './agent.js';
import { DiscoveredCLI } from './cli.js';
import { TerminalOutputEvent, AgentStatusChangedEvent, QueueUpdatedEvent, ApprovalRequestedEvent } from './events.js';

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
}

export interface PromptRouteResult {
  action: 'sent_to_active' | 'queued_for_active' | 'spawned_new_agent' | 'app_command' | 'ambiguous';
  sessionId?: string;
  agentName?: string;
  instructionId?: string;
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
  deleteDesktop(id: string): Promise<boolean>;

  // CLI Discovery
  getDiscoveredCLIs(): Promise<DiscoveredCLI[]>;
  rescanCLIs(): Promise<DiscoveredCLI[]>;

  // Agent Sessions
  getAgentSessions(workspaceId: string): Promise<AgentSession[]>;
  createAgentSession(params: CreateAgentParams): Promise<AgentSession>;
  renameAgentSession(sessionId: string, newName: string): Promise<AgentSession>;
  terminateAgentSession(sessionId: string): Promise<boolean>;
  sendPrompt(params: SendPromptParams): Promise<PromptRouteResult>;
  interruptAgent(sessionId: string): Promise<boolean>;
  cancelInstruction(instructionId: string): Promise<boolean>;
  getAgentQueue(sessionId: string): Promise<AgentInstruction[]>;

  // Terminal PTY interaction
  sendTerminalInput(sessionId: string, data: string): Promise<void>;
  resizeTerminal(sessionId: string, cols: number, rows: number): Promise<void>;

  // Window Layouts
  getWindowLayouts(desktopId: string): Promise<WindowLayout[]>;
  saveWindowLayout(layout: WindowLayout): Promise<void>;

  // Git repository helpers
  checkGitRepo(dirPath: string): Promise<{ isGit: boolean; hasCommits: boolean; headCommit?: string }>;
  initGitRepo(dirPath: string): Promise<{ success: boolean; headCommit: string }>;

  // Event Listeners
  onTerminalOutput(callback: (event: TerminalOutputEvent) => void): () => void;
  onAgentStatus(callback: (event: AgentStatusChangedEvent) => void): () => void;
  onQueueUpdated(callback: (event: QueueUpdatedEvent) => void): () => void;
  onApprovalRequested(callback: (event: ApprovalRequestedEvent) => void): () => void;
}

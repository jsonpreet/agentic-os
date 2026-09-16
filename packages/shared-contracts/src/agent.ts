export type AgentProvider = 'codex' | 'claude' | 'gemini' | 'cursor' | 'custom';

export type AgentStatus = 'idle' | 'working' | 'awaiting_approval' | 'interrupted' | 'terminated';

export interface AgentSession {
  id: string;
  name: string;
  provider: AgentProvider;
  workspaceId: string;
  desktopId: string;
  repoPath?: string;
  worktreePath?: string;
  branchName?: string;
  status: AgentStatus;
  voice?: string;
  createdAt: number;
  updatedAt: number;
}

export type InstructionStatus = 'queued' | 'sending' | 'delivered' | 'cancelled';

export interface AgentInstruction {
  id: string;
  sessionId: string;
  prompt: string;
  attachments?: string[];
  queuedAt: number;
  status: InstructionStatus;
}

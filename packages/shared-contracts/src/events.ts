import { AgentInstruction, AgentStatus } from './agent.js';

export interface TerminalOutputEvent {
  type: 'terminal_output';
  sessionId: string;
  data: string;
  timestamp: number;
}

export interface AgentStatusChangedEvent {
  type: 'status_changed';
  sessionId: string;
  status: AgentStatus;
  timestamp: number;
}

export interface QueueUpdatedEvent {
  type: 'queue_updated';
  sessionId: string;
  queue: AgentInstruction[];
  timestamp: number;
}

export interface ApprovalRequestedEvent {
  type: 'approval_requested';
  sessionId: string;
  prompt: string;
  options: string[];
  timestamp: number;
}

export type SessionEvent =
  | TerminalOutputEvent
  | AgentStatusChangedEvent
  | QueueUpdatedEvent
  | ApprovalRequestedEvent;

export interface SendInputCommand {
  commandId: string;
  type: 'send_input';
  sessionId: string;
  input: string;
}

export interface InterruptCommand {
  commandId: string;
  type: 'interrupt';
  sessionId: string;
}

export interface ApprovalResponseCommand {
  commandId: string;
  type: 'approval_response';
  sessionId: string;
  selectedOption: string;
}

export type RemoteCommand =
  | SendInputCommand
  | InterruptCommand
  | ApprovalResponseCommand;

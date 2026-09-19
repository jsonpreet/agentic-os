import { AgentStatus } from './agent.js';
import { RemoteCommand } from './events.js';

export type RelayRole = 'host' | 'viewer';

export interface RelayHostHello {
  type: 'host_hello';
  deviceId: string;
  deviceName: string;
  platform: string;
  timestamp: number;
}

export interface RelayViewerHello {
  type: 'viewer_hello';
  deviceId: string;
  viewerId: string;
  viewerName?: string;
  timestamp: number;
}

export interface RelayTerminalChunk {
  type: 'terminal_chunk';
  deviceId: string;
  sessionId: string;
  seq: number;
  data: string;
  timestamp: number;
}

export interface RelayAgentStatus {
  type: 'agent_status';
  deviceId: string;
  sessionId: string;
  status: AgentStatus;
  sessionGeneration: number;
  timestamp: number;
}

export interface RelayRemoteCommand {
  type: 'remote_command';
  deviceId: string;
  command: RemoteCommand;
  senderDeviceId: string;
  sessionGeneration: number;
  expiresAt: number;
  timestamp: number;
}

export interface RelayCommandAck {
  type: 'command_ack';
  commandId: string;
  success: boolean;
  message?: string;
  timestamp: number;
}

export interface RelayPresence {
  type: 'presence';
  deviceId: string;
  hostOnline: boolean;
  viewerCount: number;
  timestamp: number;
}

export interface RelayError {
  type: 'error';
  message: string;
  timestamp: number;
}

export type RelayMessage =
  | RelayHostHello
  | RelayViewerHello
  | RelayTerminalChunk
  | RelayAgentStatus
  | RelayRemoteCommand
  | RelayCommandAck
  | RelayPresence
  | RelayError;

export interface RelayStatus {
  connectionState: 'offline' | 'connecting' | 'connected' | 'error';
  relayUrl?: string;
  viewerCount: number;
  message: string;
}

export interface ConnectRelayParams {
  relayUrl?: string;
}

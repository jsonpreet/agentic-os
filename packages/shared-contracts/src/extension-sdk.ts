import { AgentProvider } from './agent.js';

export type ExtensionSdkMethod =
  | 'context.get'
  | 'storage.get'
  | 'storage.set'
  | 'notifications.show'
  | 'agents.launchTask';

export interface LaunchAgentTaskParams {
  prompt: string;
  provider?: AgentProvider;
  targetSessionId?: string;
}

export interface LaunchAgentTaskResult {
  action: string;
  sessionId?: string;
  agentName?: string;
  instructionId?: string;
  message?: string;
}

export interface ExtensionSdkRequest {
  type: 'agentic-sdk-request';
  extensionId: string;
  requestId: string;
  method: ExtensionSdkMethod;
  params?: Record<string, unknown>;
}

export interface ExtensionSdkResponse {
  type: 'agentic-sdk-response';
  requestId: string;
  result?: unknown;
  error?: string;
}

export interface ExtensionSdkReady {
  type: 'agentic-sdk-ready';
}

export interface ExtensionSdkInit {
  type: 'agentic-sdk-init';
  extensionId: string;
  permissions: string[];
}

export interface ExtensionSdkContext {
  extensionId: string;
  name: string;
  sdkVersion: string;
  permissions: string[];
  workspaceId?: string;
  desktopId?: string;
}

export interface PublishNotificationParams {
  type?: 'completion' | 'failure' | 'approval' | 'dev_server_failure' | 'usage_threshold' | 'device_disconnected';
  title: string;
  body: string;
  genericPushBody?: string;
  dedupeKey?: string;
}

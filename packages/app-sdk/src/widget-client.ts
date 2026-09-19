import {
  ExtensionSdkContext,
  ExtensionSdkInit,
  ExtensionSdkRequest,
  ExtensionSdkResponse
} from '@agentic/shared-contracts';

export function createExtensionSdkRequest(
  extensionId: string,
  method: ExtensionSdkRequest['method'],
  params?: Record<string, unknown>
): ExtensionSdkRequest {
  return {
    type: 'agentic-sdk-request',
    extensionId,
    requestId: `req-${crypto.randomUUID()}`,
    method,
    params
  };
}

export function createExtensionSdkResponse(
  requestId: string,
  result?: unknown,
  error?: string
): ExtensionSdkResponse {
  return error
    ? { type: 'agentic-sdk-response', requestId, error }
    : { type: 'agentic-sdk-response', requestId, result };
}

export function createExtensionSdkInit(
  extensionId: string,
  permissions: string[]
): ExtensionSdkInit {
  return {
    type: 'agentic-sdk-init',
    extensionId,
    permissions
  };
}

export type { ExtensionSdkContext };

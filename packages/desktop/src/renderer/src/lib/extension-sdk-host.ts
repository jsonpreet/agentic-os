import {
  AgentProvider,
  ExtensionSdkContext,
  ExtensionSdkInit,
  ExtensionSdkRequest,
  ExtensionSdkResponse,
  ExtensionWidgetDescriptor
} from '@agentic/shared-contracts';
import { ExtensionHostContext } from './extension-host-context.js';

const STORAGE_PREFIX = 'agentic:ext-storage:';

function storageKey(extensionId: string, key: string): string {
  return `${STORAGE_PREFIX}${extensionId}:${key}`;
}

function hasPermission(descriptor: ExtensionWidgetDescriptor, permission: string): boolean {
  return descriptor.permissions.includes(permission);
}

export async function handleExtensionSdkRequest(
  descriptor: ExtensionWidgetDescriptor,
  request: ExtensionSdkRequest,
  source: MessageEventSource | null,
  host: ExtensionHostContext
): Promise<void> {
  if (request.extensionId !== descriptor.extensionId) {
    respond(source, request.requestId, undefined, 'Extension id mismatch.');
    return;
  }

  try {
    switch (request.method) {
      case 'context.get': {
        const context: ExtensionSdkContext = {
          extensionId: descriptor.extensionId,
          name: descriptor.name,
          sdkVersion: descriptor.sdkVersion,
          permissions: descriptor.permissions,
          workspaceId: host.workspaceId,
          desktopId: host.desktopId
        };
        respond(source, request.requestId, context);
        return;
      }
      case 'agents.launchTask': {
        if (!hasPermission(descriptor, 'launch_agent_task')) {
          throw new Error('Permission denied: launch_agent_task');
        }
        if (!window.agenticApi) {
          throw new Error('Engine is not connected.');
        }
        const prompt = String(request.params?.prompt ?? '').trim();
        if (!prompt) {
          throw new Error('Prompt is required.');
        }
        const provider = request.params?.provider as AgentProvider | undefined;
        const targetSessionId = request.params?.targetSessionId
          ? String(request.params.targetSessionId)
          : undefined;
        const result = await window.agenticApi.sendPrompt({
          workspaceId: host.workspaceId,
          desktopId: host.desktopId,
          prompt,
          fallbackProvider: provider,
          targetSessionId,
          repoPath: host.repoPath
        });
        host.onLaunchTask?.(result);
        respond(source, request.requestId, result);
        return;
      }
      case 'storage.get': {
        if (!hasPermission(descriptor, 'storage')) {
          throw new Error('Permission denied: storage');
        }
        const key = String(request.params?.key ?? '');
        const value = localStorage.getItem(storageKey(descriptor.extensionId, key));
        respond(source, request.requestId, value);
        return;
      }
      case 'storage.set': {
        if (!hasPermission(descriptor, 'storage')) {
          throw new Error('Permission denied: storage');
        }
        const key = String(request.params?.key ?? '');
        const value = String(request.params?.value ?? '');
        localStorage.setItem(storageKey(descriptor.extensionId, key), value);
        respond(source, request.requestId, true);
        return;
      }
      case 'notifications.show': {
        if (!hasPermission(descriptor, 'notifications')) {
          throw new Error('Permission denied: notifications');
        }
        if (!window.agenticApi) {
          throw new Error('Engine is not connected.');
        }
        const title = String(request.params?.title ?? 'Extension');
        const body = String(request.params?.body ?? '');
        await window.agenticApi.publishNotification({
          title,
          body,
          genericPushBody: title,
          dedupeKey: `ext:${descriptor.extensionId}:${title}:${body}`
        });
        respond(source, request.requestId, true);
        return;
      }
      default:
        throw new Error(`Unsupported SDK method: ${request.method}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SDK request failed.';
    respond(source, request.requestId, undefined, message);
  }
}

export function createSdkInitMessage(descriptor: ExtensionWidgetDescriptor): ExtensionSdkInit {
  return {
    type: 'agentic-sdk-init',
    extensionId: descriptor.extensionId,
    permissions: descriptor.permissions
  };
}

function respond(
  source: MessageEventSource | null,
  requestId: string,
  result?: unknown,
  error?: string
): void {
  if (!source || !('postMessage' in source)) return;
  const message: ExtensionSdkResponse = error
    ? { type: 'agentic-sdk-response', requestId, error }
    : { type: 'agentic-sdk-response', requestId, result };
  source.postMessage(message, { targetOrigin: '*' });
}

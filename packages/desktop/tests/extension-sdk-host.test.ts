import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionWidgetDescriptor } from '@agentic/shared-contracts';
import { ExtensionHostContext } from '../src/renderer/src/lib/extension-host-context.js';
import { handleExtensionSdkRequest } from '../src/renderer/src/lib/extension-sdk-host.js';

describe('extension sdk host', () => {
  const descriptor: ExtensionWidgetDescriptor = {
    extensionId: 'com.agentic.hello-widget',
    name: 'Hello Widget',
    widgetPath: '/tmp/widget.html',
    permissions: ['storage', 'notifications', 'launch_agent_task'],
    sdkVersion: '0.1.0'
  };

  const host: ExtensionHostContext = {
    workspaceId: 'ws-1',
    desktopId: 'desk-1',
    repoPath: '/tmp/repo'
  };

  const storage: Record<string, string> = {};
  const postMessage = vi.fn();
  const sendPrompt = vi.fn().mockResolvedValue({
    action: 'spawned_new_agent',
    sessionId: 'session-1',
    agentName: 'Tim'
  });

  beforeEach(() => {
    Object.keys(storage).forEach((key) => delete storage[key]);
    postMessage.mockClear();
    sendPrompt.mockClear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        for (const key of Object.keys(storage)) delete storage[key];
      },
      length: 0,
      key: () => null
    });
    vi.stubGlobal('window', {
      agenticApi: {
        publishNotification: vi.fn().mockResolvedValue(true),
        sendPrompt
      }
    });
  });

  it('returns extension context with host desktop scope', async () => {
    await handleExtensionSdkRequest(
      descriptor,
      {
        type: 'agentic-sdk-request',
        extensionId: descriptor.extensionId,
        requestId: 'req-1',
        method: 'context.get'
      },
      { postMessage } as MessageEventSource,
      host
    );

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agentic-sdk-response',
        requestId: 'req-1',
        result: expect.objectContaining({
          extensionId: descriptor.extensionId,
          workspaceId: 'ws-1',
          desktopId: 'desk-1'
        })
      }),
      { targetOrigin: '*' }
    );
  });

  it('stores values with the storage permission', async () => {
    await handleExtensionSdkRequest(
      descriptor,
      {
        type: 'agentic-sdk-request',
        extensionId: descriptor.extensionId,
        requestId: 'req-2',
        method: 'storage.set',
        params: { key: 'count', value: '3' }
      },
      { postMessage } as MessageEventSource,
      host
    );

    expect(storage['agentic:ext-storage:com.agentic.hello-widget:count']).toBe('3');
  });

  it('denies storage without permission', async () => {
    await handleExtensionSdkRequest(
      { ...descriptor, permissions: [] },
      {
        type: 'agentic-sdk-request',
        extensionId: descriptor.extensionId,
        requestId: 'req-3',
        method: 'storage.get',
        params: { key: 'count' }
      },
      { postMessage } as MessageEventSource,
      host
    );

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-3',
        error: 'Permission denied: storage'
      }),
      { targetOrigin: '*' }
    );
  });

  it('launches agent tasks when permitted', async () => {
    const onLaunchTask = vi.fn();
    await handleExtensionSdkRequest(
      descriptor,
      {
        type: 'agentic-sdk-request',
        extensionId: descriptor.extensionId,
        requestId: 'req-4',
        method: 'agents.launchTask',
        params: { prompt: 'Review the widget code' }
      },
      { postMessage } as MessageEventSource,
      { ...host, onLaunchTask }
    );

    expect(sendPrompt).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      desktopId: 'desk-1',
      prompt: 'Review the widget code',
      fallbackProvider: undefined,
      targetSessionId: undefined,
      repoPath: '/tmp/repo'
    });
    expect(onLaunchTask).toHaveBeenCalled();
  });
});

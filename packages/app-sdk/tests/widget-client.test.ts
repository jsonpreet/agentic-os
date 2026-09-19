import { describe, expect, it } from 'vitest';
import {
  createExtensionSdkInit,
  createExtensionSdkRequest,
  createExtensionSdkResponse
} from '../src/widget-client.js';

describe('widget client helpers', () => {
  it('creates sdk protocol messages', () => {
    const request = createExtensionSdkRequest('com.agentic.hello', 'storage.get', {
      key: 'count'
    });
    expect(request.method).toBe('storage.get');
    expect(request.extensionId).toBe('com.agentic.hello');

    const response = createExtensionSdkResponse(request.requestId, '2');
    expect(response.result).toBe('2');

    const init = createExtensionSdkInit('com.agentic.hello', ['storage']);
    expect(init.permissions).toEqual(['storage']);
  });
});

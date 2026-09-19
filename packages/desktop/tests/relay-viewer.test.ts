import { describe, expect, it } from 'vitest';
import {
  buildRelayViewerUrl,
  parseRelayViewerSearch
} from '../src/renderer/src/lib/relay-viewer-client.js';

describe('relay viewer helpers', () => {
  it('builds a viewer URL with query params', () => {
    const url = buildRelayViewerUrl({
      origin: 'http://localhost:5173',
      relayUrl: 'ws://localhost:3848',
      deviceId: 'device-abc',
      sessionId: 'session-1'
    });

    expect(url).toContain('/viewer?');
    expect(url).toContain('relay=ws%3A%2F%2Flocalhost%3A3848');
    expect(url).toContain('deviceId=device-abc');
    expect(url).toContain('sessionId=session-1');
  });

  it('parses viewer search params', () => {
    const parsed = parseRelayViewerSearch(
      '?relay=ws%3A%2F%2Flocalhost%3A3848&deviceId=device-abc&sessionId=session-1'
    );
    expect(parsed.relayUrl).toBe('ws://localhost:3848');
    expect(parsed.deviceId).toBe('device-abc');
    expect(parsed.sessionId).toBe('session-1');
  });
});

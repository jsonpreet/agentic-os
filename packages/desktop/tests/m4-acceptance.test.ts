import { describe, expect, it } from 'vitest';
import {
  buildRelayViewerUrl,
  createViewerId,
  parseRelayViewerSearch
} from '../src/renderer/src/lib/relay-viewer-client.js';

/**
 * Milestone 4 acceptance (renderer):
 * web viewer URL wiring for remote terminal control
 *
 * Manual follow-up (`pnpm dev:web`):
 * /viewer?relay=ws://localhost:3848&deviceId=<host-device-id>&sessionId=<session-id>
 */
describe('Milestone 4 acceptance (renderer)', () => {
  it('builds viewer URLs for relay remote control', () => {
    const url = buildRelayViewerUrl({
      origin: 'http://localhost:5173',
      relayUrl: 'ws://localhost:3848',
      deviceId: 'device-host',
      sessionId: 'session-remote'
    });

    expect(url).toContain('/viewer?');
    expect(url).toContain('relay=ws%3A%2F%2Flocalhost%3A3848');
    expect(url).toContain('deviceId=device-host');
    expect(url).toContain('sessionId=session-remote');
  });

  it('parses viewer search params for relay connection', () => {
    const parsed = parseRelayViewerSearch(
      '?relay=ws%3A%2F%2Flocalhost%3A3848&deviceId=device-host&sessionId=session-remote'
    );

    expect(parsed.relayUrl).toBe('ws://localhost:3848');
    expect(parsed.deviceId).toBe('device-host');
    expect(parsed.sessionId).toBe('session-remote');
  });

  it('creates stable viewer ids for remote sessions', () => {
    const first = createViewerId();
    const second = createViewerId();

    expect(first).toMatch(/^viewer-/);
    expect(second).toMatch(/^viewer-/);
    expect(first).not.toBe(second);
  });
});

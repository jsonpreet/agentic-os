import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startRelayServer } from '../src/relay/relay-server.js';
import { RelayHostService } from '../src/relay/relay-host-service.js';
import { EngineDatabase } from '../src/db/index.js';
import { PTYManager } from '../src/engine/pty-manager.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Relay integration', () => {
  let server: ReturnType<typeof startRelayServer>;
  let relayUrl: string;
  let tmpDir: string;
  let db: EngineDatabase;
  let host: RelayHostService;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-relay-int-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    host = new RelayHostService(db, new PTYManager());

    server = startRelayServer(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address() as AddressInfo;
    relayUrl = `ws://127.0.0.1:${address.port}`;

    await host.connect(relayUrl, {
      deviceId: 'device-host',
      deviceName: 'Test Host',
      platform: 'test'
    });
  });

  afterEach(async () => {
    host.disconnect();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('streams terminal output from host to viewer', async () => {
    const viewer = new WebSocket(relayUrl);
    const chunks: string[] = [];

    await new Promise<void>((resolve, reject) => {
      viewer.once('open', () => {
        viewer.send(
          JSON.stringify({
            type: 'viewer_hello',
            deviceId: 'device-host',
            viewerId: 'viewer-1',
            timestamp: Date.now()
          })
        );
        resolve();
      });
      viewer.once('error', reject);
    });

    viewer.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'terminal_chunk') {
        chunks.push(message.data);
      }
    });

    host.getClient().publishTerminalChunk('session-1', 'remote hello');

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(chunks.join('')).toContain('remote hello');
    viewer.close();
  });
});

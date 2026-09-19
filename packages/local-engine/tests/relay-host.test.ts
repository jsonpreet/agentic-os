import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nanoid } from 'nanoid';
import { EngineDatabase } from '../src/db/index.js';
import { PTYManager } from '../src/engine/pty-manager.js';
import { RelayHostService } from '../src/relay/relay-host-service.js';
describe('RelayHostService remote commands', () => {
  let tmpDir: string;
  let db: EngineDatabase;
  let pty: PTYManager;
  let host: RelayHostService;
  let sessionId: string;
  let sessionUpdatedAt: number;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-relay-host-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    pty = new PTYManager();
    host = new RelayHostService(db, pty);

    const now = Date.now();
    const workspaceId = 'ws-relay';
    const desktopId = 'desk-relay';
    db.saveWorkspace({
      id: workspaceId,
      name: 'Relay',
      repositories: [],
      createdAt: now,
      updatedAt: now
    });
    db.saveDesktop({
      id: desktopId,
      workspaceId,
      name: 'Build',
      type: 'build',
      order: 0,
      createdAt: now
    });

    sessionId = `session-${nanoid()}`;
    sessionUpdatedAt = now;
    db.saveAgentSession({
      id: sessionId,
      name: 'Stark',
      provider: 'claude',
      workspaceId,
      desktopId,
      status: 'idle',
      createdAt: now,
      updatedAt: sessionUpdatedAt
    });

    vi.spyOn(pty, 'sendInput').mockImplementation(() => {});
    vi.spyOn(pty, 'interrupt').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects expired and duplicate remote commands', async () => {
    const client = host.getClient();
    const sendAck = vi.spyOn(client, 'sendCommandAck');

    const expired = {
      type: 'remote_command' as const,
      deviceId: 'device-1',
      senderDeviceId: 'viewer-1',
      sessionGeneration: sessionUpdatedAt,
      expiresAt: Date.now() - 1,
      timestamp: Date.now(),
      command: {
        commandId: 'cmd-expired',
        type: 'send_input' as const,
        sessionId,
        input: 'ls\n'
      }
    };

    client.emit('remote_command', expired);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sendAck).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: 'cmd-expired', success: false })
    );

    const valid = {
      ...expired,
      expiresAt: Date.now() + 30_000,
      command: {
        commandId: 'cmd-1',
        type: 'send_input' as const,
        sessionId,
        input: 'pwd\n'
      }
    };

    client.emit('remote_command', valid);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pty.sendInput).toHaveBeenCalledWith(sessionId, 'pwd\n');

    client.emit('remote_command', valid);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sendAck).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: 'cmd-1', success: true, message: 'Duplicate command ignored.' })
    );
  });
});

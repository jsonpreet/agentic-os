import { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { nanoid } from 'nanoid';
import { LocalEngine } from '../src/engine/local-engine.js';
import { startRelayServer } from '../src/relay/relay-server.js';
import { setCryptoKeyPath } from '../src/sync/crypto.js';

/**
 * Milestone 4 acceptance:
 * 1. Inspect encrypted saved history after disconnecting the host
 * 2. Control a Mac-hosted agent from another device (relay stream + remote input)
 *
 * Manual follow-up (`pnpm dev` + `pnpm relay:dev` + `pnpm dev:web`):
 * Settings → Cloud → sign in → connect relay → open web viewer
 */
describe('Milestone 4 acceptance (engine)', () => {
  let tmpDir: string;
  let engine: LocalEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-m4-'));
    setCryptoKeyPath(path.join(tmpDir, 'device.key'));
    engine = new LocalEngine({
      dbPath: path.join(tmpDir, 'test.db'),
      syncSnapshotDir: path.join(tmpDir, 'snapshots'),
      autoConnectRelay: false
    });
  });

  afterEach(() => {
    setCryptoKeyPath(undefined);
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('preserves encrypted catalog after snapshot and restore', async () => {
    const workspaces = await engine.getWorkspaces();
    const ws = workspaces[0];
    const desktops = await engine.getDesktops(ws.id);

    const note = await engine.createNote({
      workspaceId: ws.id,
      desktopId: desktops[0].id,
      title: 'Offline spec',
      content: 'Encrypted saved progress'
    });

    const statusBefore = engine.getSyncStatus();
    expect(statusBefore.connectionState).toBe('local_snapshot');

    const snapshot = engine.createSyncSnapshot();
    expect(snapshot.meta.version).toBe(1);

    await engine.deleteNote(note.id);
    expect(engine.listNotes(ws.id, desktops[0].id)).toHaveLength(0);

    const restored = engine.restoreLatestSyncSnapshot();
    expect(restored.notes).toBeGreaterThan(0);

    const notes = engine.listNotes(ws.id, desktops[0].id);
    expect(notes[0].content).toBe('Encrypted saved progress');

    const recoveryKey = engine.getRecoveryKey();
    expect(recoveryKey.length).toBeGreaterThan(20);

    const offline = engine.updateSyncPreferences({ localOnlyMode: true });
    expect(offline.preferences.localOnlyMode).toBe(true);
    expect(offline.connectionState).toBe('offline');
  });

  it('keeps encrypted snapshots inspectable after host disconnect', async () => {
    const workspaces = await engine.getWorkspaces();
    const ws = workspaces[0];
    const desktops = await engine.getDesktops(ws.id);
    const secret = 'catalog-only ciphertext';

    await engine.createNote({
      workspaceId: ws.id,
      desktopId: desktops[0].id,
      title: 'Persisted',
      content: secret
    });

    const snapshot = engine.createSyncSnapshot();
    const snapshotPath = path.join(
      tmpDir,
      'snapshots',
      `snapshot-v${snapshot.meta.version}.json`
    );
    const onDisk = fs.readFileSync(snapshotPath, 'utf8');

    expect(onDisk).toContain('"ciphertext"');
    expect(onDisk).not.toContain(secret);

    engine.db.close();

    const afterDisconnect = new LocalEngine({
      dbPath: path.join(tmpDir, 'test.db'),
      syncSnapshotDir: path.join(tmpDir, 'snapshots'),
      autoConnectRelay: false
    });

    const listed = afterDisconnect.listSyncSnapshots();
    expect(listed).toHaveLength(1);
    expect(listed[0].version).toBe(snapshot.meta.version);

    const workspacesAfter = await afterDisconnect.getWorkspaces();
    const desktopsAfter = await afterDisconnect.getDesktops(workspacesAfter[0].id);
    await afterDisconnect.deleteNote(
      afterDisconnect.listNotes(workspacesAfter[0].id, desktopsAfter[0].id)[0].id
    );

    const restored = afterDisconnect.restoreLatestSyncSnapshot();
    expect(restored.notes).toBeGreaterThan(0);

    const notes = afterDisconnect.listNotes(workspacesAfter[0].id, desktopsAfter[0].id);
    expect(notes[0].content).toBe(secret);

    afterDisconnect.db.close();
  });

  it('supports signed-in relay streaming to a remote viewer', async () => {
    const server = startRelayServer(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address() as AddressInfo;
    const relayUrl = `ws://127.0.0.1:${address.port}`;

    engine.signInDev({ email: 'dev@agentic.local' });
    const device = engine.getSyncStatus().device;

    const relay = await engine.connectRelay({ relayUrl });
    expect(relay.connectionState).toBe('connected');

    const viewer = new WebSocket(relayUrl);
    const chunks: string[] = [];

    await new Promise<void>((resolve, reject) => {
      viewer.once('open', () => {
        viewer.send(
          JSON.stringify({
            type: 'viewer_hello',
            deviceId: device.deviceId,
            viewerId: 'viewer-acceptance',
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

    engine.relayHost.getClient().publishTerminalChunk('session-acceptance', 'm4 remote ok');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(chunks.join('')).toContain('m4 remote ok');

    viewer.close();
    engine.disconnectRelay();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('delivers remote terminal input from viewer to host PTY', async () => {
    const server = startRelayServer(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address() as AddressInfo;
    const relayUrl = `ws://127.0.0.1:${address.port}`;

    engine.signInDev({ email: 'dev@agentic.local' });
    const device = engine.getSyncStatus().device;

    const workspaces = await engine.getWorkspaces();
    const desktops = await engine.getDesktops(workspaces[0].id);
    const sessionId = `session-${nanoid()}`;
    const sessionUpdatedAt = Date.now();

    engine.db.saveAgentSession({
      id: sessionId,
      name: 'Remote',
      provider: 'claude',
      workspaceId: workspaces[0].id,
      desktopId: desktops[0].id,
      status: 'working',
      createdAt: sessionUpdatedAt,
      updatedAt: sessionUpdatedAt
    });

    const sendInputSpy = vi.spyOn(engine.ptyManager, 'sendInput').mockImplementation(() => {});

    await engine.connectRelay({ relayUrl });
    engine.relayHost
      .getClient()
      .publishAgentStatus(sessionId, 'working', sessionUpdatedAt);

    const viewer = new WebSocket(relayUrl);
    await new Promise<void>((resolve, reject) => {
      viewer.once('open', () => {
        viewer.send(
          JSON.stringify({
            type: 'viewer_hello',
            deviceId: device.deviceId,
            viewerId: 'viewer-control',
            timestamp: Date.now()
          })
        );
        resolve();
      });
      viewer.once('error', reject);
    });

    viewer.send(
      JSON.stringify({
        type: 'remote_command',
        deviceId: device.deviceId,
        senderDeviceId: 'viewer-control',
        sessionGeneration: sessionUpdatedAt,
        expiresAt: Date.now() + 30_000,
        timestamp: Date.now(),
        command: {
          commandId: 'cmd-acceptance-remote',
          type: 'send_input',
          sessionId,
          input: 'echo remote-control\n'
        }
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sendInputSpy).toHaveBeenCalledWith(sessionId, 'echo remote-control\n');

    viewer.close();
    engine.disconnectRelay();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('blocks relay for signed-in accounts when the current device is not paired', async () => {
    const server = startRelayServer(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address() as AddressInfo;
    const relayUrl = `ws://127.0.0.1:${address.port}`;

    engine.signInDev({ email: 'dev@agentic.local' });
    engine.db.saveDeviceIdentity({
      deviceId: 'device-unpaired',
      deviceName: 'Untrusted laptop',
      platform: 'darwin',
      createdAt: Date.now()
    });

    await expect(engine.connectRelay({ relayUrl })).rejects.toThrow(/not registered|relay restricted/i);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('enables relay after trusted device pairing approval', async () => {
    const server = startRelayServer(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address() as AddressInfo;
    const relayUrl = `ws://127.0.0.1:${address.port}`;

    engine.signInDev({ email: 'dev@agentic.local' });
    const trustedDevice = engine.getSyncStatus().device;

    const pairing = engine.requestPairing({
      deviceName: 'iPad viewer',
      platform: 'ios'
    });

    engine.db.saveDeviceIdentity({
      deviceId: pairing.deviceId,
      deviceName: pairing.deviceName,
      platform: pairing.platform,
      createdAt: Date.now()
    });

    await expect(engine.connectRelay({ relayUrl })).rejects.toThrow(/not registered|relay restricted/i);

    engine.db.saveDeviceIdentity(trustedDevice);
    engine.approvePairing({ code: pairing.code });

    engine.db.saveDeviceIdentity({
      deviceId: pairing.deviceId,
      deviceName: pairing.deviceName,
      platform: pairing.platform,
      createdAt: Date.now()
    });

    const relay = await engine.connectRelay({ relayUrl });
    expect(relay.connectionState).toBe('connected');

    engine.disconnectRelay();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});

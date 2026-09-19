import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { nanoid } from 'nanoid';
import {
  CreateSyncSnapshotResult,
  EncryptedSyncBlob,
  RestoreSyncSnapshotResult,
  SyncCatalogSnapshot,
  SyncConnectionState,
  SyncPreferences,
  SyncSnapshotMeta,
  SyncStatus,
  UpdateSyncPreferencesParams,
  RelayStatus
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';
import {
  decryptJson,
  encryptJson,
  getDeviceKeyPath,
  getOrCreateDeviceKey,
  recoveryKeyFromDeviceKey
} from './crypto.js';
const DEFAULT_SNAPSHOT_DIR = path.join(os.homedir(), '.agentic', 'sync', 'snapshots');

export interface SyncServiceOptions {
  snapshotDir?: string;
  getRelayStatus?: () => RelayStatus;
}

export class SyncService {
  private snapshotDir: string;
  private getRelayStatus?: () => RelayStatus;

  constructor(
    private db: EngineDatabase,
    options: SyncServiceOptions = {}
  ) {
    this.snapshotDir = options.snapshotDir ?? DEFAULT_SNAPSHOT_DIR;
    this.getRelayStatus = options.getRelayStatus;
  }

  ensureDeviceIdentity(): SyncStatus['device'] {
    const existing = this.db.getDeviceIdentity();
    if (existing) return existing;

    const identity = {
      deviceId: `device-${nanoid()}`,
      deviceName: os.hostname(),
      platform: process.platform,
      createdAt: Date.now()
    };
    this.db.saveDeviceIdentity(identity);
    return identity;
  }

  getSyncStatus(): SyncStatus {
    const device = this.ensureDeviceIdentity();
    const preferences = this.db.getSyncPreferences();
    const syncState = this.db.getSyncState();
    const snapshots = this.listSnapshotFiles();
    const relay = this.getRelayStatus?.();

    let connectionState: SyncConnectionState = 'local_snapshot';
    let message =
      'Saved progress is encrypted locally. Cloud relay is not connected yet.';

    if (preferences.localOnlyMode) {
      connectionState = 'offline';
      message = 'Local-only mode — progress is not uploaded or shared remotely.';
    } else if (relay?.connectionState === 'connected') {
      connectionState = 'relay_connected';
      message = relay.message;
    } else if (snapshots.length > 0) {
      connectionState = 'local_snapshot';
      message = `${snapshots.length} encrypted snapshot(s) on this device.`;
    }

    return {
      device,
      preferences,
      connectionState,
      lastSyncedAt: syncState.lastSyncedAt,
      latestSnapshotVersion: syncState.latestSnapshotVersion || undefined,
      snapshotCount: snapshots.length,
      message,
      relay
    };
  }

  updatePreferences(params: UpdateSyncPreferencesParams): SyncStatus {
    const current = this.db.getSyncPreferences();
    const next: SyncPreferences = {
      localOnlyMode: params.localOnlyMode ?? current.localOnlyMode,
      autoSyncEnabled: params.autoSyncEnabled ?? current.autoSyncEnabled,
      relayUrl:
        params.relayUrl === null
          ? undefined
          : params.relayUrl !== undefined
            ? params.relayUrl
            : current.relayUrl
    };
    this.db.saveSyncPreferences(next);
    return this.getSyncStatus();
  }

  buildCatalogSnapshot(version: number): SyncCatalogSnapshot {
    const device = this.ensureDeviceIdentity();
    const createdAt = Date.now();

    return {
      version,
      deviceId: device.deviceId,
      createdAt,
      workspaces: this.db.getWorkspaces(),
      desktops: this.db.getAllDesktops(),
      agentSessions: this.db.getAllAgentSessions(),
      notes: this.db.getAllNotes(),
      kanbanTasks: this.db.getAllKanbanTasks(),
      windowLayouts: this.db.getAllWindowLayouts(),
      browserSessions: this.db.getAllBrowserSessions(),
      queuedInstructions: this.db.getAllQueuedInstructions()
    };
  }

  createSnapshot(): CreateSyncSnapshotResult {
    const preferences = this.db.getSyncPreferences();
    if (preferences.localOnlyMode) {
      throw new Error('Local-only mode is enabled. Disable it to create sync snapshots.');
    }

    getOrCreateDeviceKey();
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { mode: 0o700, recursive: true });
    }

    const syncState = this.db.getSyncState();
    const version = syncState.latestSnapshotVersion + 1;
    const catalog = this.buildCatalogSnapshot(version);
    const blob = encryptJson(catalog.deviceId, catalog);
    const filePath = path.join(this.snapshotDir, `snapshot-v${version}.json`);
    fs.writeFileSync(filePath, JSON.stringify(blob, null, 2), { mode: 0o600 });

    const byteSize = fs.statSync(filePath).size;
    const createdAt = Date.now();
    this.db.saveSyncState(createdAt, version);

    return {
      meta: {
        version,
        deviceId: catalog.deviceId,
        createdAt,
        byteSize
      }
    };
  }

  listSnapshots(): SyncSnapshotMeta[] {
    return this.listSnapshotFiles()
      .map((filePath) => this.readSnapshotMeta(filePath))
      .sort((a, b) => b.version - a.version);
  }

  restoreLatestSnapshot(): RestoreSyncSnapshotResult {
    const snapshots = this.listSnapshots();
    if (snapshots.length === 0) {
      throw new Error('No encrypted snapshots found on this device.');
    }

    const latest = snapshots[0];
    const filePath = path.join(this.snapshotDir, `snapshot-v${latest.version}.json`);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as EncryptedSyncBlob;
    const catalog = decryptJson<SyncCatalogSnapshot>(raw);

    for (const workspace of catalog.workspaces) {
      this.db.saveWorkspace(workspace);
    }
    for (const desktop of catalog.desktops) {
      this.db.saveDesktop(desktop);
    }
    for (const session of catalog.agentSessions) {
      this.db.saveAgentSession(session);
    }
    for (const note of catalog.notes) {
      this.db.saveNote(note);
    }
    for (const task of catalog.kanbanTasks) {
      this.db.saveKanbanTask(task);
    }
    for (const layout of catalog.windowLayouts) {
      this.db.saveWindowLayout(layout);
    }
    for (const browser of catalog.browserSessions) {
      this.db.saveBrowserSession(browser);
    }
    for (const instruction of catalog.queuedInstructions) {
      this.db.saveInstruction(instruction);
    }

    return {
      restoredAt: Date.now(),
      workspaces: catalog.workspaces.length,
      notes: catalog.notes.length,
      kanbanTasks: catalog.kanbanTasks.length
    };
  }

  getRecoveryKey(): string {
    const key = getOrCreateDeviceKey();
    return recoveryKeyFromDeviceKey(key);
  }

  getDeviceKeyPath(): string {
    return getDeviceKeyPath();
  }

  private listSnapshotFiles(): string[] {
    if (!fs.existsSync(this.snapshotDir)) return [];
    return fs
      .readdirSync(this.snapshotDir)
      .filter((name) => name.startsWith('snapshot-v') && name.endsWith('.json'))
      .map((name) => path.join(this.snapshotDir, name));
  }

  private readSnapshotMeta(filePath: string): SyncSnapshotMeta {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as EncryptedSyncBlob;
    const versionMatch = path.basename(filePath).match(/snapshot-v(\d+)\.json/);
    return {
      version: versionMatch ? Number(versionMatch[1]) : 0,
      deviceId: raw.deviceId,
      createdAt: raw.createdAt,
      byteSize: fs.statSync(filePath).size
    };
  }
}

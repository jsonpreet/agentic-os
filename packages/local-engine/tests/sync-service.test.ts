import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EngineDatabase } from '../src/db/index.js';
import { NotesService } from '../src/engine/notes-service.js';
import { SyncService } from '../src/sync/sync-service.js';
import { decryptJson, encryptJson, setCryptoKeyPath } from '../src/sync/crypto.js';
import { SyncCatalogSnapshot } from '@agentic/shared-contracts';

describe('SyncService', () => {
  let tmpDir: string;
  let db: EngineDatabase;
  let sync: SyncService;
  let notes: NotesService;
  let workspaceId: string;
  let desktopId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-sync-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    sync = new SyncService(db, { snapshotDir: path.join(tmpDir, 'snapshots') });
    notes = new NotesService(db);
    setCryptoKeyPath(path.join(tmpDir, 'device.key'));

    workspaceId = 'ws-sync';
    desktopId = 'desk-sync';
    const now = Date.now();
    db.saveWorkspace({
      id: workspaceId,
      name: 'Sync Workspace',
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
  });

  afterEach(() => {
    setCryptoKeyPath(undefined);
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('encrypts and decrypts catalog snapshots', () => {
    const catalog: SyncCatalogSnapshot = {
      version: 1,
      deviceId: 'device-test',
      createdAt: Date.now(),
      workspaces: db.getWorkspaces(),
      desktops: db.getAllDesktops(),
      agentSessions: [],
      notes: [],
      kanbanTasks: [],
      windowLayouts: [],
      browserSessions: [],
      queuedInstructions: []
    };

    const blob = encryptJson('device-test', catalog);
    const restored = decryptJson<SyncCatalogSnapshot>(blob);
    expect(restored.workspaces[0].name).toBe('Sync Workspace');
  });

  it('saves and restores encrypted snapshots', () => {
    const created = notes.createNote({
      workspaceId,
      desktopId,
      title: 'Spec',
      content: 'Keep this note'
    });

    const snapshot = sync.createSnapshot();
    expect(snapshot.meta.version).toBe(1);

    db.deleteNote(created.id);
    expect(notes.listNotes(workspaceId, desktopId)).toHaveLength(0);

    const restored = sync.restoreLatestSnapshot();
    expect(restored.notes).toBeGreaterThan(0);
    expect(notes.listNotes(workspaceId, desktopId)[0].content).toBe('Keep this note');
  });

  it('blocks snapshots while local-only mode is enabled', () => {
    sync.updatePreferences({ localOnlyMode: true });
    expect(() => sync.createSnapshot()).toThrow(/Local-only mode/);
  });
});

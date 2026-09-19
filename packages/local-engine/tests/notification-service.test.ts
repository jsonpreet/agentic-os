import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotificationService } from '../src/notifications/notification-service.js';
import { EngineDatabase } from '../src/db/index.js';

describe('NotificationService', () => {
  let tmpDir: string;
  let db: EngineDatabase;
  let service: NotificationService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-notif-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    service = new NotificationService(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('deduplicates repeated notifications', () => {
    const first = service.record({
      type: 'completion',
      title: 'Done',
      body: 'Task finished',
      genericPushBody: 'Task finished',
      dedupeKey: 'completion:session-1'
    });
    const second = service.record({
      type: 'completion',
      title: 'Done',
      body: 'Task finished',
      genericPushBody: 'Task finished',
      dedupeKey: 'completion:session-1'
    });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(service.listNotifications()).toHaveLength(1);
  });

  it('creates approval notifications for awaiting_approval status', () => {
    const now = Date.now();
    db.saveWorkspace({
      id: 'ws-1',
      name: 'Main',
      repositories: [],
      createdAt: now,
      updatedAt: now
    });
    db.saveDesktop({
      id: 'desk-1',
      workspaceId: 'ws-1',
      name: 'Build',
      type: 'build',
      order: 0,
      createdAt: now,
      updatedAt: now
    });
    db.saveAgentSession({
      id: 'session-1',
      name: 'Tim',
      provider: 'claude',
      workspaceId: 'ws-1',
      desktopId: 'desk-1',
      status: 'working',
      createdAt: now,
      updatedAt: now
    });

    const notification = service.handleAgentStatusChange(
      'session-1',
      'awaiting_approval',
      'working'
    );

    expect(notification?.type).toBe('approval');
    expect(notification?.title).toContain('Tim');
  });
});

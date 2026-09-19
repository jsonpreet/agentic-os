import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EngineDatabase } from '../src/db/index.js';
import { ActivityService } from '../src/engine/activity-service.js';
import { PromptRouter } from '../src/engine/prompt-router.js';

describe('ActivityService and Audit Logging', () => {
  let tmpDir: string;
  let db: EngineDatabase;
  let activityService: ActivityService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-activity-test-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    activityService = new ActivityService(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('records and lists activity events with filters and search', () => {
    const e1 = activityService.logAgent(
      'Agent Alpha created',
      'Created with provider claude',
      { sessionId: 's1', provider: 'claude' },
      'info',
      'ws-1',
      'desk-1'
    );

    const e2 = activityService.logGit(
      'Git Commit',
      'feat: new navigation bar',
      { hash: 'abc1234' },
      'success',
      'ws-1'
    );

    const e3 = activityService.logDevServer(
      'Dev Server crashed',
      'Port 3000 exited with error code 1',
      { port: 3000 },
      'error',
      'desk-1'
    );

    expect(e1.id).toBeDefined();
    expect(e2.category).toBe('git');
    expect(e3.severity).toBe('error');

    // List all
    const all = activityService.listEvents();
    expect(all.length).toBe(3);

    // Filter by category
    const gitEvents = activityService.listEvents({ category: 'git' });
    expect(gitEvents.length).toBe(1);
    expect(gitEvents[0].title).toBe('Git Commit');

    // Filter by severity
    const errorEvents = activityService.listEvents({ severity: 'error' });
    expect(errorEvents.length).toBe(1);
    expect(errorEvents[0].title).toBe('Dev Server crashed');

    // Search query
    const searchResults = activityService.listEvents({ search: 'navigation' });
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].message).toContain('navigation bar');

    // Limit
    const limited = activityService.listEvents({ limit: 2 });
    expect(limited.length).toBe(2);
  });

  it('emits activity_event on new log entry', () => {
    const eventsEmitted: unknown[] = [];
    activityService.on('activity_event', (event) => {
      eventsEmitted.push(event);
    });

    activityService.logNetwork('GET https://api.github.com/user', 'Status: 200 OK');
    expect(eventsEmitted.length).toBe(1);
    expect((eventsEmitted[0] as any).category).toBe('network');
  });

  it('clears activity events by workspace or globally', () => {
    activityService.logAgent('A1', 'M1', undefined, 'info', 'ws-1');
    activityService.logAgent('A2', 'M2', undefined, 'info', 'ws-2');

    expect(activityService.listEvents().length).toBe(2);

    activityService.clearEvents('ws-1');
    const afterWs1Clear = activityService.listEvents();
    expect(afterWs1Clear.length).toBe(1);
    expect(afterWs1Clear[0].workspaceId).toBe('ws-2');

    activityService.clearEvents();
    expect(activityService.listEvents().length).toBe(0);
  });

  it('routes natural language prompts to open_activity_logs command', async () => {
    const r1 = await PromptRouter.route({
      prompt: 'open activity logs',
      activeSessions: [],
      ptyManager: null as any,
      queueManager: null as any
    });
    expect(r1.action).toBe('app_command');
    expect(r1.appCommand).toBe('open_activity_logs');

    const r2 = await PromptRouter.route({
      prompt: 'show logs',
      activeSessions: [],
      ptyManager: null as any,
      queueManager: null as any
    });
    expect(r2.action).toBe('app_command');
    expect(r2.appCommand).toBe('open_activity_logs');

    const r3 = await PromptRouter.route({
      prompt: 'open activity',
      activeSessions: [],
      ptyManager: null as any,
      queueManager: null as any
    });
    expect(r3.action).toBe('app_command');
    expect(r3.appCommand).toBe('open_activity_logs');
  });
});

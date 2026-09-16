import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PromptRouter } from '../src/engine/prompt-router.js';
import { generateAgentName } from '../src/engine/name-generator.js';
import { EngineDatabase } from '../src/db/index.js';
import { InstructionQueueManager } from '../src/engine/instruction-queue.js';
import { GitWorktreeManager } from '../src/git/worktree-manager.js';
import { execa } from 'execa';

describe('PromptRouter', () => {
  it('parses explicit agent address with "Hey <Name>, <prompt>"', () => {
    const res = PromptRouter.parsePrompt('Hey Tim, please implement login');
    expect(res.targetName).toBe('Tim');
    expect(res.instruction).toBe('please implement login');
  });

  it('parses explicit agent address with "<Name>: <prompt>"', () => {
    const res = PromptRouter.parsePrompt('Jade: review the diff');
    expect(res.targetName).toBe('Jade');
    expect(res.instruction).toBe('review the diff');
  });

  it('parses explicit agent address without punctuation "hey stark run tests"', () => {
    const res = PromptRouter.parsePrompt('hey stark run tests');
    expect(res.targetName).toBe('stark');
    expect(res.instruction).toBe('run tests');
  });

  it('handles general prompt without explicit agent address', () => {
    const res = PromptRouter.parsePrompt('build a new React component');
    expect(res.targetName).toBeNull();
    expect(res.instruction).toBe('build a new React component');
  });
});

describe('generateAgentName', () => {
  it('generates unique name not present in existing list', () => {
    const existing = ['Tim', 'Jade', 'Stark'];
    const name = generateAgentName(existing);
    expect(name).toBeDefined();
    expect(existing.map((e) => e.toLowerCase())).not.toContain(name.toLowerCase());
  });
});

describe('EngineDatabase and InstructionQueue', () => {
  let tmpDir: string;
  let db: EngineDatabase;
  let queue: InstructionQueueManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-db-test-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    queue = new InstructionQueueManager(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates and retrieves workspaces and desktops', () => {
    const ws = {
      id: 'ws-1',
      name: 'Test Project',
      repositories: ['/path/to/repo'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.saveWorkspace(ws);
    const retrieved = db.getWorkspace('ws-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Test Project');
    expect(retrieved?.repositories).toEqual(['/path/to/repo']);
  });

  it('queues instructions and marks them delivered or cancelled', () => {
    const ws = {
      id: 'ws-test',
      name: 'Test Project',
      repositories: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.saveWorkspace(ws);

    const desktop = {
      id: 'desk-test',
      workspaceId: 'ws-test',
      name: 'Build',
      type: 'build' as const,
      order: 0,
      createdAt: Date.now()
    };
    db.saveDesktop(desktop);

    const sessionId = 'session-123';
    const session = {
      id: sessionId,
      name: 'Tim',
      provider: 'claude' as const,
      workspaceId: 'ws-test',
      desktopId: 'desk-test',
      status: 'working' as const,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.saveAgentSession(session);

    const item1 = queue.enqueue(sessionId, 'First task');
    const item2 = queue.enqueue(sessionId, 'Second task');

    let currentQueue = queue.getQueue(sessionId);
    expect(currentQueue.length).toBe(2);
    expect(currentQueue[0].prompt).toBe('First task');

    // Deliver first
    queue.markDelivered(item1.id, sessionId);
    currentQueue = queue.getQueue(sessionId);
    expect(currentQueue.length).toBe(1);
    expect(currentQueue[0].prompt).toBe('Second task');

    // Cancel second
    queue.cancel(item2.id, sessionId);
    currentQueue = queue.getQueue(sessionId);
    expect(currentQueue.length).toBe(0);
  });
});

describe('GitWorktreeManager', () => {
  let tmpDir: string;
  let gitManager: GitWorktreeManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-git-test-'));
    gitManager = new GitWorktreeManager();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes git repository and creates isolated worktree', async () => {
    // Check uninitialized repo
    const checkBefore = await gitManager.checkRepo(tmpDir);
    expect(checkBefore.isGit).toBe(false);

    // Initialize repo
    const initRes = await gitManager.initRepo(tmpDir);
    expect(initRes.success).toBe(true);

    const checkAfter = await gitManager.checkRepo(tmpDir);
    expect(checkAfter.isGit).toBe(true);
    expect(checkAfter.hasCommits).toBe(true);

    // Create an isolated worktree for agent 'Tim'
    const wt = await gitManager.createWorktree(tmpDir, 'Tim', 'session1');
    expect(fs.existsSync(wt.worktreePath)).toBe(true);
    expect(wt.branchName).toContain('agent/tim-');

    // Verify git branches
    const { stdout: branchList } = await execa('git', ['branch'], { cwd: tmpDir });
    expect(branchList).toContain(wt.branchName);

    // Clean up worktree
    await gitManager.removeWorktree(tmpDir, wt.worktreePath);
    expect(fs.existsSync(wt.worktreePath)).toBe(false);
  });
});

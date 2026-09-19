import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PromptRouter } from '../src/engine/prompt-router.js';
import { generateAgentName } from '../src/engine/name-generator.js';
import { EngineDatabase } from '../src/db/index.js';
import { InstructionQueueManager } from '../src/engine/instruction-queue.js';
import { GitWorktreeManager } from '../src/git/worktree-manager.js';
import { LocalEngine } from '../src/engine/local-engine.js';
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

  it('parses desktop switch app commands', () => {
    expect(PromptRouter.parseAppCommand('Switch to Design desktop')).toEqual({
      type: 'switch_desktop',
      desktopName: 'Design'
    });
    expect(PromptRouter.parseAppCommand('open the Review desktop')).toEqual({
      type: 'switch_desktop',
      desktopName: 'Review'
    });
  });

  it('parses open browser app commands', () => {
    expect(PromptRouter.parseAppCommand('open browser')).toEqual({
      type: 'open_browser',
      url: undefined
    });
    expect(PromptRouter.parseAppCommand('Open browser to example.com')).toEqual({
      type: 'open_browser',
      url: 'example.com'
    });
    expect(PromptRouter.parseAppCommand('browse https://news.ycombinator.com')).toEqual({
      type: 'open_browser',
      url: 'https://news.ycombinator.com'
    });
  });

  it('parses focus agent app commands', () => {
    expect(PromptRouter.parseAppCommand('focus Tim')).toEqual({
      type: 'focus_agent',
      agentName: 'Tim'
    });
  });

  it('parses open files app commands', () => {
    expect(PromptRouter.parseAppCommand('open files')).toEqual({ type: 'open_files' });
    expect(PromptRouter.parseAppCommand('Open the Files app')).toEqual({ type: 'open_files' });
    expect(PromptRouter.parseAppCommand('show files')).toEqual({ type: 'open_files' });
    expect(PromptRouter.parseAppCommand('open file browser')).toEqual({ type: 'open_files' });
  });

  it('parses open editor app commands', () => {
    expect(PromptRouter.parseAppCommand('open editor')).toEqual({ type: 'open_editor' });
    expect(PromptRouter.parseAppCommand('open code editor')).toEqual({ type: 'open_editor' });
    expect(PromptRouter.parseAppCommand('show editor')).toEqual({ type: 'open_editor' });
  });

  it('parses open source control app commands', () => {
    expect(PromptRouter.parseAppCommand('open source control')).toEqual({
      type: 'open_source_control'
    });
    expect(PromptRouter.parseAppCommand('open git')).toEqual({ type: 'open_source_control' });
    expect(PromptRouter.parseAppCommand('show git')).toEqual({ type: 'open_source_control' });
  });

  it('parses open notes and kanban app commands', () => {
    expect(PromptRouter.parseAppCommand('open notes')).toEqual({ type: 'open_notes' });
    expect(PromptRouter.parseAppCommand('show notes')).toEqual({ type: 'open_notes' });
    expect(PromptRouter.parseAppCommand('open kanban')).toEqual({ type: 'open_kanban' });
    expect(PromptRouter.parseAppCommand('show board')).toEqual({ type: 'open_kanban' });
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

  it('cancels queued instruction by instruction id via cancelById', () => {
    const ws = {
      id: 'ws-cancel',
      name: 'Cancel Test',
      repositories: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.saveWorkspace(ws);

    const desktop = {
      id: 'desk-cancel',
      workspaceId: 'ws-cancel',
      name: 'Build',
      type: 'build' as const,
      order: 0,
      createdAt: Date.now()
    };
    db.saveDesktop(desktop);

    const sessionId = 'session-cancel-by-id';
    const session = {
      id: sessionId,
      name: 'Tim',
      provider: 'claude' as const,
      workspaceId: 'ws-cancel',
      desktopId: 'desk-cancel',
      status: 'working' as const,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.saveAgentSession(session);

    const item = queue.enqueue(sessionId, 'Cancel me');
    const cancelled = queue.cancelById(item.id);
    expect(cancelled).toBe(true);
    expect(queue.getQueue(sessionId).length).toBe(0);
  });

  it('edits queued instruction prompt', () => {
    const ws = {
      id: 'ws-edit',
      name: 'Edit Test',
      repositories: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    db.saveWorkspace(ws);

    const desktop = {
      id: 'desk-edit',
      workspaceId: 'ws-edit',
      name: 'Build',
      type: 'build' as const,
      order: 0,
      createdAt: Date.now()
    };
    db.saveDesktop(desktop);

    const sessionId = 'session-edit';
    db.saveAgentSession({
      id: sessionId,
      name: 'Tim',
      provider: 'claude',
      workspaceId: 'ws-edit',
      desktopId: 'desk-edit',
      status: 'working',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    const item = queue.enqueue(sessionId, 'original task');
    const updated = queue.edit(item.id, 'revised task');

    expect(updated).not.toBeNull();
    expect(updated?.prompt).toBe('revised task');
    expect(queue.getQueue(sessionId)[0].prompt).toBe('revised task');
  });
});

describe('CLI integration persistence', () => {
  let tmpDir: string;
  let db: EngineDatabase;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-cli-db-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists and loads CLI integrations', () => {
    const cli = {
      provider: 'claude' as const,
      name: 'Claude Code',
      command: 'claude',
      executablePath: '/usr/local/bin/claude',
      version: '1.0.0',
      isAvailable: true,
      isManual: true,
      capabilities: {
        supportsPromptDelivery: true,
        supportsAttachments: true,
        supportsReadinessEvents: true,
        supportsResumption: true
      }
    };

    db.saveCLIIntegration(cli, true);
    const loaded = db.getCLIIntegrations();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].provider).toBe('claude');
    expect(loaded[0].executablePath).toBe('/usr/local/bin/claude');
    expect(loaded[0].isManual).toBe(true);
    expect(db.getManualCLIPaths().claude).toBe('/usr/local/bin/claude');
  });
});

describe('Browser sessions', () => {
  let tmpDir: string;
  let engine: LocalEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-browser-'));
    engine = new LocalEngine({ dbPath: path.join(tmpDir, 'test.db') });
  });

  afterEach(() => {
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates and lists browser sessions per desktop', async () => {
    const workspaces = await engine.getWorkspaces();
    const ws = workspaces[0];
    const desktops = await engine.getDesktops(ws.id);

    const session = await engine.createBrowserSession(desktops[0].id, 'https://example.com');
    expect(session.id).toMatch(/^browser-/);
    expect(session.url).toBe('https://example.com');

    const listed = await engine.getBrowserSessions(desktops[0].id);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(session.id);

    await engine.closeBrowserSession(session.id);
    const afterClose = await engine.getBrowserSessions(desktops[0].id);
    expect(afterClose).toHaveLength(0);
  });
});

describe('Desktop management', () => {
  let tmpDir: string;
  let engine: LocalEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-desktop-mgmt-'));
    engine = new LocalEngine({ dbPath: path.join(tmpDir, 'test.db') });
  });

  afterEach(() => {
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('renames a desktop', async () => {
    const workspaces = await engine.getWorkspaces();
    const ws = workspaces[0];
    const desktops = await engine.getDesktops(ws.id);
    const target = desktops[0];

    const renamed = await engine.renameDesktop(target.id, 'Sprint');
    expect(renamed.name).toBe('Sprint');

    const refreshed = await engine.getDesktops(ws.id);
    expect(refreshed.find((d) => d.id === target.id)?.name).toBe('Sprint');
  });
});

describe('LocalEngine prompt routing', () => {
  let tmpDir: string;
  let engine: LocalEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-engine-route-'));
    engine = new LocalEngine({ dbPath: path.join(tmpDir, 'test.db') });
  });

  afterEach(() => {
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('routes to targetSessionId without Hey Name prefix', async () => {
    const workspaces = await engine.getWorkspaces();
    const ws = workspaces[0];
    const desktops = await engine.getDesktops(ws.id);

    const session = await engine.createAgentSession({
      workspaceId: ws.id,
      desktopId: desktops[0].id,
      name: 'Tim',
      provider: 'claude'
    });

    engine.ptyManager.setStatus(session.id, 'working');

    const result = await engine.sendPrompt({
      workspaceId: ws.id,
      prompt: 'run unit tests',
      targetSessionId: session.id
    });

    expect(result.action).toBe('queued_for_active');
    expect(result.agentName).toBe('Tim');

    const queue = await engine.getAgentQueue(session.id);
    expect(queue.some((q) => q.prompt === 'run unit tests')).toBe(true);

    await engine.terminateAgentSession(session.id);
  });

  it('cancels instruction through engine.cancelInstruction', async () => {
    const workspaces = await engine.getWorkspaces();
    const ws = workspaces[0];
    const desktops = await engine.getDesktops(ws.id);

    const session = await engine.createAgentSession({
      workspaceId: ws.id,
      desktopId: desktops[0].id,
      name: 'Tim',
      provider: 'claude'
    });

    engine.ptyManager.setStatus(session.id, 'working');

    const route = await engine.sendPrompt({
      workspaceId: ws.id,
      prompt: 'queued task',
      targetSessionId: session.id
    });

    expect(route.instructionId).toBeDefined();

    const cancelled = await engine.cancelInstruction(route.instructionId!);
    expect(cancelled).toBe(true);
    expect((await engine.getAgentQueue(session.id)).length).toBe(0);

    await engine.terminateAgentSession(session.id);
  });

  it('persists per-agent voice via setAgentVoice', async () => {
    const workspaces = await engine.getWorkspaces();
    const ws = workspaces[0];
    const desktops = await engine.getDesktops(ws.id);

    const session = await engine.createAgentSession({
      workspaceId: ws.id,
      desktopId: desktops[0].id,
      name: 'Echo',
      provider: 'claude'
    });

    const updated = await engine.setAgentVoice(session.id, 'com.apple.voice.compact.en-US.Samantha');
    expect(updated.voice).toBe('com.apple.voice.compact.en-US.Samantha');

    const cleared = await engine.setAgentVoice(session.id, null);
    expect(cleared.voice).toBeUndefined();

    await engine.terminateAgentSession(session.id);
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

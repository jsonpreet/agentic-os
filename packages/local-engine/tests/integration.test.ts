import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LocalEngine } from '../src/engine/local-engine.js';
import { execa } from 'execa';

describe('LocalEngine Full Integration', () => {
  let tmpDir: string;
  let testRepoDir: string;
  let engine: LocalEngine;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-integration-'));
    testRepoDir = path.join(tmpDir, 'test-repo');
    fs.mkdirSync(testRepoDir, { recursive: true });

    // Initialize test repository with baseline commit
    await execa('git', ['init'], { cwd: testRepoDir });
    fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Test Project');
    await execa('git', ['add', '-A'], { cwd: testRepoDir });
    await execa('git', ['commit', '-m', 'chore: initial commit'], { cwd: testRepoDir });

    const dbPath = path.join(tmpDir, 'test-agentic.db');
    engine = new LocalEngine({ dbPath });
  });

  afterEach(() => {
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('proves Milestone 1 acceptance criteria: workspaces, desktops, CLI discovery, worktrees, and addressing', async () => {
    // 1. Workspaces & Desktops
    const workspaces = await engine.getWorkspaces();
    expect(workspaces.length).toBeGreaterThan(0);
    const ws = workspaces[0];

    const desktops = await engine.getDesktops(ws.id);
    expect(desktops.length).toBe(4);
    expect(desktops.map((d) => d.name)).toEqual(['Build', 'Design', 'Research', 'Review']);

    // 2. CLI Discovery
    const clis = await engine.getDiscoveredCLIs();
    expect(clis.length).toBe(4);
    expect(clis.map((c) => c.provider)).toEqual(['claude', 'gemini', 'codex', 'cursor']);

    // 3. Spawn named agent "Tim" in isolated worktree
    const timSession = await engine.createAgentSession({
      workspaceId: ws.id,
      desktopId: desktops[0].id,
      name: 'Tim',
      provider: 'claude',
      repoPath: testRepoDir
    });

    expect(timSession.name).toBe('Tim');
    expect(timSession.worktreePath).toBeDefined();
    expect(fs.existsSync(timSession.worktreePath!)).toBe(true);
    expect(timSession.branchName).toContain('agent/tim-');

    // 4. Natural Prompt Addressing: "Hey Tim, list files"
    const route1 = await engine.sendPrompt({
      workspaceId: ws.id,
      prompt: 'Hey Tim, list files',
      repoPath: testRepoDir
    });

    // Tim is working, so instruction was queued or delivered
    expect(['sent_to_active', 'queued_for_active']).toContain(route1.action);
    expect(route1.agentName).toBe('Tim');

    // 5. Follow-up prompt queuing while busy
    engine.ptyManager.setStatus(timSession.id, 'working');
    const route2 = await engine.sendPrompt({
      workspaceId: ws.id,
      prompt: 'Hey Tim, run unit tests',
      repoPath: testRepoDir
    });

    expect(route2.action).toBe('queued_for_active');
    expect(route2.agentName).toBe('Tim');

    const queue = await engine.getAgentQueue(timSession.id);
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.some((q) => q.prompt === 'run unit tests')).toBe(true);

    // 6. Spawn second agent "Jade" on "Review" desktop
    const jadeSession = await engine.createAgentSession({
      workspaceId: ws.id,
      desktopId: desktops[3].id, // Review desktop
      name: 'Jade',
      provider: 'gemini',
      repoPath: testRepoDir
    });

    expect(jadeSession.name).toBe('Jade');
    expect(jadeSession.desktopId).toBe(desktops[3].id);
    expect(fs.existsSync(jadeSession.worktreePath!)).toBe(true);

    // Verify both agents run simultaneously in distinct worktrees
    expect(timSession.worktreePath).not.toEqual(jadeSession.worktreePath);

    // 7. Cleanup
    await engine.terminateAgentSession(timSession.id);
    await engine.terminateAgentSession(jadeSession.id);

    const afterSessions = await engine.getAgentSessions(ws.id);
    expect(afterSessions.every((s) => s.status === 'terminated')).toBe(true);
  });
});

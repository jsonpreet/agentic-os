import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execa } from 'execa';
import { BrowserCommandEvent } from '@agentic/shared-contracts';
import { LocalEngine } from '../src/engine/local-engine.js';
import { parsePullRequestUrl } from '../src/git/github-service.js';

/**
 * Milestone 3 acceptance (automated):
 * edit file → verify in browser → review in git → create PR (mocked gh)
 *
 * Manual follow-up (`pnpm dev`):
 * 1. Grid → Editor → change a file → save
 * 2. Grid → Browser → confirm the page
 * 3. Grid → Git → review diff → commit & push
 * 4. Create PR (requires `gh auth login`)
 */
describe('Milestone 3 acceptance (engine)', () => {
  let tmpDir: string;
  let repoDir: string;
  let engine: LocalEngine;
  let workspaceId: string;
  let desktopId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-m3-'));
    repoDir = path.join(tmpDir, 'site');
    fs.mkdirSync(repoDir, { recursive: true });

    fs.writeFileSync(
      path.join(repoDir, 'index.html'),
      '<!doctype html><html><head><title>Before</title></head><body><h1>Before</h1></body></html>'
    );

    await execa('git', ['init'], { cwd: repoDir });
    await execa('git', ['add', '-A'], { cwd: repoDir });
    await execa('git', ['commit', '-m', 'chore: initial site'], { cwd: repoDir });
    await execa('git', ['checkout', '-b', 'feature/m3-landing'], { cwd: repoDir });

    engine = new LocalEngine({ dbPath: path.join(tmpDir, 'test-agentic.db') });
    const ws = await engine.createWorkspace({ name: 'M3 Ship', repositories: [repoDir] });
    workspaceId = ws.id;
    const desktops = await engine.getDesktops(workspaceId);
    desktopId = desktops[0].id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ships a change through edit → browser verify → git review → PR', async () => {
    const htmlPath = path.join(repoDir, 'index.html');
    const updatedHtml =
      '<!doctype html><html><head><title>Agentic Landing</title></head><body><h1>Shipped with Agentic</h1></body></html>';

    // 1. Complete an implementation in the editor (engine file write)
    await engine.writeTextFile(workspaceId, htmlPath, updatedHtml);
    const saved = await engine.readTextFile(workspaceId, htmlPath);
    expect(saved.kind).toBe('text');
    if (saved.kind === 'text') {
      expect(saved.content).toContain('Agentic Landing');
    }

    const openEditor = await engine.sendPrompt({
      workspaceId,
      prompt: 'open editor'
    });
    expect(openEditor.action).toBe('app_command');
    expect(openEditor.appCommand).toBe('open_editor');

    // 2. Verify in the browser app
    const openBrowser = await engine.sendPrompt({
      workspaceId,
      prompt: 'open browser to http://localhost:4173'
    });
    expect(openBrowser.appCommand).toBe('open_browser');

    const browser = await engine.createBrowserSession(desktopId, 'http://localhost:4173');
    const commands: BrowserCommandEvent[] = [];
    engine.on('browser_command', (cmd) => commands.push(cmd));

    const snapshotPromise = engine.browserSnapshot(browser.id);
    const snapshotCmd = commands[0];
    expect(snapshotCmd.tool).toBe('snapshot');

    engine.submitBrowserCommandResult({
      requestId: snapshotCmd.requestId,
      sessionId: browser.id,
      success: true,
      snapshot: {
        url: 'http://localhost:4173',
        title: 'Agentic Landing',
        text: 'Shipped with Agentic'
      }
    });

    const snapshot = await snapshotPromise;
    expect(snapshot.title).toBe('Agentic Landing');
    expect(snapshot.text).toContain('Shipped with Agentic');

    // 3. Review changes in Source Control
    const openGit = await engine.sendPrompt({
      workspaceId,
      prompt: 'open source control'
    });
    expect(openGit.appCommand).toBe('open_source_control');

    const status = await engine.getGitStatus(workspaceId, repoDir);
    expect(status.changedFiles.some((file) => file.path === 'index.html')).toBe(true);

    const diff = await engine.getGitDiff(workspaceId, repoDir, 'index.html', false);
    expect(diff.diff).toContain('Agentic Landing');

    await engine.stageGitFiles(workspaceId, repoDir, ['index.html']);
    const commit = await engine.commitGit(
      workspaceId,
      repoDir,
      'feat: update landing page copy'
    );
    expect(commit.commitHash).toBeTruthy();

    const cleanStatus = await engine.getGitStatus(workspaceId, repoDir);
    expect(cleanStatus.clean).toBe(true);

    // 4. Create a pull request (mock gh output)
    const ghStdout =
      'https://github.com/acme/agentic-os/pull/42\nCreating pull request for feature/m3-landing into main';
    expect(parsePullRequestUrl(ghStdout).url).toBe('https://github.com/acme/agentic-os/pull/42');

    vi.spyOn(engine.githubService, 'createPullRequest').mockResolvedValue({
      success: true,
      url: 'https://github.com/acme/agentic-os/pull/42',
      number: 42,
      message: 'Pull request created: https://github.com/acme/agentic-os/pull/42'
    });

    const pr = await engine.createPullRequest(workspaceId, repoDir, {
      title: 'feat: update landing page copy',
      body: 'Verified in browser before shipping.'
    });
    expect(pr.success).toBe(true);
    expect(pr.number).toBe(42);
    expect(pr.url).toContain('/pull/42');

    await engine.closeBrowserSession(browser.id);
  });
});

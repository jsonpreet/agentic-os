import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execa } from 'execa';
import { BrowserCommandEvent } from '@agentic/shared-contracts';
import { LocalEngine } from '../src/engine/local-engine.js';

/**
 * Milestone 2 acceptance (automated):
 * mock STT transcript → prompt routing → browser tool → addressed agent → per-agent voice
 *
 * Manual follow-up: `pnpm dev`, mic → "Hey Tim, open example.com and describe the page"
 */
describe('Milestone 2 acceptance (engine)', () => {
  let tmpDir: string;
  let testRepoDir: string;
  let engine: LocalEngine;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-m2-'));
    testRepoDir = path.join(tmpDir, 'test-repo');
    fs.mkdirSync(testRepoDir, { recursive: true });

    await execa('git', ['init'], { cwd: testRepoDir });
    fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Test Project');
    await execa('git', ['add', '-A'], { cwd: testRepoDir });
    await execa('git', ['commit', '-m', 'chore: initial commit'], { cwd: testRepoDir });

    engine = new LocalEngine({ dbPath: path.join(tmpDir, 'test-agentic.db') });
  });

  afterEach(() => {
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('routes mock STT through browser tools and addressed agent voice setup', async () => {
    const workspaces = await engine.getWorkspaces();
    const ws = workspaces[0];
    const desktops = await engine.getDesktops(ws.id);

    // 1. Mock STT: user dictates "open browser to example.com"
    const openBrowser = await engine.sendPrompt({
      workspaceId: ws.id,
      prompt: 'open browser to example.com'
    });
    expect(openBrowser.action).toBe('app_command');
    expect(openBrowser.appCommand).toBe('open_browser');
    expect(openBrowser.browserUrl).toBe('example.com');

    // 2. Desktop opens a browser session for the active desktop
    const browser = await engine.createBrowserSession(
      desktops[0].id,
      'https://example.com'
    );
    expect(browser.url).toBe('https://example.com');

    // 3. Agent uses browser snapshot tool; renderer executor responds with page text
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
        url: 'https://example.com',
        title: 'Example Domain',
        text: 'Example Domain. This domain is for use in documentation examples.'
      }
    });

    const snapshot = await snapshotPromise;
    expect(snapshot.title).toBe('Example Domain');
    expect(snapshot.text).toContain('Example Domain');

    // 4. Mock STT: addressed instruction to an active agent
    const tim = await engine.createAgentSession({
      workspaceId: ws.id,
      desktopId: desktops[0].id,
      name: 'Tim',
      provider: 'claude',
      repoPath: testRepoDir
    });
    engine.ptyManager.setStatus(tim.id, 'idle');

    const addressed = await engine.sendPrompt({
      workspaceId: ws.id,
      prompt: 'Hey Tim, describe the example.com page'
    });
    expect(addressed.action).toBe('sent_to_active');
    expect(addressed.sessionId).toBe(tim.id);
    expect(addressed.agentName).toBe('Tim');

    // 5. Per-agent voice for TTS playback on the client
    const withVoice = await engine.setAgentVoice(
      tim.id,
      'com.apple.voice.compact.en-US.Samantha'
    );
    expect(withVoice.voice).toBe('com.apple.voice.compact.en-US.Samantha');

    await engine.terminateAgentSession(tim.id);
    await engine.closeBrowserSession(browser.id);
  });
});

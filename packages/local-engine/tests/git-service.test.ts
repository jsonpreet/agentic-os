import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execa } from 'execa';
import { parseGitStatusPorcelain } from '../src/git/git-service.js';
import { LocalEngine } from '../src/engine/local-engine.js';

describe('parseGitStatusPorcelain', () => {
  it('parses branch and changed files', () => {
    const stdout = `## main
 M README.md
?? new-file.ts
`;
    const result = parseGitStatusPorcelain(stdout, '/repo');
    expect(result.branch).toBe('main');
    expect(result.changedFiles).toHaveLength(2);
    expect(result.changedFiles[0].path).toBe('README.md');
    expect(result.changedFiles[1].kind).toBe('untracked');
    expect(result.clean).toBe(false);
  });
});

describe('GitService integration', () => {
  let tmpDir: string;
  let repoDir: string;
  let engine: LocalEngine;
  let workspaceId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-git-svc-'));
    repoDir = path.join(tmpDir, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });

    await execa('git', ['init'], { cwd: repoDir });
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Hello');
    await execa('git', ['add', '-A'], { cwd: repoDir });
    await execa('git', ['commit', '-m', 'chore: initial commit'], { cwd: repoDir });

    engine = new LocalEngine({ dbPath: path.join(tmpDir, 'test.db') });
    const ws = await engine.createWorkspace({ name: 'Git Test', repositories: [repoDir] });
    workspaceId = ws.id;
  });

  afterEach(() => {
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports modified files, stages, commits, and leaves push graceful without remote', async () => {
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Hello World');

    const status = await engine.getGitStatus(workspaceId, repoDir);
    expect(status.changedFiles.some((f) => f.path === 'README.md')).toBe(true);

    await engine.stageGitFiles(workspaceId, repoDir, ['README.md']);
    const staged = await engine.getGitStatus(workspaceId, repoDir);
    expect(staged.changedFiles.find((f) => f.path === 'README.md')?.staged).toBe(true);

    const diff = await engine.getGitDiff(workspaceId, repoDir, 'README.md', true);
    expect(diff.diff).toContain('Hello World');

    const commit = await engine.commitGit(workspaceId, repoDir, 'docs: update readme');
    expect(commit.commitHash).toBeTruthy();

    const push = await engine.pushGit(workspaceId, repoDir);
    expect(push.success).toBe(false);
  });
});

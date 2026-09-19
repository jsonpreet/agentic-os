import path from 'node:path';
import { execa } from 'execa';
import {
  GitChangedFile,
  GitChangeKind,
  GitCommitResult,
  GitDiffResult,
  GitPushResult,
  GitStatusResult
} from '@agentic/shared-contracts';
import { FileService } from '../engine/file-service.js';

function kindFromStatuses(index: string, worktree: string): GitChangeKind {
  if (index === '?' && worktree === '?') return 'untracked';
  if (index !== ' ' && index !== '?') {
    if (index === 'A') return 'added';
    if (index === 'D') return 'deleted';
    if (index === 'R') return 'renamed';
    return 'staged';
  }
  if (worktree === 'M') return 'modified';
  if (worktree === 'D') return 'deleted';
  if (worktree === '?') return 'untracked';
  return 'modified';
}

export function parseGitStatusPorcelain(stdout: string, repoPath: string): GitStatusResult {
  const lines = stdout.split('\n').filter(Boolean);
  let branch = 'HEAD';
  let upstream: string | undefined;
  let ahead: number | undefined;
  let behind: number | undefined;
  const changedFiles: GitChangedFile[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const header = line.slice(3);
      const [branchPart, trackingPart] = header.split('...');
      branch = branchPart.trim() || 'HEAD';
      if (trackingPart) {
        const tracking = trackingPart.split(' ')[0];
        upstream = tracking;
        const aheadMatch = header.match(/ahead (\d+)/);
        const behindMatch = header.match(/behind (\d+)/);
        if (aheadMatch) ahead = Number(aheadMatch[1]);
        if (behindMatch) behind = Number(behindMatch[1]);
      }
      continue;
    }

    if (line.length < 4) continue;
    const indexStatus = line[0];
    const worktreeStatus = line[1];
    const filePath = line.slice(3).trim();
    const staged = indexStatus !== ' ' && indexStatus !== '?';

    changedFiles.push({
      path: filePath,
      indexStatus,
      worktreeStatus,
      staged,
      kind: kindFromStatuses(indexStatus, worktreeStatus)
    });
  }

  return {
    repoPath,
    branch,
    upstream,
    ahead,
    behind,
    changedFiles,
    clean: changedFiles.length === 0
  };
}

export class GitService {
  constructor(private fileService: FileService) {}

  private resolveRepo(workspaceId: string, repoPath: string): string {
    const resolved = this.fileService.resolvePath(workspaceId, repoPath);
    return resolved;
  }

  async getStatus(workspaceId: string, repoPath: string): Promise<GitStatusResult> {
    const cwd = this.resolveRepo(workspaceId, repoPath);
    const { stdout } = await execa('git', ['status', '--porcelain=v1', '-b'], { cwd });
    return parseGitStatusPorcelain(stdout, cwd);
  }

  async getDiff(
    workspaceId: string,
    repoPath: string,
    filePath: string,
    staged = false
  ): Promise<GitDiffResult> {
    const cwd = this.resolveRepo(workspaceId, repoPath);
    const resolvedFile = this.fileService.resolvePath(workspaceId, path.join(cwd, filePath));

    const args = staged ? ['diff', '--cached', '--', filePath] : ['diff', '--', filePath];
    const { stdout } = await execa('git', args, { cwd });

    if (!stdout && !staged) {
      const untracked = await execa('git', ['diff', '--no-index', '/dev/null', filePath], {
        cwd,
        reject: false
      });
      return {
        path: filePath,
        diff: untracked.stdout || '',
        staged: false
      };
    }

    return {
      path: resolvedFile,
      diff: stdout,
      staged
    };
  }

  async stageFiles(
    workspaceId: string,
    repoPath: string,
    paths: string[]
  ): Promise<GitStatusResult> {
    const cwd = this.resolveRepo(workspaceId, repoPath);
    if (paths.length === 0) {
      await execa('git', ['add', '-A'], { cwd });
    } else {
      await execa('git', ['add', '--', ...paths], { cwd });
    }
    return this.getStatus(workspaceId, cwd);
  }

  async unstageFiles(
    workspaceId: string,
    repoPath: string,
    paths: string[]
  ): Promise<GitStatusResult> {
    const cwd = this.resolveRepo(workspaceId, repoPath);
    if (paths.length === 0) {
      await execa('git', ['reset'], { cwd });
    } else {
      await execa('git', ['restore', '--staged', '--', ...paths], { cwd });
    }
    return this.getStatus(workspaceId, cwd);
  }

  async commit(
    workspaceId: string,
    repoPath: string,
    message: string
  ): Promise<GitCommitResult> {
    const cwd = this.resolveRepo(workspaceId, repoPath);
    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error('Commit message is required.');
    }

    await execa('git', ['commit', '-m', trimmed], { cwd });
    const { stdout: hash } = await execa('git', ['rev-parse', '--short', 'HEAD'], { cwd });
    const status = await this.getStatus(workspaceId, cwd);

    return {
      commitHash: hash.trim(),
      branch: status.branch
    };
  }

  async push(workspaceId: string, repoPath: string): Promise<GitPushResult> {
    const cwd = this.resolveRepo(workspaceId, repoPath);

    try {
      const { stdout } = await execa('git', ['push'], { cwd });
      return { success: true, message: stdout.trim() || 'Pushed successfully.' };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Push failed. Configure a remote with git remote add.';
      return { success: false, message };
    }
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';

export interface WorktreeResult {
  worktreePath: string;
  branchName: string;
}

export class GitWorktreeManager {
  /**
   * Inspects a directory to see if it is a Git repository and has an initial commit.
   */
  async checkRepo(dirPath: string): Promise<{ isGit: boolean; hasCommits: boolean; headCommit?: string }> {
    try {
      const { stdout: isGitOutput } = await execa('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: dirPath
      });
      const isGit = isGitOutput.trim() === 'true';

      if (!isGit) {
        return { isGit: false, hasCommits: false };
      }

      try {
        const { stdout: headOutput } = await execa('git', ['rev-parse', 'HEAD'], {
          cwd: dirPath
        });
        const headCommit = headOutput.trim();
        return { isGit: true, hasCommits: Boolean(headCommit), headCommit };
      } catch {
        // Git repo initialized but no commits yet
        return { isGit: true, hasCommits: false };
      }
    } catch {
      return { isGit: false, hasCommits: false };
    }
  }

  /**
   * Initializes a Git repository and creates an initial commit so worktrees can branch off.
   */
  async initRepo(dirPath: string): Promise<{ success: boolean; headCommit: string }> {
    await execa('git', ['init'], { cwd: dirPath });

    // Ensure .agentic is ignored in git exclude
    await this.ensureExclude(dirPath);

    // Create an initial README or .gitkeep if directory is completely empty
    const files = fs.readdirSync(dirPath).filter((f) => f !== '.git' && f !== '.agentic');
    if (files.length === 0) {
      fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');
    }

    await execa('git', ['add', '-A'], { cwd: dirPath });
    await execa('git', ['commit', '-m', 'chore: initial repository commit'], { cwd: dirPath });

    const { stdout: headOutput } = await execa('git', ['rev-parse', 'HEAD'], { cwd: dirPath });
    return { success: true, headCommit: headOutput.trim() };
  }

  /**
   * Creates an isolated worktree and branch for an agent task.
   */
  async createWorktree(
    repoPath: string,
    agentName: string,
    sessionId: string
  ): Promise<WorktreeResult> {
    const check = await this.checkRepo(repoPath);
    if (!check.isGit || !check.hasCommits) {
      throw new Error(`Repository at ${repoPath} must have a valid commit before creating worktrees.`);
    }

    await this.ensureExclude(repoPath);

    const safeName = agentName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const shortId = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    const branchName = `agent/${safeName}-${shortId}`;
    const worktreesDir = path.join(repoPath, '.agentic', 'worktrees');
    const worktreePath = path.join(worktreesDir, `${safeName}-${shortId}`);

    if (!fs.existsSync(worktreesDir)) {
      fs.mkdirSync(worktreesDir, { recursive: true });
    }

    // Run: git worktree add -b <branchName> <worktreePath> HEAD
    await execa('git', ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], {
      cwd: repoPath
    });

    return {
      worktreePath,
      branchName
    };
  }

  /**
   * Removes an isolated worktree when an agent task finishes or is cleaned up.
   */
  async removeWorktree(repoPath: string, worktreePath: string, force = true): Promise<void> {
    if (!fs.existsSync(worktreePath)) {
      return;
    }

    const args = ['worktree', 'remove'];
    if (force) {
      args.push('--force');
    }
    args.push(worktreePath);

    await execa('git', args, { cwd: repoPath });
  }

  /**
   * Appends .agentic/ to .git/info/exclude to avoid dirtying git status.
   */
  private async ensureExclude(repoPath: string): Promise<void> {
    try {
      const gitDir = path.join(repoPath, '.git');
      if (!fs.existsSync(gitDir)) return;

      const excludePath = path.join(gitDir, 'info', 'exclude');
      const excludeDir = path.dirname(excludePath);
      if (!fs.existsSync(excludeDir)) {
        fs.mkdirSync(excludeDir, { recursive: true });
      }

      let content = '';
      if (fs.existsSync(excludePath)) {
        content = fs.readFileSync(excludePath, 'utf-8');
      }

      if (!content.includes('.agentic')) {
        fs.appendFileSync(excludePath, '\n.agentic/\n');
      }
    } catch {
      // Ignore exclude errors if git directory is managed externally
    }
  }
}

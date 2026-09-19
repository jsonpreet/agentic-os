import { execa } from 'execa';
import {
  CreatePullRequestResult,
  GitHubAuthStatus,
  GitHubCliInfo
} from '@agentic/shared-contracts';
import { FileService } from '../engine/file-service.js';
import { getSearchPaths, getShellEnvironment } from '../discovery/shell-env.js';
import fs from 'node:fs';
import path from 'node:path';

export function parseGhAuthStatus(stdout: string, stderr: string): GitHubAuthStatus {
  const combined = `${stdout}\n${stderr}`.trim();

  if (/not logged in/i.test(combined)) {
    return {
      isInstalled: true,
      isAuthenticated: false,
      message: 'Not signed in. Run `gh auth login` in a terminal.'
    };
  }

  const loggedInMatch = combined.match(
    /Logged in to ([^\s]+).*account ([^\s(]+)/i
  );
  const protocolMatch = combined.match(/Git operations protocol:\s*(\S+)/i);

  if (loggedInMatch) {
    return {
      isInstalled: true,
      isAuthenticated: true,
      hostname: loggedInMatch[1],
      username: loggedInMatch[2],
      protocol: protocolMatch?.[1],
      message: `Signed in as ${loggedInMatch[2]} on ${loggedInMatch[1]}`
    };
  }

  return {
    isInstalled: true,
    isAuthenticated: false,
    message: combined || 'Could not determine GitHub auth status.'
  };
}

export function parsePullRequestUrl(stdout: string): { url?: string; number?: number } {
  const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/);
  if (!urlMatch) return {};
  return {
    url: urlMatch[0],
    number: Number(urlMatch[1])
  };
}

export class GitHubService {
  constructor(private fileService: FileService) {}

  private resolveRepo(workspaceId: string, repoPath: string): string {
    return this.fileService.resolvePath(workspaceId, repoPath);
  }

  async findExecutable(): Promise<GitHubCliInfo> {
    const searchPaths = await getSearchPaths();
    const env = await getShellEnvironment();

    for (const dir of searchPaths) {
      const candidate = path.join(dir, 'gh');
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          const version = await this.readVersion(candidate, env);
          return {
            isInstalled: true,
            executablePath: candidate,
            version
          };
        }
      } catch {
        // try next path
      }
    }

    try {
      const { stdout } = await execa('which', ['gh'], { env, reject: false });
      const resolved = stdout.trim();
      if (resolved) {
        const version = await this.readVersion(resolved, env);
        return { isInstalled: true, executablePath: resolved, version };
      }
    } catch {
      // gh not on PATH
    }

    return { isInstalled: false };
  }

  private async readVersion(executablePath: string, env: NodeJS.ProcessEnv): Promise<string> {
    try {
      const { stdout } = await execa(executablePath, ['--version'], { env, timeout: 3000 });
      return stdout.trim().split('\n')[0] || 'Unknown';
    } catch {
      return 'Detected';
    }
  }

  private async resolveGh(): Promise<string> {
    const info = await this.findExecutable();
    if (!info.isInstalled || !info.executablePath) {
      throw new Error('GitHub CLI (gh) is not installed. Install from https://cli.github.com');
    }
    return info.executablePath;
  }

  async getAuthStatus(): Promise<GitHubAuthStatus> {
    const cli = await this.findExecutable();
    if (!cli.isInstalled || !cli.executablePath) {
      return {
        isInstalled: false,
        isAuthenticated: false,
        message: 'GitHub CLI (gh) is not installed.'
      };
    }

    const env = await getShellEnvironment();
    const result = await execa(cli.executablePath, ['auth', 'status'], {
      env,
      reject: false
    });

    if (result.exitCode === 0) {
      return parseGhAuthStatus(result.stdout, result.stderr);
    }

    const parsed = parseGhAuthStatus(result.stdout, result.stderr);
    if (!parsed.isAuthenticated) {
      return parsed;
    }

    return {
      isInstalled: true,
      isAuthenticated: false,
      message: (result.stderr || result.stdout).trim() || 'GitHub auth check failed.'
    };
  }

  async createPullRequest(
    workspaceId: string,
    repoPath: string,
    options: {
      title: string;
      body?: string;
      base?: string;
      draft?: boolean;
    }
  ): Promise<CreatePullRequestResult> {
    const auth = await this.getAuthStatus();
    if (!auth.isInstalled) {
      return { success: false, message: auth.message };
    }
    if (!auth.isAuthenticated) {
      return { success: false, message: auth.message };
    }

    const cwd = this.resolveRepo(workspaceId, repoPath);
    const gh = await this.resolveGh();
    const env = await getShellEnvironment();
    const title = options.title.trim();
    if (!title) {
      return { success: false, message: 'Pull request title is required.' };
    }

    const args = ['pr', 'create', '--title', title];
    if (options.body?.trim()) {
      args.push('--body', options.body.trim());
    }
    if (options.base?.trim()) {
      args.push('--base', options.base.trim());
    }
    if (options.draft) {
      args.push('--draft');
    }

    try {
      const { stdout } = await execa(gh, args, { cwd, env });
      const { url, number } = parsePullRequestUrl(stdout);
      return {
        success: true,
        url,
        number,
        message: url ? `Pull request created: ${url}` : stdout.trim() || 'Pull request created.'
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create pull request with gh.';
      return { success: false, message };
    }
  }
}

import { execa } from 'execa';

let cachedEnv: Record<string, string> | null = null;

/**
 * Retrieves the full interactive login shell environment on macOS.
 * Ensures GUI apps launched outside a terminal can locate executables
 * in /opt/homebrew/bin, ~/.nvm, ~/.cargo/bin, etc.
 */
export async function getShellEnvironment(): Promise<Record<string, string>> {
  if (cachedEnv) {
    return cachedEnv;
  }

  const shell = process.env.SHELL || '/bin/zsh';

  try {
    // -i = interactive, -l = login, -c = command
    // Use a quick timeout to prevent hanging if the user's rc file has interactive prompts
    const { stdout } = await execa(shell, ['-ilc', 'env'], {
      timeout: 3000,
      env: { ...process.env, TERM: 'dumb' }
    });

    const env: Record<string, string> = {};
    for (const line of stdout.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const key = line.slice(0, idx);
        const val = line.slice(idx + 1);
        env[key] = val;
      }
    }

    cachedEnv = env;
    return env;
  } catch {
    // Fallback to process.env if login shell execution fails or times out
    return process.env as Record<string, string>;
  }
}

/**
 * Returns candidate directory paths where CLIs may be installed on macOS.
 */
export async function getSearchPaths(): Promise<string[]> {
  const env = await getShellEnvironment();
  const pathStr = env.PATH || process.env.PATH || '';
  const paths = pathStr.split(':').filter(Boolean);

  const home = env.HOME || process.env.HOME || '';
  const standardPaths = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    `${home}/.local/bin`,
    `${home}/.cargo/bin`,
    `${home}/.gemini/bin`,
    `${home}/Library/Application Support/cursor/bin`
  ];

  const unique = new Set<string>();
  for (const p of [...paths, ...standardPaths]) {
    if (p) unique.add(p);
  }

  return Array.from(unique);
}

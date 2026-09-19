import { execa } from 'execa';
import { AgentProvider, ProviderUsageSnapshot, UsageAdapter } from '@agentic/shared-contracts';
import { getShellEnvironment } from '../discovery/shell-env.js';
import {
  claudeUsageFromAuth,
  codexUsageFromLogin,
  geminiUsageFromAuth,
  parseClaudeAuthStatus,
  parseCodexLoginStatus,
  parseGeminiAuthStatus,
  unavailableUsage
} from './usage-parsers.js';

async function runCli(
  executablePath: string,
  args: string[],
  timeoutMs = 8_000
): Promise<{ stdout: string; stderr: string }> {
  const env = await getShellEnvironment();
  const result = await execa(executablePath, args, {
    env,
    timeout: timeoutMs,
    reject: false
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}

class ClaudeUsageAdapter implements UsageAdapter {
  provider: AgentProvider = 'claude';

  async fetch(context: { executablePath?: string; activeSessions: number }): Promise<ProviderUsageSnapshot> {
    if (!context.executablePath) {
      return unavailableUsage('claude', context.activeSessions, 'Claude CLI not detected on this device.');
    }

    const { stdout, stderr } = await runCli(context.executablePath, ['auth', 'status']);
    const auth = parseClaudeAuthStatus(stdout || stderr);
    return claudeUsageFromAuth(auth, context.activeSessions);
  }
}

class CodexUsageAdapter implements UsageAdapter {
  provider: AgentProvider = 'codex';

  async fetch(context: { executablePath?: string; activeSessions: number }): Promise<ProviderUsageSnapshot> {
    if (!context.executablePath) {
      return unavailableUsage('codex', context.activeSessions, 'Codex CLI not detected on this device.');
    }

    const { stdout, stderr } = await runCli(context.executablePath, ['login', 'status']);
    const login = parseCodexLoginStatus(stdout || stderr);
    return codexUsageFromLogin(login, context.activeSessions);
  }
}

class GeminiUsageAdapter implements UsageAdapter {
  provider: AgentProvider = 'gemini';

  async fetch(context: { executablePath?: string; activeSessions: number }): Promise<ProviderUsageSnapshot> {
    if (!context.executablePath) {
      return unavailableUsage('gemini', context.activeSessions, 'Gemini CLI not detected on this device.');
    }

    const { stdout, stderr } = await runCli(context.executablePath, ['auth', 'status']);
    const auth = parseGeminiAuthStatus(`${stdout}\n${stderr}`);
    return geminiUsageFromAuth(auth, context.activeSessions);
  }
}

const ADAPTERS: UsageAdapter[] = [
  new ClaudeUsageAdapter(),
  new CodexUsageAdapter(),
  new GeminiUsageAdapter()
];

export function getUsageAdapters(): UsageAdapter[] {
  return ADAPTERS;
}

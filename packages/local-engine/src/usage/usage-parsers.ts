import { ProviderUsageSnapshot } from '@agentic/shared-contracts';

export interface ClaudeAuthStatus {
  loggedIn: boolean;
  authMethod?: string;
  apiProvider?: string;
  email?: string;
}

export function parseClaudeAuthStatus(raw: string): ClaudeAuthStatus {
  try {
    const parsed = JSON.parse(raw) as ClaudeAuthStatus & { email?: string };
    return {
      loggedIn: Boolean(parsed.loggedIn),
      authMethod: parsed.authMethod,
      apiProvider: parsed.apiProvider,
      email: parsed.email
    };
  } catch {
    return { loggedIn: false };
  }
}

export function claudeUsageFromAuth(
  auth: ClaudeAuthStatus,
  activeSessions: number
): ProviderUsageSnapshot {
  if (!auth.loggedIn) {
    return {
      provider: 'claude',
      accountLabel: 'Not signed in',
      activeSessions,
      availability: 'unavailable',
      source: 'claude auth status',
      message: 'Run `claude auth login` to connect this provider.'
    };
  }

  return {
    provider: 'claude',
    accountLabel: auth.email ?? auth.apiProvider ?? 'Signed in',
    activeSessions,
    availability: 'available',
    source: 'claude auth status',
    message:
      'Signed in via CLI. Allowance and reset time are not exposed by Claude Code yet.'
  };
}

export function parseCodexLoginStatus(raw: string): { loggedIn: boolean; accountLabel?: string } {
  const text = raw.trim();
  if (!text || /not logged in/i.test(text)) {
    return { loggedIn: false };
  }

  const match = text.match(/Logged in using (.+)/i);
  return {
    loggedIn: true,
    accountLabel: match?.[1]?.trim() ?? 'Signed in'
  };
}

export function codexUsageFromLogin(
  login: { loggedIn: boolean; accountLabel?: string },
  activeSessions: number
): ProviderUsageSnapshot {
  if (!login.loggedIn) {
    return {
      provider: 'codex',
      accountLabel: 'Not signed in',
      activeSessions,
      availability: 'unavailable',
      source: 'codex login status',
      message: 'Run `codex login` to connect this provider.'
    };
  }

  return {
    provider: 'codex',
    accountLabel: login.accountLabel ?? 'Signed in',
    activeSessions,
    availability: 'available',
    source: 'codex login status',
    message: 'Signed in via CLI. Allowance data is not exposed by Codex yet.'
  };
}

export function parseGeminiAuthStatus(raw: string): { configured: boolean; message: string } {
  const text = raw.trim();
  if (!text) {
    return { configured: false, message: 'Gemini CLI returned no auth status.' };
  }
  if (/please set an auth method/i.test(text) || /GEMINI_API_KEY/i.test(text)) {
    return {
      configured: false,
      message: 'Configure GEMINI_API_KEY or auth in ~/.gemini/settings.json.'
    };
  }
  return { configured: true, message: 'Auth configured for Gemini CLI.' };
}

export function geminiUsageFromAuth(
  auth: { configured: boolean; message: string },
  activeSessions: number
): ProviderUsageSnapshot {
  if (!auth.configured) {
    return {
      provider: 'gemini',
      accountLabel: 'Not configured',
      activeSessions,
      availability: 'unavailable',
      source: 'gemini auth status',
      message: auth.message
    };
  }

  return {
    provider: 'gemini',
    accountLabel: 'Configured',
    activeSessions,
    availability: 'available',
    source: 'gemini auth status',
    message: `${auth.message} Allowance data is not exposed by Gemini CLI yet.`
  };
}

export function unavailableUsage(
  provider: ProviderUsageSnapshot['provider'],
  activeSessions: number,
  message: string
): ProviderUsageSnapshot {
  return {
    provider,
    accountLabel: 'Unavailable',
    activeSessions,
    availability: 'unavailable',
    source: 'local-engine',
    message
  };
}

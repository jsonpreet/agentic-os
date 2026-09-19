import { describe, expect, it } from 'vitest';
import {
  claudeUsageFromAuth,
  codexUsageFromLogin,
  geminiUsageFromAuth,
  parseClaudeAuthStatus,
  parseCodexLoginStatus,
  parseGeminiAuthStatus
} from '../src/usage/usage-parsers.js';

describe('usage parsers', () => {
  it('parses claude auth status JSON', () => {
    const auth = parseClaudeAuthStatus(
      JSON.stringify({
        loggedIn: true,
        authMethod: 'oauth',
        apiProvider: 'firstParty',
        email: 'dev@anthropic.com'
      })
    );
    const usage = claudeUsageFromAuth(auth, 2);
    expect(usage.availability).toBe('available');
    expect(usage.accountLabel).toBe('dev@anthropic.com');
    expect(usage.activeSessions).toBe(2);
  });

  it('parses codex login status text', () => {
    const login = parseCodexLoginStatus('Logged in using ChatGPT\n');
    const usage = codexUsageFromLogin(login, 1);
    expect(usage.availability).toBe('available');
    expect(usage.accountLabel).toBe('ChatGPT');
  });

  it('marks gemini as unavailable when auth is missing', () => {
    const auth = parseGeminiAuthStatus(
      'Please set an Auth method in your ~/.gemini/settings.json or specify GEMINI_API_KEY'
    );
    const usage = geminiUsageFromAuth(auth, 0);
    expect(usage.availability).toBe('unavailable');
  });
});

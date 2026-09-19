import { describe, it, expect } from 'vitest';
import {
  parseGhAuthStatus,
  parsePullRequestUrl
} from '../src/git/github-service.js';

describe('parseGhAuthStatus', () => {
  it('detects signed-in user', () => {
    const stdout = `github.com
  ✓ Logged in to github.com account stark-dev (keyring)
  - Active account: true
  - Git operations protocol: https
`;
    const result = parseGhAuthStatus(stdout, '');
    expect(result.isAuthenticated).toBe(true);
    expect(result.username).toBe('stark-dev');
    expect(result.hostname).toBe('github.com');
    expect(result.protocol).toBe('https');
  });

  it('detects signed-out state', () => {
    const stderr = 'You are not logged into any GitHub hosts.';
    const result = parseGhAuthStatus('', stderr);
    expect(result.isAuthenticated).toBe(false);
    expect(result.message).toContain('gh auth login');
  });
});

describe('parsePullRequestUrl', () => {
  it('extracts PR url and number', () => {
    const stdout =
      'https://github.com/acme/agentic-os/pull/42\nCreating pull request for feature into main in acme/agentic-os';
    const result = parsePullRequestUrl(stdout);
    expect(result.url).toBe('https://github.com/acme/agentic-os/pull/42');
    expect(result.number).toBe(42);
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveUiTheme } from '../src/renderer/src/lib/ui-theme.js';

describe('resolveUiTheme', () => {
  beforeEach(() => {
    const matchMedia = (query: string) => ({
      matches: query.includes('dark'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    vi.stubGlobal('matchMedia', matchMedia);
    (globalThis as { window: typeof globalThis }).window = globalThis as Window & typeof globalThis;
    globalThis.matchMedia = matchMedia as typeof window.matchMedia;
  });

  it('returns light for light preference', () => {
    expect(resolveUiTheme('light')).toBe('light');
  });

  it('returns dark for dark preference', () => {
    expect(resolveUiTheme('dark')).toBe('dark');
  });

  it('follows system preference', () => {
    expect(resolveUiTheme('system')).toBe('dark');
  });
});

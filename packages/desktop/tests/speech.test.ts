import { describe, it, expect } from 'vitest';
import { filterSpeechText, stripAnsi } from '../src/renderer/src/lib/speech/text-filter.js';

describe('speech text filter', () => {
  it('strips ANSI escape sequences', () => {
    expect(stripAnsi('\x1b[32mhello\x1b[0m')).toBe('hello');
  });

  it('removes fenced code blocks from TTS text', () => {
    const input = 'Here is the fix:\n```ts\nconst x = 1;\n```\nDone.';
    expect(filterSpeechText(input)).toBe('Here is the fix: Done.');
  });

  it('skips path-only output', () => {
    expect(filterSpeechText('/Users/dev/project/src/index.ts')).toBe('');
  });
});

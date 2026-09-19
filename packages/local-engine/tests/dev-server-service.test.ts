import { describe, expect, it } from 'vitest';
import { detectDevServerUrl, portFromUrl } from '../src/engine/dev-server-service.js';

describe('detectDevServerUrl', () => {
  it('extracts the last localhost URL from Vite output', () => {
    const line =
      '  VITE v5.0.0  ready in 120 ms\n\n  ➜  Local:   http://localhost:5173/\n';
    expect(detectDevServerUrl(line)).toBe('http://localhost:5173/');
  });

  it('strips trailing punctuation from matched URLs', () => {
    expect(detectDevServerUrl('listening on http://127.0.0.1:3000),')).toBe(
      'http://127.0.0.1:3000/'
    );
  });

  it('returns undefined when no local URL is present', () => {
    expect(detectDevServerUrl('Starting dev server...')).toBeUndefined();
  });
});

describe('portFromUrl', () => {
  it('reads explicit ports', () => {
    expect(portFromUrl('http://localhost:4173/')).toBe(4173);
  });

  it('defaults http to port 80', () => {
    expect(portFromUrl('http://localhost/')).toBe(80);
  });
});

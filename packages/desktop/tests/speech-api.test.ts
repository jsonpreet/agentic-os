import { describe, expect, it, vi, afterEach } from 'vitest';
import { DEFAULT_SPEECH_SETTINGS } from '@agentic/shared-contracts';
import {
  normalizeSpeechApiBaseUrl,
  speechApiConfigured,
  testSpeechApiConnection
} from '../src/renderer/src/lib/speech/speech-api.js';

describe('speech API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('strips trailing slashes from the base URL', () => {
    expect(normalizeSpeechApiBaseUrl('https://api.openai.com/v1/')).toBe(
      'https://api.openai.com/v1'
    );
  });

  it('requires a base URL and API key', () => {
    expect(
      speechApiConfigured({
        ...DEFAULT_SPEECH_SETTINGS,
        speechApiBaseUrl: '',
        speechApiKey: 'sk-test'
      })
    ).toBe(false);
    expect(
      speechApiConfigured({
        ...DEFAULT_SPEECH_SETTINGS,
        speechApiKey: 'sk-test'
      })
    ).toBe(true);
  });

  it('reports a connected models list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'whisper-1' }, { id: 'tts-1' }] })
      })
    );

    const result = await testSpeechApiConnection({
      speechApiBaseUrl: 'https://api.openai.com/v1',
      speechApiKey: 'sk-test'
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('2 models');
  });

  it('returns API error text when auth fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ error: { message: 'Incorrect API key' } })
      })
    );

    const result = await testSpeechApiConnection({
      speechApiBaseUrl: 'https://api.openai.com/v1',
      speechApiKey: 'sk-bad'
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Incorrect API key');
  });
});

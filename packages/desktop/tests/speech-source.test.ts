import { describe, expect, it } from 'vitest';
import { applySttSource, sttSource, ttsSource } from '../src/renderer/src/lib/speech/speech-source.js';
import { DEFAULT_SPEECH_SETTINGS } from '@agentic/shared-contracts';

describe('speech source windows', () => {
  it('maps providers to local vs api vs disabled', () => {
    expect(sttSource('web-speech')).toBe('local');
    expect(sttSource('local-model')).toBe('local');
    expect(sttSource('api')).toBe('api');
    expect(ttsSource('macos-say')).toBe('local');
    expect(ttsSource('disabled')).toBe('disabled');
  });

  it('keeps the last local model when switching back from API', () => {
    const patch = applySttSource(
      { ...DEFAULT_SPEECH_SETTINGS, localSttModelId: 'whisper-tiny' },
      'local'
    );
    expect(patch.sttProvider).toBe('local-model');
  });
});

import { describe, it, expect } from 'vitest';
import * as contracts from '../src/index.js';

describe('Shared Contracts', () => {
  it('exports all core domain contracts', () => {
    expect(contracts).toBeDefined();
  });

  it('lists local-compatible Whisper and Piper models', () => {
    const stt = contracts.LOCAL_SPEECH_MODEL_CATALOG.filter((model) => model.kind === 'stt');
    const tts = contracts.LOCAL_SPEECH_MODEL_CATALOG.filter((model) => model.kind === 'tts');
    expect(stt.map((model) => model.id)).toEqual(
      expect.arrayContaining([
        'web-speech-stt',
        'whisper-tiny',
        'whisper-tiny.en',
        'whisper-base',
        'whisper-base.en',
        'whisper-small',
        'whisper-small.en',
        'whisper-medium',
        'whisper-medium.en',
        'whisper-large-v3-turbo',
        'whisper-large-v3'
      ])
    );
    expect(tts.map((model) => model.id)).toEqual(
      expect.arrayContaining([
        'web-speech-tts',
        'macos-say',
        'piper-en-us-lessac-medium',
        'piper-en-us-amy-medium',
        'piper-en-gb-alan-medium'
      ])
    );
  });
});

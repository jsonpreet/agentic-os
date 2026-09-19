import { describe, expect, it } from 'vitest';
import { catalogSpeechModels, LOCAL_SPEECH_MODEL_CATALOG } from '@agentic/shared-contracts';
import { listSpeechModels } from '../src/engine/speech-models.js';

describe('local speech models', () => {
  it('lists builtin STT/TTS engines as ready', () => {
    const models = listSpeechModels('darwin');
    expect(models.find((model) => model.id === 'web-speech-stt')?.status).toBe('ready');
    expect(models.find((model) => model.id === 'macos-say')?.status).toBe('ready');
  });

  it('hides macOS Say on non-darwin platforms', () => {
    const models = listSpeechModels('linux');
    expect(models.find((model) => model.id === 'macos-say')?.status).toBe('unavailable');
  });

  it('lists whisper.cpp and piper models for local use', () => {
    const stt = LOCAL_SPEECH_MODEL_CATALOG.filter((model) => model.kind === 'stt');
    const tts = LOCAL_SPEECH_MODEL_CATALOG.filter((model) => model.kind === 'tts');
    expect(stt.length).toBeGreaterThanOrEqual(10);
    expect(tts.some((model) => model.id.startsWith('piper-'))).toBe(true);
    expect(catalogSpeechModels('darwin').find((model) => model.id === 'whisper-tiny')?.status).toBe(
      'available'
    );
  });
});

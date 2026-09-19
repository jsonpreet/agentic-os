import { SpeechSettings, SpeechSourceId, STTProviderId, TTSProviderId } from '@agentic/shared-contracts';

export function sttSource(provider: STTProviderId): SpeechSourceId {
  if (provider === 'disabled') return 'disabled';
  if (provider === 'api') return 'api';
  return 'local';
}

export function ttsSource(provider: TTSProviderId): SpeechSourceId {
  if (provider === 'disabled') return 'disabled';
  if (provider === 'api') return 'api';
  return 'local';
}

export function sttProviderForLocalModel(modelId: string): STTProviderId {
  return modelId === 'web-speech-stt' ? 'web-speech' : 'local-model';
}

export function ttsProviderForLocalModel(modelId: string): TTSProviderId {
  return modelId === 'macos-say' ? 'macos-say' : 'web-speech';
}

export function applySttSource(
  settings: SpeechSettings,
  source: SpeechSourceId
): Partial<SpeechSettings> {
  if (source === 'api') return { sttProvider: 'api' };
  if (source === 'disabled') return { sttProvider: 'disabled' };
  return {
    sttProvider: sttProviderForLocalModel(settings.localSttModelId)
  };
}

export function applyTtsSource(
  settings: SpeechSettings,
  source: SpeechSourceId
): Partial<SpeechSettings> {
  if (source === 'api') return { ttsProvider: 'api' };
  if (source === 'disabled') return { ttsProvider: 'disabled' };
  return {
    ttsProvider: ttsProviderForLocalModel(settings.localTtsModelId)
  };
}

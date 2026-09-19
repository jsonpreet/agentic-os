import { DEFAULT_SPEECH_SETTINGS, SpeechSettings } from '@agentic/shared-contracts';

const STORAGE_KEY = 'agentic-speech-settings';

export function getSpeechSettings(): SpeechSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SPEECH_SETTINGS;
    return { ...DEFAULT_SPEECH_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SPEECH_SETTINGS;
  }
}

export function saveSpeechSettings(settings: SpeechSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

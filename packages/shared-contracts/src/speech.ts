export type STTProviderId = 'web-speech' | 'local-model' | 'api' | 'disabled';
export type TTSProviderId = 'web-speech' | 'macos-say' | 'api' | 'disabled';

export type SpeechSourceId = 'local' | 'api' | 'disabled';
export type SpeechModelKind = 'stt' | 'tts';
export type SpeechModelInstallStatus =
  | 'ready'
  | 'available'
  | 'downloading'
  | 'error'
  | 'unavailable';

export interface SpeechModelStatus {
  id: string;
  name: string;
  kind: SpeechModelKind;
  source: 'builtin' | 'download';
  description: string;
  sizeLabel: string;
  status: SpeechModelInstallStatus;
  bytesReceived?: number;
  bytesTotal?: number;
  error?: string;
}

export interface SpeechSettings {
  sttProvider: STTProviderId;
  ttsProvider: TTSProviderId;
  ttsEnabled: boolean;
  ttsMuted: boolean;
  defaultVoice?: string;
  speechRate: number;
  language: string;
  speechApiBaseUrl: string;
  speechApiKey: string;
  speechApiSttModel: string;
  speechApiTtsModel: string;
  speechApiTtsVoice: string;
  localSttModelId: string;
  localTtsModelId: string;
}

export const DEFAULT_SPEECH_SETTINGS: SpeechSettings = {
  sttProvider: 'web-speech',
  ttsProvider: 'web-speech',
  ttsEnabled: true,
  ttsMuted: false,
  speechRate: 1,
  language: 'en-US',
  speechApiBaseUrl: 'https://api.openai.com/v1',
  speechApiKey: '',
  speechApiSttModel: 'whisper-1',
  speechApiTtsModel: 'tts-1',
  speechApiTtsVoice: 'alloy',
  localSttModelId: 'web-speech-stt',
  localTtsModelId: 'web-speech-tts'
};

export interface VoiceOption {
  id: string;
  name: string;
  language?: string;
}

export interface SpeakRequest {
  text: string;
  voiceId?: string;
  rate?: number;
}

import { SpeechSettings } from '@agentic/shared-contracts';
import { filterSpeechText } from './text-filter.js';
import { getSpeechSettings } from './settings.js';
import { synthesizeSpeechApi } from './speech-api.js';

type QueueItem = { text: string; voiceId?: string; rate: number };

class SpeechPlaybackQueue {
  private queue: QueueItem[] = [];
  private playing = false;
  private settings: SpeechSettings = getSpeechSettings();
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;

  refreshSettings(): void {
    this.settings = getSpeechSettings();
  }

  setMuted(muted: boolean): void {
    this.settings = { ...this.settings, ttsMuted: muted };
    if (muted) this.stop();
  }

  async enqueue(text: string, voiceId?: string): Promise<void> {
    this.refreshSettings();
    if (!this.settings.ttsEnabled || this.settings.ttsMuted) return;
    if (this.settings.ttsProvider === 'disabled') return;

    const cleaned = filterSpeechText(text);
    if (!cleaned) return;

    this.queue.push({
      text: cleaned,
      voiceId,
      rate: this.settings.speechRate
    });
    await this.drain();
  }

  stop(): void {
    this.queue = [];
    this.playing = false;
    this.stopApiAudio();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    window.agenticApi?.stopSpeech().catch(() => {});
  }

  private stopApiAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  private async drain(): Promise<void> {
    if (this.playing) return;
    this.playing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      await this.speakItem(item);
    }

    this.playing = false;
  }

  private async speakItem(item: QueueItem): Promise<void> {
    const provider = this.settings.ttsProvider;

    if (provider === 'web-speech') {
      await this.speakWebSpeech(item);
      return;
    }

    if (provider === 'api') {
      await this.speakApi(item);
      return;
    }

    if (provider === 'macos-say' && window.agenticApi) {
      await window.agenticApi.speakText({
        text: item.text,
        voiceId: item.voiceId,
        rate: item.rate
      });
    }
  }

  private async speakApi(item: QueueItem): Promise<void> {
    const buffer = await synthesizeSpeechApi(this.settings, item.text, item.voiceId);
    const blob = new Blob([buffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    this.currentObjectUrl = url;

    await new Promise<void>((resolve) => {
      const audio = new Audio(url);
      this.currentAudio = audio;
      audio.onended = () => {
        this.stopApiAudio();
        resolve();
      };
      audio.onerror = () => {
        this.stopApiAudio();
        resolve();
      };
      audio.play().catch(() => resolve());
    });
  }

  private speakWebSpeech(item: QueueItem): Promise<void> {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.rate = item.rate;
      utterance.lang = this.settings.language;

      if (item.voiceId) {
        const voice = window.speechSynthesis
          .getVoices()
          .find((v) => v.voiceURI === item.voiceId || v.name === item.voiceId);
        if (voice) utterance.voice = voice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }
}

export const speechQueue = new SpeechPlaybackQueue();

export function getWebSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

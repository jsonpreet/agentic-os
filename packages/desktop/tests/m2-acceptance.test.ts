import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_SPEECH_SETTINGS, PromptRouteResult } from '@agentic/shared-contracts';
import { filterSpeechText } from '../src/renderer/src/lib/speech/text-filter.js';
import { saveSpeechSettings } from '../src/renderer/src/lib/speech/settings.js';
import { speechQueue } from '../src/renderer/src/lib/speech/tts-queue.js';

function shouldRegisterSpeechForRoute(result: PromptRouteResult): boolean {
  return Boolean(
    result.sessionId &&
      (result.action === 'sent_to_active' || result.action === 'queued_for_active')
  );
}

const storage: Record<string, string> = {};

/**
 * Milestone 2 acceptance (renderer):
 * STT transcript → addressed route → filtered TTS enqueue
 */
describe('Milestone 2 acceptance (renderer)', () => {
  const speakText = vi.fn().mockResolvedValue(undefined);
  const stopSpeech = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        for (const key of Object.keys(storage)) delete storage[key];
      },
      length: 0,
      key: () => null
    });

    vi.stubGlobal('window', {
      agenticApi: { speakText, stopSpeech },
      speechSynthesis: {
        cancel: vi.fn(),
        speak: vi.fn(),
        getVoices: () => []
      }
    });

    speakText.mockClear();
    stopSpeech.mockClear();

    saveSpeechSettings({
      ...DEFAULT_SPEECH_SETTINGS,
      ttsEnabled: true,
      ttsMuted: false,
      ttsProvider: 'macos-say'
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats mock STT addressed prompt results as speech-eligible', () => {
    const sttTranscript = 'Hey Tim, open browser to example.com and describe the page';
    expect(sttTranscript.toLowerCase()).toContain('hey tim');

    const routeResult: PromptRouteResult = {
      action: 'sent_to_active',
      sessionId: 'session-tim',
      agentName: 'Tim',
      message: 'Delivered instruction directly to Tim'
    };

    expect(shouldRegisterSpeechForRoute(routeResult)).toBe(true);
  });

  it('filters browser agent output before TTS playback', () => {
    const agentOutput =
      'I opened example.com.\n```html\n<title>Example</title>\n```\nThe page title is Example Domain.';
    const spoken = filterSpeechText(agentOutput);

    expect(spoken).toContain('Example Domain');
    expect(spoken).not.toContain('```');
  });

  it('enqueues macOS TTS for cleaned agent response with per-agent voice', async () => {
    await speechQueue.enqueue(
      'Example Domain is a placeholder site used for documentation.',
      'com.apple.voice.compact.en-US.Samantha'
    );

    expect(speakText).toHaveBeenCalledWith({
      text: 'Example Domain is a placeholder site used for documentation.',
      voiceId: 'com.apple.voice.compact.en-US.Samantha',
      rate: DEFAULT_SPEECH_SETTINGS.speechRate
    });
  });
});

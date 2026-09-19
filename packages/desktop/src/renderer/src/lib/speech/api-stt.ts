import { getSpeechSettings } from './settings.js';
import { transcribeSpeechApi } from './speech-api.js';
import type { WebSTTSession } from './web-stt.js';

export function startApiSTT(options: {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}): WebSTTSession | null {
  const settings = getSpeechSettings();
  if (!settings.speechApiKey.trim()) {
    options.onError('Add a speech API key in Settings → Speech.');
    return null;
  }

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  const chunks: BlobPart[] = [];
  let stopped = false;

  const cleanup = () => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    recorder = null;
  };

  navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((media) => {
      if (stopped) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = media;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      recorder = new MediaRecorder(media, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => options.onError('Microphone recording failed.');
      recorder.start();
      options.onInterim('Listening…');
    })
    .catch(() => {
      options.onError('Microphone permission was denied.');
    });

  return {
    stop: () => {
      stopped = true;
      const active = recorder;
      if (!active || active.state === 'inactive') {
        cleanup();
        return;
      }

      active.onstop = async () => {
        cleanup();
        const blob = new Blob(chunks, { type: active.mimeType || 'audio/webm' });
        if (blob.size < 256) {
          options.onError('Recording was too short.');
          return;
        }
        try {
          const text = await transcribeSpeechApi(getSpeechSettings(), blob);
          if (text) options.onFinal(text);
        } catch (error) {
          options.onError(error instanceof Error ? error.message : 'Transcription failed.');
        }
      };
      active.stop();
    }
  };
}

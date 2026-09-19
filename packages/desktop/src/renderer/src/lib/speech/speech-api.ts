import { SpeechSettings } from '@agentic/shared-contracts';

export const OPENAI_TTS_VOICES = [
  'alloy',
  'ash',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer'
] as const;

export function normalizeSpeechApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function speechApiConfigured(settings: SpeechSettings): boolean {
  return Boolean(normalizeSpeechApiBaseUrl(settings.speechApiBaseUrl) && settings.speechApiKey.trim());
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey.trim()}`
  };
}

async function readError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string };
    if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error;
    if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
      return parsed.error.message;
    }
  } catch {
    // ignore
  }
  return body.trim().slice(0, 280) || `${response.status} ${response.statusText}`;
}

export async function testSpeechApiConnection(
  settings: Pick<SpeechSettings, 'speechApiBaseUrl' | 'speechApiKey'>
): Promise<{ ok: boolean; message: string }> {
  const baseUrl = normalizeSpeechApiBaseUrl(settings.speechApiBaseUrl);
  const apiKey = settings.speechApiKey.trim();

  if (!baseUrl) {
    return { ok: false, message: 'Enter an API base URL.' };
  }
  if (!apiKey) {
    return { ok: false, message: 'Enter an API key.' };
  }

  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: authHeaders(apiKey)
    });

    if (response.ok) {
      const payload = (await response.json()) as { data?: unknown[] };
      const count = Array.isArray(payload.data) ? payload.data.length : 0;
      return {
        ok: true,
        message: count > 0 ? `Connected. ${count} models available.` : 'Connected.'
      };
    }

    if (response.status === 404) {
      const speech = await fetch(`${baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          ...authHeaders(apiKey),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'alloy',
          input: 'ok'
        })
      });
      if (speech.ok) {
        return { ok: true, message: 'Connected. TTS endpoint responded.' };
      }
      return { ok: false, message: await readError(speech) };
    }

    return { ok: false, message: await readError(response) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not reach the speech API.'
    };
  }
}

export async function synthesizeSpeechApi(
  settings: SpeechSettings,
  text: string,
  voiceId?: string
): Promise<ArrayBuffer> {
  const baseUrl = normalizeSpeechApiBaseUrl(settings.speechApiBaseUrl);
  const apiKey = settings.speechApiKey.trim();
  if (!baseUrl || !apiKey) {
    throw new Error('Speech API is not configured.');
  }

  const voice =
    voiceId && OPENAI_TTS_VOICES.includes(voiceId as (typeof OPENAI_TTS_VOICES)[number])
      ? voiceId
      : settings.speechApiTtsVoice || 'alloy';

  const response = await fetch(`${baseUrl}/audio/speech`, {
    method: 'POST',
    headers: {
      ...authHeaders(apiKey),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.speechApiTtsModel || 'tts-1',
      voice,
      input: text
    })
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.arrayBuffer();
}

export async function transcribeSpeechApi(
  settings: SpeechSettings,
  audio: Blob
): Promise<string> {
  const baseUrl = normalizeSpeechApiBaseUrl(settings.speechApiBaseUrl);
  const apiKey = settings.speechApiKey.trim();
  if (!baseUrl || !apiKey) {
    throw new Error('Speech API is not configured.');
  }

  const form = new FormData();
  form.append('file', audio, 'speech.webm');
  form.append('model', settings.speechApiSttModel || 'whisper-1');
  if (settings.language) {
    form.append('language', settings.language.split('-')[0] ?? 'en');
  }

  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: form
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const payload = (await response.json()) as { text?: string };
  return payload.text?.trim() ?? '';
}

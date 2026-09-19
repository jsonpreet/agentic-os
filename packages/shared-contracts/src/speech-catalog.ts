import {
  SpeechModelKind,
  SpeechModelStatus,
} from './speech.js';

export interface SpeechModelFile {
  filename: string;
  url: string;
}

export interface SpeechModelCatalogEntry {
  id: string;
  name: string;
  kind: SpeechModelKind;
  source: 'builtin' | 'download';
  description: string;
  sizeLabel: string;
  filename?: string;
  url?: string;
  bytesTotal?: number;
  extraFiles?: SpeechModelFile[];
  platforms?: Array<'darwin' | 'linux' | 'win32'>;
}

const WHISPER_BASE =
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';
const PIPER_BASE =
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0';

function piperVoice(
  id: string,
  name: string,
  langPath: string,
  voicePath: string,
  sizeLabel: string,
  description: string
): SpeechModelCatalogEntry {
  const fileBase = `${PIPER_BASE}/${langPath}/${voicePath}`;
  const filename = `${voicePath.split('/').pop()}.onnx`;
  return {
    id,
    name,
    kind: 'tts',
    source: 'download',
    description,
    sizeLabel,
    filename,
    url: `${fileBase}.onnx`,
    extraFiles: [{ filename: `${filename}.json`, url: `${fileBase}.onnx.json` }]
  };
}

export const LOCAL_SPEECH_MODEL_CATALOG: SpeechModelCatalogEntry[] = [
  {
    id: 'web-speech-stt',
    name: 'Web Speech',
    kind: 'stt',
    source: 'builtin',
    description: 'On-device browser speech recognition. No download.',
    sizeLabel: 'Built-in'
  },
  {
    id: 'whisper-tiny',
    name: 'Whisper Tiny',
    kind: 'stt',
    source: 'download',
    description: 'Fast multilingual ggml model for whisper.cpp.',
    sizeLabel: '75 MB',
    filename: 'ggml-tiny.bin',
    url: `${WHISPER_BASE}/ggml-tiny.bin`,
    bytesTotal: 77_691_713
  },
  {
    id: 'whisper-tiny.en',
    name: 'Whisper Tiny English',
    kind: 'stt',
    source: 'download',
    description: 'English-only tiny ggml model.',
    sizeLabel: '75 MB',
    filename: 'ggml-tiny.en.bin',
    url: `${WHISPER_BASE}/ggml-tiny.en.bin`,
    bytesTotal: 77_583_728
  },
  {
    id: 'whisper-base',
    name: 'Whisper Base',
    kind: 'stt',
    source: 'download',
    description: 'Balanced multilingual ggml model.',
    sizeLabel: '142 MB',
    filename: 'ggml-base.bin',
    url: `${WHISPER_BASE}/ggml-base.bin`,
    bytesTotal: 147_951_465
  },
  {
    id: 'whisper-base.en',
    name: 'Whisper Base English',
    kind: 'stt',
    source: 'download',
    description: 'English-only base ggml model.',
    sizeLabel: '142 MB',
    filename: 'ggml-base.en.bin',
    url: `${WHISPER_BASE}/ggml-base.en.bin`,
    bytesTotal: 147_964_211
  },
  {
    id: 'whisper-small',
    name: 'Whisper Small',
    kind: 'stt',
    source: 'download',
    description: 'Higher-accuracy multilingual ggml model.',
    sizeLabel: '466 MB',
    filename: 'ggml-small.bin',
    url: `${WHISPER_BASE}/ggml-small.bin`,
    bytesTotal: 487_601_967
  },
  {
    id: 'whisper-small.en',
    name: 'Whisper Small English',
    kind: 'stt',
    source: 'download',
    description: 'English-only small ggml model.',
    sizeLabel: '466 MB',
    filename: 'ggml-small.en.bin',
    url: `${WHISPER_BASE}/ggml-small.en.bin`,
    bytesTotal: 487_614_201
  },
  {
    id: 'whisper-medium',
    name: 'Whisper Medium',
    kind: 'stt',
    source: 'download',
    description: 'Accurate multilingual ggml model. Large download.',
    sizeLabel: '1.5 GB',
    filename: 'ggml-medium.bin',
    url: `${WHISPER_BASE}/ggml-medium.bin`,
    bytesTotal: 1_533_763_843
  },
  {
    id: 'whisper-medium.en',
    name: 'Whisper Medium English',
    kind: 'stt',
    source: 'download',
    description: 'English-only medium ggml model. Large download.',
    sizeLabel: '1.5 GB',
    filename: 'ggml-medium.en.bin',
    url: `${WHISPER_BASE}/ggml-medium.en.bin`,
    bytesTotal: 1_533_775_443
  },
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large v3 Turbo',
    kind: 'stt',
    source: 'download',
    description: 'Fast large multilingual ggml model.',
    sizeLabel: '809 MB',
    filename: 'ggml-large-v3-turbo.bin',
    url: `${WHISPER_BASE}/ggml-large-v3-turbo.bin`,
    bytesTotal: 809_043_721
  },
  {
    id: 'whisper-large-v3',
    name: 'Whisper Large v3',
    kind: 'stt',
    source: 'download',
    description: 'Highest-accuracy multilingual ggml model.',
    sizeLabel: '2.9 GB',
    filename: 'ggml-large-v3.bin',
    url: `${WHISPER_BASE}/ggml-large-v3.bin`,
    bytesTotal: 2_955_219_570
  },
  {
    id: 'web-speech-tts',
    name: 'Web Speech',
    kind: 'tts',
    source: 'builtin',
    description: 'On-device browser voices. No download.',
    sizeLabel: 'Built-in'
  },
  {
    id: 'macos-say',
    name: 'macOS Say',
    kind: 'tts',
    source: 'builtin',
    description: 'Native macOS voices.',
    sizeLabel: 'Built-in',
    platforms: ['darwin']
  },
  piperVoice(
    'piper-en-us-lessac-medium',
    'Piper Lessac (US)',
    'en/en_US/lessac/medium',
    'en_US-lessac-medium',
    '63 MB',
    'Local neural TTS, US English medium quality.'
  ),
  piperVoice(
    'piper-en-us-amy-medium',
    'Piper Amy (US)',
    'en/en_US/amy/medium',
    'en_US-amy-medium',
    '63 MB',
    'Local neural TTS, US English female voice.'
  ),
  piperVoice(
    'piper-en-us-ryan-medium',
    'Piper Ryan (US)',
    'en/en_US/ryan/medium',
    'en_US-ryan-medium',
    '63 MB',
    'Local neural TTS, US English male voice.'
  ),
  piperVoice(
    'piper-en-us-joe-medium',
    'Piper Joe (US)',
    'en/en_US/joe/medium',
    'en_US-joe-medium',
    '63 MB',
    'Local neural TTS, US English male voice.'
  ),
  piperVoice(
    'piper-en-gb-alan-medium',
    'Piper Alan (UK)',
    'en/en_GB/alan/medium',
    'en_GB-alan-medium',
    '63 MB',
    'Local neural TTS, British English male voice.'
  ),
  piperVoice(
    'piper-en-gb-alba-medium',
    'Piper Alba (UK)',
    'en/en_GB/alba/medium',
    'en_GB-alba-medium',
    '63 MB',
    'Local neural TTS, British English female voice.'
  ),
  piperVoice(
    'piper-en-us-kathleen-low',
    'Piper Kathleen (US)',
    'en/en_US/kathleen/low',
    'en_US-kathleen-low',
    '63 MB',
    'Local neural TTS, US English female voice (smaller).'
  ),
  piperVoice(
    'piper-en-us-ljspeech-medium',
    'Piper LJSpeech (US)',
    'en/en_US/ljspeech/medium',
    'en_US-ljspeech-medium',
    '63 MB',
    'Local neural TTS, US English female voice.'
  ),
  piperVoice(
    'piper-en-gb-northern-medium',
    'Piper Northern English (UK)',
    'en/en_GB/northern_english_male/medium',
    'en_GB-northern_english_male-medium',
    '63 MB',
    'Local neural TTS, Northern British English male voice.'
  ),
  piperVoice(
    'piper-en-gb-southern-medium',
    'Piper Southern English (UK)',
    'en/en_GB/southern_english_female/medium',
    'en_GB-southern_english_female-medium',
    '63 MB',
    'Local neural TTS, Southern British English female voice.'
  )
];

export function catalogSpeechModels(
  platform: string = typeof navigator !== 'undefined' ? navigator.platform : 'darwin'
): SpeechModelStatus[] {
  const normalized =
    /mac/i.test(platform) || platform === 'darwin'
      ? 'darwin'
      : /win/i.test(platform)
        ? 'win32'
        : 'linux';

  return LOCAL_SPEECH_MODEL_CATALOG.map((entry) => {
    const unavailable = Boolean(
      entry.platforms?.length && !entry.platforms.includes(normalized)
    );

    return {
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      source: entry.source,
      description: entry.description,
      sizeLabel: entry.sizeLabel,
      status: unavailable ? 'unavailable' : entry.source === 'builtin' ? 'ready' : 'available',
      bytesTotal: entry.bytesTotal,
      error: unavailable ? 'Not available on this platform' : undefined
    };
  });
}

export function mergeSpeechModelStatus(live: SpeechModelStatus[]): SpeechModelStatus[] {
  const byId = new Map(live.map((model) => [model.id, model]));
  return catalogSpeechModels().map((model) => {
    const next = byId.get(model.id);
    if (!next) return model;
    return {
      ...model,
      ...next,
      name: model.name,
      description: model.description,
      sizeLabel: model.sizeLabel,
      kind: model.kind,
      source: model.source
    };
  });
}

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isWebSpeechSTTAvailable(): boolean {
  return getSpeechRecognition() !== null;
}

export interface WebSTTSession {
  stop: () => void;
}

export function startWebSpeechSTT(options: {
  language: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}): WebSTTSession | null {
  const Ctor = getSpeechRecognition();
  if (!Ctor) {
    options.onError('Speech recognition is not supported in this environment.');
    return null;
  }

  const recognition = new Ctor();
  recognition.lang = options.language;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = '';

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    const display = (finalTranscript + interim).trim();
    if (display) options.onInterim(display);
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error !== 'aborted') {
      options.onError(event.error);
    }
  };

  recognition.onend = () => {
    if (finalTranscript.trim()) {
      options.onFinal(finalTranscript.trim());
    }
  };

  recognition.start();

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }
  };
}

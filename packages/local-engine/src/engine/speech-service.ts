import { execa } from 'execa';
import { SpeakRequest, VoiceOption } from '@agentic/shared-contracts';

let activeSayProcess: ReturnType<typeof execa> | null = null;

export async function listMacOSVoices(): Promise<VoiceOption[]> {
  if (process.platform !== 'darwin') return [];

  try {
    const { stdout } = await execa('say', ['-v', '?']);
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(.+?)\s{2,}(.+)$/);
        if (!match) return { id: line, name: line };
        return {
          id: match[1].trim(),
          name: match[1].trim(),
          language: match[2].trim()
        };
      });
  } catch {
    return [];
  }
}

export async function speakWithMacOS(request: SpeakRequest): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('macOS say is only available on macOS');
  }

  const text = request.text.trim();
  if (!text) return;

  await stopMacOSSpeech();

  const args: string[] = [];
  if (request.voiceId) args.push('-v', request.voiceId);
  if (request.rate) args.push('-r', String(Math.round(request.rate * 200)));
  args.push(text);

  activeSayProcess = execa('say', args, { reject: false });
  await activeSayProcess;
  activeSayProcess = null;
}

export async function stopMacOSSpeech(): Promise<void> {
  if (activeSayProcess) {
    activeSayProcess.kill();
    activeSayProcess = null;
  }

  if (process.platform === 'darwin') {
    try {
      await execa('killall', ['say'], { reject: false });
    } catch {
      // ignore
    }
  }
}

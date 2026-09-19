import { PromptRouteResult } from '@agentic/shared-contracts';
import { getSpeechSettings } from './settings.js';
import { speechQueue } from './tts-queue.js';

/** Short TTS line spoken immediately after a voice/text prompt is routed. */
export function confirmationForRoute(result: PromptRouteResult): string | null {
  const name = result.agentName;

  switch (result.action) {
    case 'sent_to_active':
      return name ? `Task assigned to ${name}.` : 'Task assigned to agent.';
    case 'queued_for_active':
      return name ? `Queued for ${name}.` : 'Instruction queued.';
    case 'spawned_new_agent':
      return name ? `Created agent ${name} and sent your task.` : 'New agent created.';
    case 'app_command':
      if (result.appCommand === 'open_browser') {
        return result.browserUrl
          ? `Opening browser to ${result.browserUrl}.`
          : 'Opening browser.';
      }
      if (result.appCommand === 'open_files') return 'Opening files.';
      if (result.appCommand === 'open_editor') return 'Opening editor.';
      if (result.appCommand === 'open_source_control') return 'Opening source control.';
      if (result.appCommand === 'open_dev_servers') return 'Opening dev servers.';
      if (result.appCommand === 'open_notes') return 'Opening notes.';
      if (result.appCommand === 'open_kanban') return 'Opening kanban board.';
      if (result.appCommand === 'switch_desktop' && result.desktopName) {
        return `Switching to ${result.desktopName} desktop.`;
      }
      if (result.appCommand === 'focus_agent' && name) {
        return `Focusing ${name}.`;
      }
      return null;
    default:
      return null;
  }
}

export async function speakRouteConfirmation(
  result: PromptRouteResult,
  voiceId?: string
): Promise<void> {
  const settings = getSpeechSettings();
  if (!settings.ttsEnabled || settings.ttsMuted || settings.ttsProvider === 'disabled') {
    return;
  }

  const text = confirmationForRoute(result);
  if (!text) return;

  await speechQueue.enqueue(text, voiceId ?? settings.defaultVoice);
}

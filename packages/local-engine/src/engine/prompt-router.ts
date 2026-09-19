import { AgentSession, PromptRouteResult } from '@agentic/shared-contracts';
import { PTYManager } from './pty-manager.js';
import { InstructionQueueManager } from './instruction-queue.js';

export interface RouteOptions {
  prompt: string;
  activeSessions: AgentSession[];
  ptyManager: PTYManager;
  queueManager: InstructionQueueManager;
}

export class PromptRouter {
  /**
   * Evaluates a prompt to determine whether it addresses an existing agent,
   * requests an app command, or requires spawning a new agent.
   */
  static parsePrompt(rawPrompt: string): { targetName: string | null; instruction: string } {
    const trimmed = rawPrompt.trim();

    // Match "Hey <Name>, <instruction>" or "Hey <Name>: <instruction>" or "<Name>: <instruction>" or "<Name>, <instruction>"
    const match = trimmed.match(/^(?:hey\s+)?([a-zA-Z0-9_-]+)[,:]\s*(.*)$/i);
    if (match) {
      return {
        targetName: match[1],
        instruction: match[2].trim()
      };
    }

    // Match "Hey <Name> <instruction>" (space separated without punctuation)
    const spaceMatch = trimmed.match(/^hey\s+([a-zA-Z0-9_-]+)\s+(.*)$/i);
    if (spaceMatch) {
      return {
        targetName: spaceMatch[1],
        instruction: spaceMatch[2].trim()
      };
    }

    return {
      targetName: null,
      instruction: trimmed
    };
  }

  static parseAppCommand(
    rawPrompt: string
  ):
    | { type: 'switch_desktop'; desktopName: string }
    | { type: 'open_browser'; url?: string }
    | { type: 'open_files' }
    | { type: 'open_editor' }
    | { type: 'open_source_control' }
    | { type: 'open_dev_servers' }
    | { type: 'open_notes' }
    | { type: 'open_kanban' }
    | { type: 'open_api_client' }
    | { type: 'open_database' }
    | { type: 'open_design' }
    | { type: 'open_activity_logs' }
    | { type: 'focus_agent'; agentName: string }
    | null {
    const trimmed = rawPrompt.trim();

    const openApiClientMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?(?:api\s+client|http\s+client|postman)|show\s+api\s+client)\.?$/i
    );
    if (openApiClientMatch) {
      return { type: 'open_api_client' };
    }

    const openDatabaseMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?database(?:\s+explorer)?|show\s+database|open\s+db)\.?$/i
    );
    if (openDatabaseMatch) {
      return { type: 'open_database' };
    }

    const openDesignMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?(?:design|assets)(?:\s+app)?|show\s+(?:design|assets))\.?$/i
    );
    if (openDesignMatch) {
      return { type: 'open_design' };
    }

    const openActivityLogsMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?(?:activity|logs|activity\s*logs?|audit\s*logs?)|show\s+(?:activity|logs|activity\s*logs?|audit\s*logs?))\.?$/i
    );
    if (openActivityLogsMatch) {
      return { type: 'open_activity_logs' };
    }

    const openFilesMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?files(?:\s+app)?|show\s+files|open\s+file\s+browser)\.?$/i
    );
    if (openFilesMatch) {
      return { type: 'open_files' };
    }

    const openEditorMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?(?:code\s+)?editor|show\s+editor)\.?$/i
    );
    if (openEditorMatch) {
      return { type: 'open_editor' };
    }

    const openSourceControlMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?(?:source\s+control|git)|show\s+(?:source\s+control|git))\.?$/i
    );
    if (openSourceControlMatch) {
      return { type: 'open_source_control' };
    }

    const openDevServersMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?dev\s+servers?|show\s+dev\s+servers?|open\s+servers?)\.?$/i
    );
    if (openDevServersMatch) {
      return { type: 'open_dev_servers' };
    }

    const openNotesMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?notes?|show\s+notes?)\.?$/i
    );
    if (openNotesMatch) {
      return { type: 'open_notes' };
    }

    const openKanbanMatch = trimmed.match(
      /^(?:open\s+(?:the\s+)?(?:kanban|board)|show\s+(?:kanban|board))\.?$/i
    );
    if (openKanbanMatch) {
      return { type: 'open_kanban' };
    }

    const openBrowserMatch = trimmed.match(
      /^open\s+(?:the\s+)?browser(?:\s+to\s+(.+?))?\.?$/i
    );
    if (openBrowserMatch) {
      const url = openBrowserMatch[1]?.trim();
      return { type: 'open_browser', url: url || undefined };
    }

    const browseMatch = trimmed.match(/^browse\s+(https?:\/\/\S+|[^\s]+)$/i);
    if (browseMatch) {
      return { type: 'open_browser', url: browseMatch[1].trim() };
    }

    const focusMatch = trimmed.match(/^(?:focus|show)\s+(.+?)(?:\s+window)?\.?$/i);
    if (focusMatch) {
      const name = focusMatch[1].trim();
      if (!/desktop$/i.test(name)) {
        return { type: 'focus_agent', agentName: name };
      }
    }

    const desktopPatterns = [
      /^switch\s+to\s+(?:the\s+)?(.+?)\s+desktop\.?$/i,
      /^open\s+(?:the\s+)?(.+?)\s+desktop\.?$/i,
      /^go\s+to\s+(?:the\s+)?(.+?)\s+desktop\.?$/i
    ];

    for (const pattern of desktopPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return { type: 'switch_desktop', desktopName: match[1].trim() };
      }
    }

    return null;
  }

  static async route(options: RouteOptions): Promise<PromptRouteResult> {
    const { prompt, activeSessions, ptyManager, queueManager } = options;
    const { targetName, instruction } = this.parsePrompt(prompt);

    if (targetName) {
      const matchedSession = activeSessions.find(
        (s) => s.name.toLowerCase() === targetName.toLowerCase()
      );

      if (matchedSession) {
        const isWorking = ptyManager.getStatus(matchedSession.id) === 'working';

        if (isWorking) {
          const queuedItem = queueManager.enqueue(matchedSession.id, instruction);
          return {
            action: 'queued_for_active',
            sessionId: matchedSession.id,
            agentName: matchedSession.name,
            instructionId: queuedItem.id,
            message: `Queued follow-up instruction for ${matchedSession.name}`
          };
        } else {
          ptyManager.sendInput(matchedSession.id, instruction + '\n');
          return {
            action: 'sent_to_active',
            sessionId: matchedSession.id,
            agentName: matchedSession.name,
            message: `Delivered instruction directly to ${matchedSession.name}`
          };
        }
      } else {
        return {
          action: 'ambiguous',
          agentName: targetName,
          message: `No active agent named "${targetName}" was found in this workspace.`
        };
      }
    }

    const appCommand = this.parseAppCommand(prompt.trim());
    if (appCommand) {
      if (appCommand.type === 'switch_desktop') {
        return {
          action: 'app_command',
          appCommand: 'switch_desktop',
          desktopName: appCommand.desktopName,
          message: `Switch to ${appCommand.desktopName} desktop`
        };
      }
      if (appCommand.type === 'open_browser') {
        return {
          action: 'app_command',
          appCommand: 'open_browser',
          browserUrl: appCommand.url,
          message: appCommand.url
            ? `Open browser to ${appCommand.url}`
            : 'Open browser'
        };
      }
      if (appCommand.type === 'open_files') {
        return {
          action: 'app_command',
          appCommand: 'open_files',
          message: 'Open Files'
        };
      }
      if (appCommand.type === 'open_editor') {
        return {
          action: 'app_command',
          appCommand: 'open_editor',
          message: 'Open Editor'
        };
      }
      if (appCommand.type === 'open_source_control') {
        return {
          action: 'app_command',
          appCommand: 'open_source_control',
          message: 'Open Source Control'
        };
      }
      if (appCommand.type === 'open_dev_servers') {
        return {
          action: 'app_command',
          appCommand: 'open_dev_servers',
          message: 'Open Dev Servers'
        };
      }
      if (appCommand.type === 'open_notes') {
        return {
          action: 'app_command',
          appCommand: 'open_notes',
          message: 'Open Notes'
        };
      }
      if (appCommand.type === 'open_kanban') {
        return {
          action: 'app_command',
          appCommand: 'open_kanban',
          message: 'Open Kanban'
        };
      }
      if (appCommand.type === 'open_activity_logs') {
        return {
          action: 'app_command',
          appCommand: 'open_activity_logs',
          message: 'Open Activity & Logs'
        };
      }
      if (appCommand.type === 'focus_agent') {
        const matched = activeSessions.find(
          (s) => s.name.toLowerCase() === appCommand.agentName.toLowerCase()
        );
        if (matched) {
          return {
            action: 'app_command',
            appCommand: 'focus_agent',
            sessionId: matched.id,
            agentName: matched.name,
            message: `Focus ${matched.name}`
          };
        }
        return {
          action: 'ambiguous',
          agentName: appCommand.agentName,
          message: `No active agent named "${appCommand.agentName}" was found.`
        };
      }
    }

    return {
      action: 'spawned_new_agent',
      message: instruction
    };
  }
}

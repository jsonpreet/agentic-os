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

    return {
      action: 'spawned_new_agent',
      message: instruction
    };
  }
}

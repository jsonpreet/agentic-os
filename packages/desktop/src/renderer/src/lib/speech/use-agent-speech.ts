import { useEffect, useRef } from 'react';
import { AgentSession } from '@agentic/shared-contracts';
import { stripAnsi } from './text-filter.js';
import { speechQueue } from './tts-queue.js';
import { getSpeechSettings } from './settings.js';

interface AddressedSession {
  sessionId: string;
  agentName: string;
}

/**
 * Watches terminal output for explicitly addressed agents and speaks
 * accumulated responses when the agent returns to idle.
 */
export function useAgentSpeech(agentSessions: AgentSession[]): {
  registerAddressedSession: (session: AddressedSession) => void;
} {
  const buffersRef = useRef<Record<string, string>>({});
  const addressedRef = useRef<Record<string, AddressedSession>>({});

  const registerAddressedSession = (session: AddressedSession) => {
    const settings = getSpeechSettings();
    if (!settings.ttsEnabled || settings.ttsMuted || settings.ttsProvider === 'disabled') {
      return;
    }
    addressedRef.current[session.sessionId] = session;
    buffersRef.current[session.sessionId] = '';
  };

  useEffect(() => {
    if (!window.agenticApi) return;

    const unsubOutput = window.agenticApi.onTerminalOutput((event) => {
      if (!addressedRef.current[event.sessionId]) return;
      const chunk = stripAnsi(event.data);
      if (!chunk.trim()) return;
      buffersRef.current[event.sessionId] =
        (buffersRef.current[event.sessionId] || '') + chunk;
    });

    const unsubStatus = window.agenticApi.onAgentStatus((event) => {
      const addressed = addressedRef.current[event.sessionId];
      if (!addressed) return;

      if (event.status === 'idle') {
        const buffer = buffersRef.current[event.sessionId] || '';
        delete addressedRef.current[event.sessionId];
        delete buffersRef.current[event.sessionId];

        const agent = agentSessions.find((s) => s.id === event.sessionId);
        speechQueue.enqueue(buffer, agent?.voice);
      }

      if (event.status === 'terminated') {
        delete addressedRef.current[event.sessionId];
        delete buffersRef.current[event.sessionId];
      }
    });

    return () => {
      unsubOutput();
      unsubStatus();
    };
  }, [agentSessions]);

  return { registerAddressedSession };
}

import React from 'react';
import { AgentSession } from '@agentic/shared-contracts';
import { Bot, Plus, X } from 'lucide-react';

interface TargetPickerModalProps {
  isOpen: boolean;
  draftPrompt: string;
  suggestedName?: string;
  message?: string;
  agentSessions: AgentSession[];
  onClose: () => void;
  onSelect: (sessionId: string, prompt: string) => void;
  onSpawnNew: (prompt: string) => void;
}

export const TargetPickerModal: React.FC<TargetPickerModalProps> = ({
  isOpen,
  draftPrompt,
  suggestedName,
  message,
  agentSessions,
  onClose,
  onSelect,
  onSpawnNew
}) => {
  if (!isOpen) return null;

  const activeAgents = agentSessions.filter((s) => s.status !== 'terminated');
  const suggestedLower = suggestedName?.toLowerCase();

  const sortedAgents = [...activeAgents].sort((a, b) => {
    const aMatch = suggestedLower && a.name.toLowerCase().includes(suggestedLower) ? 0 : 1;
    const bMatch = suggestedLower && b.name.toLowerCase().includes(suggestedLower) ? 0 : 1;
    return aMatch - bMatch;
  });

  return (
    <div
      className="fixed inset-0 glass-scrim z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border-subtle)]">
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-[var(--glass-text)]">Choose an agent</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[var(--glass-border-subtle)] bg-[var(--glass-hover)]">
          <p className="text-xs text-[var(--glass-text-muted)] mb-1.5">
            {message || 'Multiple or no agents matched your instruction.'}
          </p>
          <p className="text-sm text-[var(--glass-text)] font-mono bg-surface/80 rounded-lg px-2.5 py-2 border border-[var(--glass-border-subtle)] truncate">
            {draftPrompt}
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
          {sortedAgents.length > 0 ? (
            <>
              <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2 py-1 uppercase tracking-wider">
                Active agents
              </div>
              {sortedAgents.map((agent) => {
                const isSuggested =
                  suggestedLower &&
                  agent.name.toLowerCase().includes(suggestedLower);
                return (
                  <button
                    key={agent.id}
                    onClick={() => onSelect(agent.id, draftPrompt)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition ${
                      isSuggested
                        ? 'bg-primary/15 text-primary border border-primary/20'
                        : 'text-[var(--glass-text)] hover:bg-surface-hover'
                    }`}
                  >
                    <span className="text-sm font-medium">{agent.name}</span>
                    <span className="text-[10px] text-[var(--glass-text-muted)] font-mono">{agent.provider}</span>
                  </button>
                );
              })}
            </>
          ) : (
            <p className="text-xs text-[var(--glass-text-muted)] px-2 py-3 text-center">
              No active agents in this workspace.
            </p>
          )}

          <div className="h-px bg-[var(--glass-hover)] my-2" />

          <button
            onClick={() => onSpawnNew(draftPrompt)}
            className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-[var(--glass-text)] hover:bg-surface-hover transition text-left"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span className="text-sm">Create new agent with this instruction</span>
          </button>
        </div>

        <div className="px-4 py-2.5 border-t border-[var(--glass-border-subtle)] flex justify-end">
          <button
            onClick={onClose}
            className="text-xs text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] px-3 py-1.5 rounded-lg hover:bg-[var(--glass-hover)] transition"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
};

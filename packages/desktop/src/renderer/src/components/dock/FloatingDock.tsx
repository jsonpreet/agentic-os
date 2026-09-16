import React, { useState, useRef, useEffect } from 'react';
import {
  AgentSession,
  DiscoveredCLI,
  AgentProvider
} from '@agentic/shared-contracts';
import {
  Sparkles,
  Mic,
  Paperclip,
  FolderGit2,
  Terminal,
  Send,
  Bot,
  ChevronDown
} from 'lucide-react';

interface FloatingDockProps {
  agentSessions: AgentSession[];
  discoveredCLIs: DiscoveredCLI[];
  currentRepo?: string;
  onSendPrompt: (prompt: string, targetSessionId?: string, fallbackProvider?: AgentProvider) => void;
  onSelectAgentWindow: (sessionId: string) => void;
  onOpenNewAgentWindow: () => void;
  onSelectRepo: () => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  agentSessions,
  discoveredCLIs,
  currentRepo,
  onSendPrompt,
  onSelectAgentWindow,
  onOpenNewAgentWindow,
  onSelectRepo
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<string>('auto'); // 'auto' | sessionId | provider
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeAgents = agentSessions.filter((s) => s.status !== 'terminated');
  const availableCLIs = discoveredCLIs.filter((c) => c.isAvailable);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;

    let targetSessionId: string | undefined;
    let fallbackProvider: AgentProvider | undefined;

    if (selectedTarget === 'auto') {
      // PromptRouter will automatically parse "Hey <Name>, ..." or spawn new agent
    } else if (selectedTarget.startsWith('session:')) {
      targetSessionId = selectedTarget.replace('session:', '');
    } else if (selectedTarget.startsWith('provider:')) {
      fallbackProvider = selectedTarget.replace('provider:', '') as AgentProvider;
    }

    onSendPrompt(trimmed, targetSessionId, fallbackProvider);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-full px-4">
      <div className="bg-surface/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2.5 flex flex-col space-y-2">
        {/* Top bar inside dock: Target selector + repo selector + active agent avatars */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center space-x-2">
            {/* Target Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setTargetDropdownOpen(!targetDropdownOpen)}
                className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-surface-elevated/90 hover:bg-surface-hover border border-white/5 text-zinc-300 transition font-medium"
              >
                <Bot className="w-3.5 h-3.5 text-primary" />
                <span>
                  {selectedTarget === 'auto'
                    ? 'Auto Route'
                    : selectedTarget.startsWith('session:')
                    ? activeAgents.find((s) => s.id === selectedTarget.replace('session:', ''))?.name || 'Agent'
                    : `Provider: ${selectedTarget.replace('provider:', '')}`}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {targetDropdownOpen && (
                <div className="absolute bottom-full left-0 mb-1.5 w-56 rounded-xl bg-surface-elevated border border-white/10 shadow-2xl p-1.5 z-50">
                  <button
                    onClick={() => {
                      setSelectedTarget('auto');
                      setTargetDropdownOpen(false);
                    }}
                    className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                      selectedTarget === 'auto' ? 'bg-primary/20 text-primary font-medium' : 'text-zinc-300 hover:bg-surface-hover'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto Route (Hey &lt;Name&gt;...)</span>
                  </button>

                  {activeAgents.length > 0 && (
                    <>
                      <div className="text-[10px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-wider mt-1">
                        Active Agents
                      </div>
                      {activeAgents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => {
                            setSelectedTarget(`session:${agent.id}`);
                            setTargetDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                            selectedTarget === `session:${agent.id}` ? 'bg-primary/20 text-primary font-medium' : 'text-zinc-300 hover:bg-surface-hover'
                          }`}
                        >
                          <span className="truncate">{agent.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{agent.provider}</span>
                        </button>
                      ))}
                    </>
                  )}

                  {availableCLIs.length > 0 && (
                    <>
                      <div className="text-[10px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-wider mt-1">
                        Launch with CLI
                      </div>
                      {availableCLIs.map((cli) => (
                        <button
                          key={cli.provider}
                          onClick={() => {
                            setSelectedTarget(`provider:${cli.provider}`);
                            setTargetDropdownOpen(false);
                          }}
                          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                            selectedTarget === `provider:${cli.provider}` ? 'bg-primary/20 text-primary font-medium' : 'text-zinc-300 hover:bg-surface-hover'
                          }`}
                        >
                          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{cli.name}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Attached repo pill */}
            <button
              onClick={onSelectRepo}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-surface-elevated/70 hover:bg-surface-hover border border-white/5 text-zinc-400 hover:text-zinc-200 transition"
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px]">
                {currentRepo ? currentRepo.split('/').pop() : 'No repository'}
              </span>
            </button>
          </div>

          {/* Running agent avatars in dock */}
          <div className="flex items-center space-x-1.5">
            {activeAgents.map((agent) => {
              const isWorking = agent.status === 'working';
              return (
                <button
                  key={agent.id}
                  onClick={() => onSelectAgentWindow(agent.id)}
                  title={`${agent.name} (${agent.status}) - click to focus window`}
                  className="relative flex items-center justify-center w-7 h-7 rounded-full bg-surface-elevated hover:bg-surface-hover border border-white/10 text-xs font-semibold text-zinc-200 transition"
                >
                  {agent.name.slice(0, 1).toUpperCase()}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface ${
                      isWorking ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Input area */}
        <div className="flex items-end space-x-2 bg-surface-elevated/90 rounded-xl px-3 py-2 border border-white/5 focus-within:border-primary/50 transition">
          <textarea
            ref={inputRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask an agent (e.g. 'Hey Tim, run tests') or type a task..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none max-h-32 min-h-[24px]"
          />

          <div className="flex items-center space-x-1 pb-0.5">
            {/* Attachments */}
            <button
              type="button"
              title="Attach File"
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Voice Microphone (Milestone 2 placeholder) */}
            <button
              type="button"
              title="Speech-to-Text (Milestone 2)"
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!prompt.trim()}
              className={`p-1.5 rounded-lg transition ${
                prompt.trim()
                  ? 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                  : 'text-zinc-600 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

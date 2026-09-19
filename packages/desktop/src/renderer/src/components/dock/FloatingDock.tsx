import React, { useState, useRef, useEffect } from 'react';
import {
  AgentSession,
  DiscoveredCLI,
  AgentProvider,
  Workspace,
  Desktop
} from '@agentic/shared-contracts';
import {
  Mic,
  ChevronDown,
  LayoutGrid,
  FolderOpen,
  Code2,
  GitBranch,
  Globe2,
  Settings,
  Search,
  Bot,
  Server,
  FileText,
  Columns3,
  Send,
  Database,
  Palette,
  Activity,
  Loader2
} from 'lucide-react';
import { getSpeechSettings } from '../../lib/speech/settings.js';
import { startApiSTT } from '../../lib/speech/api-stt.js';
import {
  isWebSpeechSTTAvailable,
  startWebSpeechSTT,
  type WebSTTSession
} from '../../lib/speech/web-stt.js';
import { speechQueue } from '../../lib/speech/tts-queue.js';

interface FloatingDockProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  desktops: Desktop[];
  activeDesktopId: string | null;
  engineConnected: boolean;
  engineLoading: boolean;
  agentSessions: AgentSession[];
  discoveredCLIs: DiscoveredCLI[];
  onSendPrompt: (
    prompt: string,
    targetSessionId?: string,
    fallbackProvider?: AgentProvider
  ) => Promise<boolean>;
  onSelectAgentWindow: (sessionId: string) => void;
  onSelectDesktop: (desktopId: string) => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenBrowser: () => void;
  onOpenFiles: () => void;
  onOpenEditor: () => void;
  onOpenSourceControl: () => void;
  onOpenDevServers: () => void;
  onOpenNotes: () => void;
  onOpenKanban: () => void;
  onOpenApiClient: () => void;
  onOpenDatabase: () => void;
  onOpenDesign: () => void;
  onOpenActivityLogs: () => void;
  minimizedSessionIds: Set<string>;
  focusToken?: number;
}

function workspaceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'WS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function desktopChipLabel(desktop: Desktop, index: number): string {
  const letter = desktop.name.charAt(0).toUpperCase();
  return `${letter}${index + 1}`;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  workspaces,
  activeWorkspace,
  desktops,
  activeDesktopId,
  engineConnected,
  engineLoading,
  agentSessions,
  discoveredCLIs,
  onSendPrompt,
  onSelectAgentWindow,
  onSelectDesktop,
  onSelectWorkspace,
  onCreateWorkspace,
  onOpenSettings,
  onOpenSearch,
  onOpenBrowser,
  onOpenFiles,
  onOpenEditor,
  onOpenSourceControl,
  onOpenDevServers,
  onOpenNotes,
  onOpenKanban,
  onOpenApiClient,
  onOpenDatabase,
  onOpenDesign,
  onOpenActivityLogs,
  minimizedSessionIds,
  focusToken = 0
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<string>('auto');
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sttRef = useRef<WebSTTSession | null>(null);
  const basePromptRef = useRef('');

  useEffect(() => {
    if (focusToken > 0) inputRef.current?.focus();
  }, [focusToken]);

  useEffect(() => () => sttRef.current?.stop(), []);

  const activeAgents = agentSessions.filter((s) => s.status !== 'terminated');
  const availableCLIs = discoveredCLIs.filter((c) => c.isAvailable);

  const resolveTarget = () => {
    let targetSessionId: string | undefined;
    let fallbackProvider: AgentProvider | undefined;
    if (selectedTarget.startsWith('session:')) {
      targetSessionId = selectedTarget.replace('session:', '');
    } else if (selectedTarget.startsWith('provider:')) {
      fallbackProvider = selectedTarget.replace('provider:', '') as AgentProvider;
    }
    return { targetSessionId, fallbackProvider };
  };

  const startRecording = () => {
    const settings = getSpeechSettings();
    if (settings.sttProvider === 'disabled') {
      alert('Speech input is disabled. Enable it in Settings → Speech.');
      return;
    }
    speechQueue.stop();
    basePromptRef.current = prompt.trim();
    setIsRecording(true);

    const callbacks = {
      onInterim: (text: string) => {
        const prefix = basePromptRef.current;
        setPrompt(prefix ? `${prefix} ${text}` : text);
      },
      onFinal: async (text: string) => {
        setIsRecording(false);
        sttRef.current = null;
        const combined = basePromptRef.current
          ? `${basePromptRef.current} ${text}`.trim()
          : text.trim();
        if (!combined) return;
        const { targetSessionId, fallbackProvider } = resolveTarget();
        const delivered = await onSendPrompt(combined, targetSessionId, fallbackProvider);
        if (delivered) {
          setPrompt('');
          basePromptRef.current = '';
        }
      },
      onError: (message: string) => {
        setIsRecording(false);
        sttRef.current = null;
        alert(`Speech recognition error: ${message}`);
      }
    };

    if (settings.sttProvider === 'api') {
      sttRef.current = startApiSTT(callbacks);
      return;
    }

    if (!isWebSpeechSTTAvailable()) {
      setIsRecording(false);
      alert('Speech recognition is not available in this environment.');
      return;
    }

    sttRef.current = startWebSpeechSTT({
      language: settings.language,
      ...callbacks
    });
  };

  const stopRecording = () => {
    sttRef.current?.stop();
    sttRef.current = null;
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (isRecording) stopRecording();
    const { targetSessionId, fallbackProvider } = resolveTarget();
    const delivered = await onSendPrompt(trimmed, targetSessionId, fallbackProvider);
    if (delivered) setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const initials = workspaceInitials(activeWorkspace?.name ?? 'Workspace');

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-4 titlebar-no-drag">
      <div className="cnvs-prompt-pill flex items-center gap-2 px-3 py-2">
        {/* Mic + input */}
        <button
          type="button"
          onClick={toggleRecording}
          title={isRecording ? 'Stop and send' : 'Record speech'}
          className={`shrink-0 p-1.5 rounded-full transition ${
            isRecording ? 'text-red-500 bg-red-500/15 animate-pulse' : 'text-[var(--glass-icon)] hover:text-[var(--glass-text)]'
          }`}
        >
          <Mic className="w-4 h-4" />
        </button>

        <textarea
          ref={inputRef}
          rows={1}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or speak..."
          className="cnvs-prompt-input flex-1 min-w-0 resize-none max-h-20 py-1"
        />

        <div className="cnvs-divider" />

        {/* User / workspace initials */}
        <span className="text-[11px] font-semibold text-[var(--glass-text-muted)] w-6 text-center shrink-0">
          {initials}
        </span>

        {/* Workspace selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setWorkspaceOpen(!workspaceOpen);
              setAppsOpen(false);
              setTargetOpen(false);
            }}
            className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition"
          >
            <span className="max-w-[80px] truncate">
              {activeWorkspace?.name ?? 'Workspace'}
            </span>
            <ChevronDown className="w-3 h-3 text-[var(--glass-text-muted)]" />
          </button>
          {workspaceOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-52 rounded-xl glass-popover p-1.5 z-50 shadow-2xl">
              {engineLoading ? (
                <div className="flex items-center gap-2 px-2.5 py-2 text-xs text-[var(--glass-text)] font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--cnvs-accent)]" />
                  <span>Loading workspaces…</span>
                </div>
              ) : !engineConnected ? (
                <p className="px-2.5 py-2 text-xs text-red-300">
                  Engine not connected yet.
                </p>
              ) : workspaces.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    onCreateWorkspace();
                    setWorkspaceOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs glass-menu-item"
                >
                  New Workspace…
                </button>
              ) : (
                workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      onSelectWorkspace(ws.id);
                      setWorkspaceOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition ${
                      ws.id === activeWorkspace?.id
                        ? 'glass-chip-active ui-modal-tab-active'
                        : 'glass-menu-item'
                    }`}
                  >
                    {ws.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Desktop chips */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {desktops.map((desktop, idx) => (
            <button
              key={desktop.id}
              onClick={() => onSelectDesktop(desktop.id)}
              title={desktop.name}
              className={`cnvs-desktop-chip ${
                desktop.id === activeDesktopId ? 'cnvs-desktop-chip-active' : ''
              }`}
            >
              {desktopChipLabel(desktop, idx)}
            </button>
          ))}
        </div>

        {/* Agent target (hidden menu) */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setTargetOpen(!targetOpen);
              setAppsOpen(false);
              setWorkspaceOpen(false);
            }}
            className="p-1.5 rounded-lg text-[var(--glass-icon)] hover:text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition"
            title="Route to agent"
          >
            <Bot className="w-3.5 h-3.5" />
          </button>
          {targetOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-52 rounded-xl glass-popover p-1.5 z-50 max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedTarget('auto');
                  setTargetOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs ${
                  selectedTarget === 'auto' ? 'glass-chip-active ui-modal-tab-active' : 'text-[var(--glass-text)]'
                }`}
              >
                Auto route
              </button>
              {activeAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedTarget(`session:${agent.id}`);
                    onSelectAgentWindow(agent.id);
                    setTargetOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                    selectedTarget === `session:${agent.id}`
                      ? 'glass-chip-active ui-modal-tab-active'
                      : 'text-[var(--glass-text)] hover:bg-[var(--glass-hover)]'
                  }`}
                >
                  <span>{agent.name}</span>
                  {minimizedSessionIds.has(agent.id) && (
                    <span className="text-[9px] text-[var(--glass-text-muted)]">min</span>
                  )}
                </button>
              ))}
              {availableCLIs.map((cli) => (
                <button
                  key={cli.provider}
                  onClick={() => {
                    setSelectedTarget(`provider:${cli.provider}`);
                    setTargetOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)]"
                >
                  Launch {cli.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cnvs-divider hidden sm:block" />

        {/* Apps grid */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setAppsOpen(!appsOpen);
              setWorkspaceOpen(false);
              setTargetOpen(false);
            }}
            className="p-1.5 rounded-lg text-[var(--glass-icon)] hover:text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition"
            title="Apps & settings"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          {appsOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl glass-popover p-1.5 z-50 shadow-2xl">
              {[
                { label: 'Search', icon: Search, action: onOpenSearch },
                { label: 'Files', icon: FolderOpen, action: onOpenFiles },
                { label: 'Editor', icon: Code2, action: onOpenEditor },
                { label: 'Git', icon: GitBranch, action: onOpenSourceControl },
                { label: 'Servers', icon: Server, action: onOpenDevServers },
                { label: 'Notes', icon: FileText, action: onOpenNotes },
                { label: 'Kanban', icon: Columns3, action: onOpenKanban },
                { label: 'API Client', icon: Send, action: onOpenApiClient },
                { label: 'Database', icon: Database, action: onOpenDatabase },
                { label: 'Design', icon: Palette, action: onOpenDesign },
                { label: 'Activity', icon: Activity, action: onOpenActivityLogs },
                { label: 'Browser', icon: Globe2, action: onOpenBrowser },
                { label: 'Settings', icon: Settings, action: onOpenSettings }
              ].map(({ label, icon: Icon, action }) => (
                <button
                  key={label}
                  type="button"
                  disabled={engineLoading}
                  title={engineLoading ? 'Starting engine…' : label}
                  onClick={() => {
                    action();
                    setAppsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs glass-menu-item disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon className="w-3.5 h-3.5 glass-menu-item-icon" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

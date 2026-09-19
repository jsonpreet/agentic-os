import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  AgentSession,
  AgentInstruction
} from '@agentic/shared-contracts';
import {
  GitBranch,
  Clock,
  Square,
  Terminal,
  Edit2,
  Check,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

interface AgentTerminalWindowProps {
  session: AgentSession;
  queue: AgentInstruction[];
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onRename: (newName: string) => void;
  onInterrupt: () => void;
  onCancelInstruction: (instructionId: string) => void;
  onEditInstruction: (instructionId: string, newPrompt: string) => void;
}

export const AgentTerminalWindow: React.FC<AgentTerminalWindowProps> = ({
  session,
  queue,
  isFocused,
  onFocus,
  onMinimize,
  onClose,
  onRename,
  onInterrupt,
  onCancelInstruction,
  onEditInstruction
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(session.name);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [editingInstructionId, setEditingInstructionId] = useState<string | null>(null);
  const [editingInstructionText, setEditingInstructionText] = useState('');

  const isInterrupted = session.status === 'interrupted';

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current || isInterrupted) return;

    const term = new XTerm({
      fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Monaco, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: 'rgba(12, 10, 9, 0.35)',
        foreground: '#e8e4df',
        cursor: '#f59e0b',
        selectionBackground: 'rgba(245, 158, 11, 0.28)',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f4f4f5'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    xtermInstance.current = term;
    fitAddonInstance.current = fitAddon;

    try {
      fitAddon.fit();
      if (window.agenticApi) {
        window.agenticApi.resizeTerminal(session.id, term.cols, term.rows);
      }
    } catch {
      // ignore fit before layout ready
    }

    // Input from user typing in terminal
    const dataDisposable = term.onData((data) => {
      if (window.agenticApi) {
        window.agenticApi.sendTerminalInput(session.id, data);
      }
    });

    // Resize listener
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (window.agenticApi) {
        window.agenticApi.resizeTerminal(session.id, cols, rows);
      }
    });

    // Handle incoming terminal output from PTY
    const unsubscribeOutput = window.agenticApi?.onTerminalOutput((event) => {
      if (event.sessionId === session.id) {
        term.write(event.data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {}
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      if (unsubscribeOutput) unsubscribeOutput();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [session.id, isInterrupted]);

  const handleSaveName = () => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(trimmed);
    }
    setIsEditingName(false);
  };

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-2xl overflow-hidden transition-all duration-300 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
    >
      {/* Title bar */}
      <div className="h-10 glass-titlebar pl-3 pr-3 flex items-center justify-between cursor-move">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="cnvs-traffic-lights titlebar-no-drag shrink-0">
            <button
              type="button"
              className="cnvs-light cnvs-light-close"
              title="Close"
              onClick={(e) => {
                e.stopPropagation();
                setShowCloseModal(true);
              }}
            />
            <button
              type="button"
              className="cnvs-light cnvs-light-min"
              title="Minimize"
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
            />
            <span className="cnvs-light cnvs-light-max opacity-60" title="Maximize" />
          </div>

          {/* Editable Name */}
          {isEditingName ? (
            <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                className="bg-[var(--glass-inset-bg)] text-xs text-[var(--glass-text)] px-1.5 py-0.5 rounded border border-primary focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="p-1 hover:text-emerald-400 text-[var(--glass-text-muted)]"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center space-x-1.5 group cursor-pointer"
              onClick={() => setIsEditingName(true)}
              title="Click to rename agent"
            >
              <span className="text-xs font-semibold text-[var(--glass-text)]">{session.name}</span>
              <Edit2 className="w-3 h-3 text-[var(--glass-text-muted)] opacity-0 group-hover:opacity-100 transition" />
            </div>
          )}

          {/* Provider badge */}
          <span className="text-[10px] font-mono uppercase bg-[var(--glass-hover)] px-1.5 py-0.5 rounded text-[var(--glass-text-muted)] border border-[var(--glass-border-subtle)]">
            {session.provider}
          </span>

          {/* Worktree branch badge */}
          {session.branchName && (
            <div
              title={`Isolated Worktree: ${session.worktreePath}`}
              className="hidden sm:flex items-center space-x-1 text-[10px] font-mono text-[var(--glass-text-muted)] bg-[var(--glass-hover)] px-2 py-0.5 rounded border border-[var(--glass-border-subtle)]"
            >
              <GitBranch className="w-3 h-3 text-accent" />
              <span className="truncate max-w-[130px]">{session.branchName}</span>
            </div>
          )}
        </div>

        {/* Right: Status badge, Queue toggle, Interrupt, Window buttons */}
        <div className="flex items-center space-x-2">
          {/* Status badge */}
          <div className="flex items-center space-x-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--glass-hover)] border border-[var(--glass-border-subtle)]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                session.status === 'working'
                  ? 'bg-emerald-400 animate-ping'
                  : session.status === 'idle'
                  ? 'bg-zinc-400'
                  : session.status === 'interrupted'
                  ? 'bg-amber-400'
                  : 'bg-zinc-500'
              }`}
            />
            <span className="capitalize text-[var(--glass-text)]">{session.status}</span>
          </div>

          {/* Queue toggle badge */}
          {queue.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowQueueDrawer(!showQueueDrawer);
              }}
              className="flex items-center space-x-1 text-[11px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium hover:bg-primary/30 transition"
            >
              <Clock className="w-3 h-3" />
              <span>Queue ({queue.length})</span>
            </button>
          )}

          {/* Interrupt Button (SIGINT) */}
          {!isInterrupted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInterrupt();
              }}
              title="Interrupt process (Ctrl+C)"
              className="p-1 text-[var(--glass-text-muted)] hover:text-amber-400 hover:bg-[var(--glass-hover)] rounded transition"
            >
              <Square className="w-3 h-3" />
            </button>
          )}

        </div>
      </div>

      {/* Queue Drawer (shows queued instructions for this agent) */}
      {showQueueDrawer && queue.length > 0 && (
        <div className="glass-titlebar border-b border-[var(--glass-border-subtle)] p-2.5 space-y-1.5 max-h-36 overflow-y-auto">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--glass-text-muted)] flex items-center justify-between">
            <span>Queued Follow-up Instructions</span>
            <span className="text-[var(--glass-text-muted)]">Delivered when agent is idle</span>
          </div>
          {queue.map((item, idx) => (
            <div
              key={item.id}
              className="ui-inset flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs gap-2"
            >
              {editingInstructionId === item.id ? (
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className="text-[10px] text-[var(--glass-text-muted)] font-mono">#{idx + 1}</span>
                  <input
                    type="text"
                    value={editingInstructionText}
                    onChange={(e) => setEditingInstructionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onEditInstruction(item.id, editingInstructionText);
                        setEditingInstructionId(null);
                      }
                      if (e.key === 'Escape') setEditingInstructionId(null);
                    }}
                    className="flex-1 min-w-0 bg-[var(--glass-inset-bg)] text-xs text-[var(--glass-text)] px-1.5 py-0.5 rounded border border-primary focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      onEditInstruction(item.id, editingInstructionText);
                      setEditingInstructionId(null);
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-400/10 transition"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-2 truncate min-w-0">
                    <span className="text-[10px] text-[var(--glass-text-muted)] font-mono">#{idx + 1}</span>
                    <span className="truncate">{item.prompt}</span>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingInstructionId(item.id);
                        setEditingInstructionText(item.prompt);
                      }}
                      className="text-[11px] text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] px-1.5 py-0.5 rounded hover:bg-[var(--glass-hover)] transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onCancelInstruction(item.id)}
                      className="text-[11px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-400/10 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Interrupted recovery banner */}
      {isInterrupted && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-2.5 flex items-start justify-between gap-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-200">Session interrupted</p>
              <p className="text-[11px] text-amber-200/70 mt-0.5 leading-relaxed">
                This agent was running when the app closed. Its process is no longer active.
                Start a new agent to continue, or remove this session from your workspace.
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-[11px] text-amber-200 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 rounded-lg transition shrink-0"
          >
            Remove
          </button>
        </div>
      )}

      {/* Terminal Viewport */}
      <div className="flex-1 w-full relative p-2 overflow-hidden glass-terminal-viewport">
        {isInterrupted ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
            <Terminal className="w-8 h-8 text-[var(--glass-text-muted)] mb-3" />
            <p className="text-sm text-[var(--glass-text-muted)]">Terminal output is unavailable</p>
            <p className="text-xs text-[var(--glass-text-muted)] mt-1 max-w-xs">
              Session metadata and worktree ({session.branchName || 'none'}) are preserved.
            </p>
          </div>
        ) : (
          <div ref={terminalRef} className="w-full h-full" />
        )}
      </div>

      {/* Close Confirmation Modal */}
      {showCloseModal && (
        <div
          className="absolute inset-0 glass-scrim z-50 flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-modal rounded-xl p-4 max-w-sm w-full space-y-3">
            <div className="flex items-center space-x-2 text-[var(--glass-text)] font-medium text-sm">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span>Close Agent Window</span>
            </div>
            <p className="text-xs text-[var(--glass-text-muted)] leading-relaxed">
              {isInterrupted ? (
                <>
                  Remove interrupted agent <strong>{session.name}</strong> from this workspace?
                </>
              ) : (
                <>
                  Agent <strong>{session.name}</strong> is currently active. Would you like to keep it
                  running in the background, or stop the process?
                </>
              )}
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-3 py-1 text-xs text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] transition"
              >
                Cancel
              </button>
              {!isInterrupted && (
                <button
                  onClick={() => {
                    setShowCloseModal(false);
                    onMinimize(); // hides window, keeps background execution
                  }}
                  className="px-3 py-1.5 text-xs bg-[var(--glass-hover)] hover:bg-[var(--glass-hover)] text-[var(--glass-text)] rounded-lg transition"
                >
                  Keep in Background
                </button>
              )}
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  onClose(); // terminates session
                }}
                className="px-3 py-1.5 text-xs bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition font-medium"
              >
                Stop Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

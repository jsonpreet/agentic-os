import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  AgentSession,
  AgentInstruction
} from '@agentic/shared-contracts';
import {
  GitBranch,
  Terminal,
  Clock,
  Square,
  Minus,
  Maximize2,
  X,
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
  onCancelInstruction
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonInstance = useRef<FitAddon | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(session.name);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Monaco, monospace',
      fontSize: 12,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#0d0f12',
        foreground: '#e4e4e7',
        cursor: '#3b82f6',
        selectionBackground: 'rgba(59, 130, 246, 0.3)',
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
  }, [session.id]);

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
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden bg-background border transition-shadow duration-150 ${
        isFocused
          ? 'border-white/20 shadow-2xl ring-1 ring-primary/30'
          : 'border-white/10 shadow-lg'
      }`}
    >
      {/* Title bar */}
      <div className="h-10 bg-surface-elevated/90 px-3 flex items-center justify-between border-b border-white/5 cursor-move">
        {/* Left: Agent Name, Provider, Branch */}
        <div className="flex items-center space-x-2.5">
          <Terminal className="w-4 h-4 text-primary" />

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
                className="bg-black/50 text-xs text-zinc-100 px-1.5 py-0.5 rounded border border-primary focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="p-1 hover:text-emerald-400 text-zinc-400"
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
              <span className="text-xs font-semibold text-zinc-200">{session.name}</span>
              <Edit2 className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition" />
            </div>
          )}

          {/* Provider badge */}
          <span className="text-[10px] font-mono uppercase bg-white/5 px-1.5 py-0.5 rounded text-zinc-400 border border-white/5">
            {session.provider}
          </span>

          {/* Worktree branch badge */}
          {session.branchName && (
            <div
              title={`Isolated Worktree: ${session.worktreePath}`}
              className="hidden sm:flex items-center space-x-1 text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/5"
            >
              <GitBranch className="w-3 h-3 text-accent" />
              <span className="truncate max-w-[130px]">{session.branchName}</span>
            </div>
          )}
        </div>

        {/* Right: Status badge, Queue toggle, Interrupt, Window buttons */}
        <div className="flex items-center space-x-2">
          {/* Status badge */}
          <div className="flex items-center space-x-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                session.status === 'working'
                  ? 'bg-emerald-400 animate-ping'
                  : session.status === 'idle'
                  ? 'bg-zinc-400'
                  : 'bg-amber-400'
              }`}
            />
            <span className="capitalize text-zinc-300">{session.status}</span>
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInterrupt();
            }}
            title="Interrupt process (Ctrl+C)"
            className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-white/5 rounded transition"
          >
            <Square className="w-3 h-3" />
          </button>

          {/* Window control buttons */}
          <div className="flex items-center space-x-1 pl-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
              title="Minimize"
              className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCloseModal(true);
              }}
              title="Close window"
              className="p-1 text-zinc-400 hover:text-red-400 hover:bg-white/5 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Queue Drawer (shows queued instructions for this agent) */}
      {showQueueDrawer && queue.length > 0 && (
        <div className="bg-surface-elevated border-b border-white/10 p-2.5 space-y-1.5 max-h-36 overflow-y-auto">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
            <span>Queued Follow-up Instructions</span>
            <span className="text-zinc-500">Delivered when agent is idle</span>
          </div>
          {queue.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 border border-white/5"
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="text-[10px] text-zinc-500 font-mono">#{idx + 1}</span>
                <span className="truncate">{item.prompt}</span>
              </div>
              <button
                onClick={() => onCancelInstruction(item.id)}
                className="text-[11px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-400/10 transition"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Terminal Viewport */}
      <div className="flex-1 w-full relative p-2 overflow-hidden bg-background">
        <div ref={terminalRef} className="w-full h-full" />
      </div>

      {/* Close Confirmation Modal */}
      {showCloseModal && (
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-surface-elevated border border-white/10 rounded-xl p-4 max-w-sm w-full space-y-3 shadow-2xl">
            <div className="flex items-center space-x-2 text-zinc-100 font-medium text-sm">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span>Close Agent Window</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Agent <strong>{session.name}</strong> is currently active. Would you like to keep it running in the background, or stop the process?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  onMinimize(); // hides window, keeps background execution
                }}
                className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-zinc-200 rounded-lg transition"
              >
                Keep in Background
              </button>
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

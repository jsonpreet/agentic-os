import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DevServerSession } from '@agentic/shared-contracts';
import {
  Globe2,
  Minus,
  Play,
  RefreshCw,
  Server,
  Square,
  X
} from 'lucide-react';

interface DevServersAppWindowProps {
  desktopId: string;
  workspaceId: string;
  repoPaths: string[];
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onOpenUrl: (url: string) => void;
}

function statusColor(status: DevServerSession['status']): string {
  switch (status) {
    case 'running':
      return 'text-emerald-400';
    case 'starting':
      return 'text-amber-300';
    case 'failed':
      return 'text-red-400';
    default:
      return 'text-[var(--glass-text-muted)]';
  }
}

export const DevServersAppWindow: React.FC<DevServersAppWindowProps> = ({
  desktopId,
  repoPaths,
  isFocused,
  onFocus,
  onMinimize,
  onClose,
  onOpenUrl
}) => {
  const [sessions, setSessions] = useState<DevServerSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [name, setName] = useState('Web dev');
  const [command, setCommand] = useState('pnpm dev');
  const [cwd, setCwd] = useState(repoPaths[0] ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (repoPaths.length > 0 && !repoPaths.includes(cwd)) {
      setCwd(repoPaths[0]);
    }
  }, [repoPaths, cwd]);

  const refreshSessions = useCallback(async () => {
    if (!window.agenticApi) return;
    const list = await window.agenticApi.getDevServerSessions(desktopId);
    setSessions(list);
    if (!selectedId && list.length > 0) {
      setSelectedId(list[list.length - 1].id);
    }
  }, [desktopId, selectedId]);

  const loadLogs = useCallback(async (sessionId: string) => {
    if (!window.agenticApi) return;
    const entries = await window.agenticApi.getDevServerLogs(sessionId);
    setLogs(entries.map((entry) => `[${entry.stream}] ${entry.data}`));
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    if (!window.agenticApi) return;

    const unsubLog = window.agenticApi.onDevServerLog((event) => {
      if (event.sessionId !== selectedId) return;
      setLogs((prev) => [...prev, `[${event.stream}] ${event.data}`]);
    });

    const unsubStatus = window.agenticApi.onDevServerStatus((event) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === event.sessionId
            ? {
                ...session,
                status: event.status,
                url: event.url ?? session.url,
                port: event.port ?? session.port,
                updatedAt: Date.now()
              }
            : session
        )
      );
    });

    return () => {
      unsubLog();
      unsubStatus();
    };
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) loadLogs(selectedId);
    else setLogs([]);
  }, [selectedId, loadLogs]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStart = async () => {
    if (!window.agenticApi || !cwd) return;
    setError(null);
    setLoading(true);
    try {
      const session = await window.agenticApi.startDevServer({
        desktopId,
        name,
        command,
        cwd
      });
      setSessions((prev) => [...prev, session]);
      setSelectedId(session.id);
      setLogs([]);
      await refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start dev server');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async (sessionId: string) => {
    if (!window.agenticApi) return;
    setError(null);
    try {
      await window.agenticApi.stopDevServer(sessionId);
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      if (selectedId === sessionId) {
        setSelectedId(null);
        setLogs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop dev server');
    }
  };

  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-dev-servers-window
    >
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move shrink-0">
        <Server className="w-4 h-4 text-primary shrink-0 ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] shrink-0">Dev Servers</span>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 titlebar-no-drag">
          <button
            onClick={(e) => {
              e.stopPropagation();
              refreshSessions();
            }}
            className="p-1 text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] glass-chip rounded"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            className="p-1 text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] glass-chip rounded"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-[var(--glass-text-muted)] hover:text-red-400 glass-chip rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-1.5 text-[11px] text-amber-300 bg-amber-400/10 border-b border-amber-400/20">
          {error}
        </div>
      )}

      {repoPaths.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-xs text-[var(--glass-text-muted)] text-center">
          Attach a repository to this workspace to run dev servers.
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <div className="w-2/5 border-r border-[var(--glass-border-subtle)] flex flex-col min-h-0">
            <div className="p-3 border-b border-[var(--glass-border-subtle)] space-y-2 shrink-0">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Server name"
                className="w-full glass-input-recess rounded-lg px-2.5 py-1.5 text-xs text-[var(--glass-text)] focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Command (e.g. pnpm dev)"
                className="w-full glass-input-recess rounded-lg px-2.5 py-1.5 text-xs text-[var(--glass-text)] font-mono focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
              {repoPaths.length > 1 ? (
                <select
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full glass-input-recess rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--glass-text)]"
                >
                  {repoPaths.map((p) => (
                    <option key={p} value={p}>
                      {p.split('/').pop() ?? p}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[10px] text-[var(--glass-text-muted)] truncate font-mono">{cwd}</p>
              )}
              <button
                onClick={handleStart}
                disabled={loading || !command.trim() || !cwd}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg glass-send-btn text-[11px] text-white disabled:opacity-40"
              >
                <Play className="w-3 h-3" />
                Start server
              </button>
            </div>

            <div className="flex-1 overflow-y-auto text-xs">
              {sessions.length === 0 ? (
                <p className="p-3 text-[var(--glass-text-muted)]">No servers running.</p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedId(session.id)}
                    className={`w-full text-left px-3 py-2 border-b border-[var(--glass-border-subtle)] hover:bg-[var(--glass-hover)] ${
                      selectedId === session.id ? 'bg-[var(--glass-hover)]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--glass-text)] font-medium truncate">{session.name}</span>
                      <span className={`text-[10px] uppercase ${statusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--glass-text-muted)] font-mono truncate mt-0.5">
                      {session.command}
                    </p>
                    {session.url && (
                      <p className="text-[10px] text-primary truncate mt-0.5">{session.url}</p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="h-9 border-b border-[var(--glass-border-subtle)] px-3 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[var(--glass-text-muted)] truncate">
                {selected ? `${selected.name} logs` : 'Select a server'}
              </span>
              {selected && (
                <div className="flex items-center gap-1">
                  {selected.url && (
                    <button
                      onClick={() => onOpenUrl(selected.url!)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg glass-chip text-[10px] text-[var(--glass-text)]"
                    >
                      <Globe2 className="w-3 h-3" />
                      Open
                    </button>
                  )}
                  <button
                    onClick={() => handleStop(selected.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg glass-chip text-[10px] text-[var(--glass-text)]"
                  >
                    <Square className="w-3 h-3" />
                    Stop
                  </button>
                </div>
              )}
            </div>
            <div
              ref={logRef}
              className="flex-1 overflow-y-auto p-3 font-mono text-[11px] text-[var(--glass-text)] whitespace-pre-wrap break-all"
            >
              {logs.length === 0 ? (
                <span className="text-[var(--glass-text-muted)]">Logs will appear here…</span>
              ) : (
                logs.join('\n')
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

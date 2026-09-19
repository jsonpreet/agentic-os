import React, { useEffect, useState, useCallback } from 'react';
import {
  AgentSession,
  AgenticNotification,
  DevServerSession,
  KanbanTask
} from '@agentic/shared-contracts';
import {
  DesktopWidgetLayout,
  getWidgetLayout,
  saveWidgetLayout
} from '../../lib/widget-store.js';
import { Server, CheckSquare } from 'lucide-react';

interface DesktopWidgetsProps {
  desktopId: string;
  workspaceId?: string;
  agentSessions: AgentSession[];
  onFocusSession: (sessionId: string) => void;
  onOpenKanban?: () => void;
  onOpenDevServers?: () => void;
}

export const DesktopWidgets: React.FC<DesktopWidgetsProps> = ({
  desktopId,
  workspaceId,
  agentSessions,
  onFocusSession,
  onOpenKanban,
  onOpenDevServers
}) => {
  const [layout, setLayout] = useState<DesktopWidgetLayout>(() => getWidgetLayout(desktopId));
  const [notifications, setNotifications] = useState<AgenticNotification[]>([]);
  const [devServers, setDevServers] = useState<DevServerSession[]>([]);
  const [kanbanTasks, setKanbanTasks] = useState<KanbanTask[]>([]);

  useEffect(() => {
    setLayout(getWidgetLayout(desktopId));
  }, [desktopId]);

  const loadData = useCallback(async () => {
    if (!window.agenticApi) return;
    try {
      const items = await window.agenticApi.listNotifications({ limit: 5, unreadOnly: true });
      setNotifications(items);

      const servers = await window.agenticApi.getDevServerSessions(desktopId);
      setDevServers(servers.filter((s) => s.status === 'running'));

      if (workspaceId) {
        const tasks = await window.agenticApi.listKanbanTasks(workspaceId, desktopId);
        setKanbanTasks(tasks.filter((t) => t.column !== 'done').slice(0, 4));
      }
    } catch {
      // ignore
    }
  }, [desktopId, workspaceId]);

  useEffect(() => {
    loadData();
    if (!window.agenticApi) return;
    const unsubNotif = window.agenticApi.onNotificationCreated(() => {
      loadData();
    });
    const unsubDev = window.agenticApi.onDevServerStatus(() => {
      loadData();
    });
    return () => {
      unsubNotif?.();
      unsubDev?.();
    };
  }, [loadData]);

  const updateLayout = (next: DesktopWidgetLayout) => {
    setLayout(next);
    saveWidgetLayout(desktopId, next);
  };

  const desktopAgents = agentSessions.filter(
    (session) => session.desktopId === desktopId && session.status !== 'terminated'
  );
  const attentionAgents = desktopAgents.filter(
    (session) => session.status === 'awaiting_approval' || session.status === 'interrupted'
  );

  if (layout.enabled.length === 0) return null;

  return (
    <div className="absolute top-9 left-6 z-20 flex flex-col gap-3 max-w-xs pointer-events-none">
      {/* Running Agents Widget */}
      {layout.enabled.includes('running-agents') && (
        <section className="glass-widget rounded-2xl p-3 pointer-events-auto">
          <p className="text-[11px] font-medium text-[var(--glass-text)] mb-2">Running agents</p>
          {desktopAgents.length === 0 ? (
            <p className="text-[11px] text-[var(--glass-text-muted)]">No active agents on this desktop.</p>
          ) : (
            <div className="space-y-1">
              {desktopAgents.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onFocusSession(session.id)}
                  className="w-full text-left text-[11px] text-[var(--glass-text)] hover:text-[var(--glass-text)] px-2 py-1 rounded-lg hover:bg-[var(--glass-hover)] transition flex items-center justify-between"
                >
                  <span className="truncate">{session.name}</span>
                  <span className="text-[9px] font-mono opacity-70 ml-2 capitalize">{session.status}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Attention / Notifications Widget */}
      {layout.enabled.includes('notifications') && (
        <section className="glass-widget rounded-2xl p-3 pointer-events-auto">
          <p className="text-[11px] font-medium text-[var(--glass-text)] mb-2">Attention</p>
          {attentionAgents.length === 0 && notifications.length === 0 ? (
            <p className="text-[11px] text-[var(--glass-text-muted)]">Nothing needs attention.</p>
          ) : (
            <div className="space-y-1">
              {attentionAgents.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onFocusSession(session.id)}
                  className="w-full text-left text-[11px] text-amber-300 font-medium px-2 py-1 rounded-lg hover:bg-[var(--glass-hover)] transition"
                >
                  {session.name} needs attention
                </button>
              ))}
              {notifications.slice(0, 3).map((notification) => (
                <p key={notification.id} className="text-[11px] text-[var(--glass-text-muted)] px-2 py-1 truncate">
                  {notification.title}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Dev Servers Widget */}
      {layout.enabled.includes('dev-servers') && devServers.length > 0 && (
        <section className="glass-widget rounded-2xl p-3 pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-[var(--glass-text)] flex items-center gap-1.5">
              <Server className="w-3 h-3 text-emerald-400" /> Dev Servers
            </p>
            {onOpenDevServers && (
              <button
                type="button"
                onClick={onOpenDevServers}
                className="text-[10px] text-primary hover:underline"
              >
                Manage
              </button>
            )}
          </div>
          <div className="space-y-1">
            {devServers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-black/10"
              >
                <span className="font-mono text-[var(--glass-text)] truncate">{server.command}</span>
                <span className="text-[10px] font-mono text-emerald-400 font-semibold ml-2">
                  :{server.port ?? 'online'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Kanban Tasks Widget */}
      {layout.enabled.includes('kanban-tasks') && kanbanTasks.length > 0 && (
        <section className="glass-widget rounded-2xl p-3 pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-[var(--glass-text)] flex items-center gap-1.5">
              <CheckSquare className="w-3 h-3 text-primary" /> Active Tasks
            </p>
            {onOpenKanban && (
              <button
                type="button"
                onClick={onOpenKanban}
                className="text-[10px] text-primary hover:underline"
              >
                Board
              </button>
            )}
          </div>
          <div className="space-y-1">
            {kanbanTasks.map((task) => (
              <div
                key={task.id}
                onClick={onOpenKanban}
                className="text-[11px] text-[var(--glass-text)] px-2 py-1 rounded-lg hover:bg-[var(--glass-hover)] cursor-pointer transition flex items-center justify-between gap-2"
              >
                <span className="truncate">{task.title}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                  task.column === 'in_progress' ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-neutral-400'
                }`}>
                  {task.column === 'in_progress' ? 'doing' : 'todo'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Note Widget */}
      {layout.enabled.includes('quick-note') && (
        <section className="glass-widget rounded-2xl p-3 pointer-events-auto">
          <p className="text-[11px] font-medium text-[var(--glass-text)] mb-2">Quick note</p>
          <textarea
            value={layout.quickNote}
            onChange={(event) =>
              updateLayout({ ...layout, quickNote: event.target.value })
            }
            rows={3}
            placeholder="Scratch ideas for this desktop…"
            className="w-full text-[11px] bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-lg px-2 py-1.5 text-[var(--glass-text)] outline-none resize-none placeholder-[var(--glass-text-muted)]"
          />
        </section>
      )}
    </div>
  );
};

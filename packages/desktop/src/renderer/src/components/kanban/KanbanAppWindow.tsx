import React, { useCallback, useEffect, useState } from 'react';
import {
  AgentSession,
  KANBAN_COLUMNS,
  KANBAN_COLUMN_LABELS,
  KanbanColumn,
  KanbanTask
} from '@agentic/shared-contracts';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Columns3,
  Minus,
  Plus,
  Trash2,
  X
} from 'lucide-react';

interface KanbanAppWindowProps {
  workspaceId: string;
  desktopId: string;
  agentSessions: AgentSession[];
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onFocusAgent: (sessionId: string) => void;
}

export const KanbanAppWindow: React.FC<KanbanAppWindowProps> = ({
  workspaceId,
  desktopId,
  agentSessions,
  isFocused,
  onFocus,
  onMinimize,
  onClose,
  onFocusAgent
}) => {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<KanbanColumn, string>>({
    todo: '',
    in_progress: '',
    done: ''
  });

  const desktopAgents = agentSessions.filter(
    (session) => session.desktopId === desktopId && session.status !== 'terminated'
  );

  const refreshTasks = useCallback(async () => {
    if (!window.agenticApi) return;
    const list = await window.agenticApi.listKanbanTasks(workspaceId, desktopId);
    setTasks(list);
  }, [workspaceId, desktopId]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  const handleCreate = async (column: KanbanColumn) => {
    const title = drafts[column].trim();
    if (!title || !window.agenticApi) return;
    setError(null);
    try {
      const task = await window.agenticApi.createKanbanTask({
        workspaceId,
        desktopId,
        column,
        title
      });
      setTasks((prev) => [...prev, task]);
      setDrafts((prev) => ({ ...prev, [column]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    }
  };

  const handleMove = async (task: KanbanTask, direction: 'left' | 'right') => {
    if (!window.agenticApi) return;
    const index = KANBAN_COLUMNS.indexOf(task.column);
    const nextIndex = direction === 'left' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= KANBAN_COLUMNS.length) return;

    const nextColumn = KANBAN_COLUMNS[nextIndex];
    setError(null);
    try {
      const updated = await window.agenticApi.updateKanbanTask({
        taskId: task.id,
        column: nextColumn
      });
      setTasks((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move task');
    }
  };

  const handleLinkAgent = async (task: KanbanTask, sessionId: string) => {
    if (!window.agenticApi) return;
    setError(null);
    try {
      const updated = await window.agenticApi.updateKanbanTask({
        taskId: task.id,
        linkedSessionId: sessionId || null
      });
      setTasks((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link agent');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.agenticApi) return;
    setError(null);
    try {
      await window.agenticApi.deleteKanbanTask(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const agentName = (sessionId?: string) =>
    desktopAgents.find((session) => session.id === sessionId)?.name;

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-kanban-window
    >
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move shrink-0">
        <Columns3 className="w-3.5 h-3.5 text-primary ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] flex-1">Kanban</span>
        <button
          type="button"
          onClick={onMinimize}
          className="p-1 rounded-md hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)]"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-2 p-2 min-h-0">
        {KANBAN_COLUMNS.map((column) => {
          const columnTasks = tasks.filter((task) => task.column === column);
          return (
            <div
              key={column}
              className="flex flex-col min-h-0 rounded-xl border border-[var(--glass-border-subtle)] bg-[var(--glass-hover)]"
            >
              <div className="px-2.5 py-2 border-b border-[var(--glass-border-subtle)] text-xs font-medium text-[var(--glass-text)]">
                {KANBAN_COLUMN_LABELS[column]}
                <span className="ml-1.5 text-[var(--glass-text-muted)]">{columnTasks.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {columnTasks.map((task) => (
                  <div key={task.id} className="rounded-lg glass-chip p-2.5 space-y-2">
                    <div className="text-xs font-medium text-[var(--glass-text)]">{task.title}</div>
                    {task.linkedSessionId && (
                      <button
                        type="button"
                        onClick={() => onFocusAgent(task.linkedSessionId!)}
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <Bot className="w-3 h-3" />
                        {agentName(task.linkedSessionId) ?? 'Linked agent'}
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      <select
                        value={task.linkedSessionId ?? ''}
                        onChange={(e) => handleLinkAgent(task, e.target.value)}
                        className="flex-1 text-[10px] bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded px-1.5 py-1 text-[var(--glass-text)]"
                      >
                        <option value="">Link agent…</option>
                        {desktopAgents.map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleMove(task, 'left')}
                        disabled={column === 'todo'}
                        className="p-1 rounded hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)] disabled:opacity-30"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(task, 'right')}
                        disabled={column === 'done'}
                        className="p-1 rounded hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)] disabled:opacity-30"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-[var(--glass-text-muted)] hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2 border-t border-[var(--glass-border-subtle)] flex gap-1">
                <input
                  value={drafts[column]}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [column]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate(column);
                  }}
                  placeholder="Add task…"
                  className="flex-1 text-[11px] bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded px-2 py-1.5 text-[var(--glass-text)] outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCreate(column)}
                  className="p-1.5 rounded-lg glass-chip hover:bg-[var(--glass-hover)] text-[var(--glass-text)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-300 border-t border-red-400/20 bg-red-500/10">
          {error}
        </div>
      )}
    </div>
  );
};

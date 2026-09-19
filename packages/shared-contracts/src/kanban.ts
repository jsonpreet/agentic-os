export type KanbanColumn = 'todo' | 'in_progress' | 'done';

export const KANBAN_COLUMNS: KanbanColumn[] = ['todo', 'in_progress', 'done'];

export const KANBAN_COLUMN_LABELS: Record<KanbanColumn, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done'
};

export interface KanbanTask {
  id: string;
  workspaceId: string;
  desktopId: string;
  column: KanbanColumn;
  title: string;
  description?: string;
  linkedSessionId?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateKanbanTaskParams {
  workspaceId: string;
  desktopId: string;
  column?: KanbanColumn;
  title: string;
  description?: string;
  linkedSessionId?: string;
}

export interface UpdateKanbanTaskParams {
  taskId: string;
  column?: KanbanColumn;
  title?: string;
  description?: string;
  linkedSessionId?: string | null;
  sortOrder?: number;
}

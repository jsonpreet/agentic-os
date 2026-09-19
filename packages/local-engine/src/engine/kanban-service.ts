import { nanoid } from 'nanoid';
import {
  CreateKanbanTaskParams,
  KanbanColumn,
  KanbanTask,
  UpdateKanbanTaskParams
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';

export class KanbanService {
  constructor(private db: EngineDatabase) {}

  listTasks(workspaceId: string, desktopId: string): KanbanTask[] {
    return this.db.getKanbanTasks(workspaceId, desktopId);
  }

  createTask(params: CreateKanbanTaskParams): KanbanTask {
    const title = params.title.trim();
    if (!title) {
      throw new Error('Task title is required.');
    }

    const column: KanbanColumn = params.column ?? 'todo';
    const existing = this.db.getKanbanTasks(params.workspaceId, params.desktopId);
    const sortOrder =
      existing.filter((task) => task.column === column).reduce(
        (max, task) => Math.max(max, task.sortOrder),
        -1
      ) + 1;

    const now = Date.now();
    const task: KanbanTask = {
      id: `task-${nanoid()}`,
      workspaceId: params.workspaceId,
      desktopId: params.desktopId,
      column,
      title,
      description: params.description?.trim() || undefined,
      linkedSessionId: params.linkedSessionId,
      sortOrder,
      createdAt: now,
      updatedAt: now
    };
    this.db.saveKanbanTask(task);
    return task;
  }

  updateTask(params: UpdateKanbanTaskParams): KanbanTask {
    const existing = this.db.getKanbanTask(params.taskId);
    if (!existing) {
      throw new Error(`Task ${params.taskId} not found.`);
    }

    const task: KanbanTask = {
      ...existing,
      column: params.column ?? existing.column,
      title: params.title !== undefined ? params.title.trim() || existing.title : existing.title,
      description:
        params.description !== undefined
          ? params.description.trim() || undefined
          : existing.description,
      linkedSessionId:
        params.linkedSessionId === null
          ? undefined
          : params.linkedSessionId !== undefined
            ? params.linkedSessionId
            : existing.linkedSessionId,
      sortOrder: params.sortOrder ?? existing.sortOrder,
      updatedAt: Date.now()
    };
    this.db.saveKanbanTask(task);
    return task;
  }

  deleteTask(taskId: string): boolean {
    return this.db.deleteKanbanTask(taskId);
  }
}

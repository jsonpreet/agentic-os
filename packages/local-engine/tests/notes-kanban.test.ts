import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EngineDatabase } from '../src/db/index.js';
import { NotesService } from '../src/engine/notes-service.js';
import { KanbanService } from '../src/engine/kanban-service.js';

describe('NotesService', () => {
  let tmpDir: string;
  let db: EngineDatabase;
  let notes: NotesService;
  let workspaceId: string;
  let desktopId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-notes-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    notes = new NotesService(db);

    workspaceId = 'ws-notes';
    desktopId = 'desk-notes';
    const now = Date.now();
    db.saveWorkspace({
      id: workspaceId,
      name: 'Notes Workspace',
      repositories: [],
      createdAt: now,
      updatedAt: now
    });
    db.saveDesktop({
      id: desktopId,
      workspaceId,
      name: 'Build',
      type: 'build',
      order: 0,
      createdAt: now
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates, updates, and deletes notes per desktop', () => {
    const created = notes.createNote({
      workspaceId,
      desktopId,
      title: 'Spec',
      content: '# Hello'
    });
    expect(created.title).toBe('Spec');

    const updated = notes.updateNote({
      noteId: created.id,
      content: '# Updated'
    });
    expect(updated.content).toBe('# Updated');

    const list = notes.listNotes(workspaceId, desktopId);
    expect(list).toHaveLength(1);

    expect(notes.deleteNote(created.id)).toBe(true);
    expect(notes.listNotes(workspaceId, desktopId)).toHaveLength(0);
  });
});

describe('KanbanService', () => {
  let tmpDir: string;
  let db: EngineDatabase;
  let kanban: KanbanService;
  let workspaceId: string;
  let desktopId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-kanban-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
    kanban = new KanbanService(db);

    workspaceId = 'ws-kanban';
    desktopId = 'desk-kanban';
    const now = Date.now();
    db.saveWorkspace({
      id: workspaceId,
      name: 'Kanban Workspace',
      repositories: [],
      createdAt: now,
      updatedAt: now
    });
    db.saveDesktop({
      id: desktopId,
      workspaceId,
      name: 'Build',
      type: 'build',
      order: 0,
      createdAt: now
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates tasks and moves columns', () => {
    const task = kanban.createTask({
      workspaceId,
      desktopId,
      title: 'Ship M3'
    });
    expect(task.column).toBe('todo');

    const moved = kanban.updateTask({
      taskId: task.id,
      column: 'in_progress'
    });
    expect(moved.column).toBe('in_progress');

    const list = kanban.listTasks(workspaceId, desktopId);
    expect(list).toHaveLength(1);
    expect(kanban.deleteTask(task.id)).toBe(true);
  });
});

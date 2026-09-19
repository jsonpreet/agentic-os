import { nanoid } from 'nanoid';
import {
  CreateNoteParams,
  UpdateNoteParams,
  WorkspaceNote
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';

export class NotesService {
  constructor(private db: EngineDatabase) {}

  listNotes(workspaceId: string, desktopId: string): WorkspaceNote[] {
    return this.db.getNotes(workspaceId, desktopId);
  }

  createNote(params: CreateNoteParams): WorkspaceNote {
    const now = Date.now();
    const note: WorkspaceNote = {
      id: `note-${nanoid()}`,
      workspaceId: params.workspaceId,
      desktopId: params.desktopId,
      title: params.title?.trim() || 'Untitled',
      content: params.content ?? '',
      createdAt: now,
      updatedAt: now
    };
    this.db.saveNote(note);
    return note;
  }

  updateNote(params: UpdateNoteParams): WorkspaceNote {
    const existing = this.db.getNote(params.noteId);
    if (!existing) {
      throw new Error(`Note ${params.noteId} not found.`);
    }

    const note: WorkspaceNote = {
      ...existing,
      title: params.title !== undefined ? params.title.trim() || 'Untitled' : existing.title,
      content: params.content !== undefined ? params.content : existing.content,
      updatedAt: Date.now()
    };
    this.db.saveNote(note);
    return note;
  }

  deleteNote(noteId: string): boolean {
    return this.db.deleteNote(noteId);
  }
}

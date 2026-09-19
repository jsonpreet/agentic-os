export interface WorkspaceNote {
  id: string;
  workspaceId: string;
  desktopId: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateNoteParams {
  workspaceId: string;
  desktopId: string;
  title?: string;
  content?: string;
}

export interface UpdateNoteParams {
  noteId: string;
  title?: string;
  content?: string;
}

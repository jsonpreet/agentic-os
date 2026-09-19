import { AgentSession, BrowserSession } from '@agentic/shared-contracts';
import { getDevServersWindowId } from './dev-servers-window.js';
import { getEditorWindowId } from './editor-window.js';
import { getFilesWindowId } from './files-window.js';
import { getKanbanWindowId } from './kanban-window.js';
import { getNotesWindowId } from './notes-window.js';
import { getSourceControlWindowId } from './source-control-window.js';
import { getApiClientWindowId } from './api-client-window.js';
import { getDatabaseWindowId } from './database-window.js';
import { getDesignWindowId } from './design-window.js';
import { getActivityLogsWindowId } from './activity-logs-window.js';

export type ActiveWindowKind =
  | 'agent'
  | 'browser'
  | 'files'
  | 'editor'
  | 'source-control'
  | 'dev-servers'
  | 'notes'
  | 'kanban'
  | 'api-client'
  | 'database'
  | 'design'
  | 'activity-logs'
  | 'desktop';

export interface ActiveWindowInfo {
  id: string;
  kind: ActiveWindowKind;
  title: string;
}

export interface ResolveActiveWindowParams {
  focusedWindowId: string | null;
  desktopId: string;
  agentSessions: AgentSession[];
  browserSessions: BrowserSession[];
  filesWindowOpen: boolean;
  editorWindowOpen: boolean;
  sourceControlWindowOpen: boolean;
  devServersWindowOpen: boolean;
  notesWindowOpen: boolean;
  kanbanWindowOpen: boolean;
  apiClientWindowOpen?: boolean;
  databaseWindowOpen?: boolean;
  designWindowOpen?: boolean;
  activityLogsWindowOpen?: boolean;
}

export function resolveActiveWindow(params: ResolveActiveWindowParams): ActiveWindowInfo {
  const {
    focusedWindowId,
    desktopId,
    agentSessions,
    browserSessions,
    filesWindowOpen,
    editorWindowOpen,
    sourceControlWindowOpen,
    devServersWindowOpen,
    notesWindowOpen,
    kanbanWindowOpen,
    apiClientWindowOpen,
    databaseWindowOpen,
    designWindowOpen,
    activityLogsWindowOpen
  } = params;

  if (!focusedWindowId) {
    return { id: 'desktop', kind: 'desktop', title: 'Agentic' };
  }

  const agent = agentSessions.find(
    (s) => s.id === focusedWindowId && s.desktopId === desktopId && s.status !== 'terminated'
  );
  if (agent) {
    return { id: agent.id, kind: 'agent', title: agent.name };
  }

  const browser = browserSessions.find(
    (b) => b.id === focusedWindowId && b.desktopId === desktopId
  );
  if (browser) {
    return {
      id: browser.id,
      kind: 'browser',
      title: browser.title || browser.url || 'Browser'
    };
  }

  const filesWindowId = getFilesWindowId(desktopId);
  if (filesWindowOpen && focusedWindowId === filesWindowId) {
    return { id: filesWindowId, kind: 'files', title: 'Files' };
  }

  const editorWindowId = getEditorWindowId(desktopId);
  if (editorWindowOpen && focusedWindowId === editorWindowId) {
    return { id: editorWindowId, kind: 'editor', title: 'Editor' };
  }

  const sourceControlWindowId = getSourceControlWindowId(desktopId);
  if (sourceControlWindowOpen && focusedWindowId === sourceControlWindowId) {
    return { id: sourceControlWindowId, kind: 'source-control', title: 'Source Control' };
  }

  const devServersWindowId = getDevServersWindowId(desktopId);
  if (devServersWindowOpen && focusedWindowId === devServersWindowId) {
    return { id: devServersWindowId, kind: 'dev-servers', title: 'Dev Servers' };
  }

  const notesWindowId = getNotesWindowId(desktopId);
  if (notesWindowOpen && focusedWindowId === notesWindowId) {
    return { id: notesWindowId, kind: 'notes', title: 'Notes' };
  }

  const kanbanWindowId = getKanbanWindowId(desktopId);
  if (kanbanWindowOpen && focusedWindowId === kanbanWindowId) {
    return { id: kanbanWindowId, kind: 'kanban', title: 'Kanban' };
  }

  const apiClientWindowId = getApiClientWindowId(desktopId);
  if (apiClientWindowOpen && focusedWindowId === apiClientWindowId) {
    return { id: apiClientWindowId, kind: 'api-client', title: 'API Client' };
  }

  const databaseWindowId = getDatabaseWindowId(desktopId);
  if (databaseWindowOpen && focusedWindowId === databaseWindowId) {
    return { id: databaseWindowId, kind: 'database', title: 'Database Explorer' };
  }

  const designWindowId = getDesignWindowId(desktopId);
  if (designWindowOpen && focusedWindowId === designWindowId) {
    return { id: designWindowId, kind: 'design', title: 'Design & Assets' };
  }

  const activityLogsWindowId = getActivityLogsWindowId(desktopId);
  if (activityLogsWindowOpen && focusedWindowId === activityLogsWindowId) {
    return { id: activityLogsWindowId, kind: 'activity-logs', title: 'Activity & Logs' };
  }

  return { id: 'desktop', kind: 'desktop', title: 'Agentic' };
}

export function workspaceIndexForShortcut(
  workspaces: { id: string }[],
  index: number
): string | null {
  if (index < 0 || index >= workspaces.length || index >= 9) return null;
  return workspaces[index]?.id ?? null;
}

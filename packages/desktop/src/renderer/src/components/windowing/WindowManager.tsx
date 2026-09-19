import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AgentSession,
  AgentInstruction,
  BrowserSession,
  WindowLayout
} from '@agentic/shared-contracts';
import {
  Code2,
  Columns3,
  FileText,
  FolderOpen,
  GitBranch,
  Globe2,
  MessageSquare,
  Server
} from 'lucide-react';
import { AgentTerminalWindow } from '../terminal/AgentTerminalWindow.js';
import { BrowserAppWindow } from '../browser/BrowserAppWindow.js';
import { FilesAppWindow } from '../files/FilesAppWindow.js';
import { getFilesWindowId } from '../../lib/files-window.js';
import { getEditorWindowId } from '../../lib/editor-window.js';
import { EditorAppWindow } from '../editor/EditorAppWindow.js';
import { SourceControlAppWindow } from '../source-control/SourceControlAppWindow.js';
import { getSourceControlWindowId } from '../../lib/source-control-window.js';
import { DevServersAppWindow } from '../dev-servers/DevServersAppWindow.js';
import { getDevServersWindowId } from '../../lib/dev-servers-window.js';
import { NotesAppWindow } from '../notes/NotesAppWindow.js';
import { getNotesWindowId } from '../../lib/notes-window.js';
import { KanbanAppWindow } from '../kanban/KanbanAppWindow.js';
import { getKanbanWindowId } from '../../lib/kanban-window.js';
import { ApiClientAppWindow } from '../api-client/ApiClientAppWindow.js';
import { getApiClientWindowId } from '../../lib/api-client-window.js';
import { DatabaseExplorerAppWindow } from '../database/DatabaseExplorerAppWindow.js';
import { getDatabaseWindowId } from '../../lib/database-window.js';
import { DesignAssetsAppWindow } from '../design/DesignAssetsAppWindow.js';
import { getDesignWindowId } from '../../lib/design-window.js';
import { ActivityLogsAppWindow } from '../activity/ActivityLogsAppWindow.js';
import { getActivityLogsWindowId } from '../../lib/activity-logs-window.js';
import { ActiveWindowInfo, resolveActiveWindow } from '../../lib/active-window.js';
import { Send, Database, Palette, Activity } from 'lucide-react';

interface WindowManagerProps {
  desktopId: string;
  agentSessions: AgentSession[];
  browserSessions: BrowserSession[];
  queues: Record<string, AgentInstruction[]>;
  focusSessionId: string | null;
  onFocusSessionHandled: () => void;
  onMinimizedChange: (sessionId: string, minimized: boolean) => void;
  onDesktopContextMenu: (x: number, y: number) => void;
  onRenameAgent: (sessionId: string, newName: string) => void;
  onTerminateAgent: (sessionId: string) => void;
  onInterruptAgent: (sessionId: string) => void;
  onCancelInstruction: (instructionId: string) => void;
  onEditInstruction: (instructionId: string, newPrompt: string) => void;
  onCloseBrowser: (sessionId: string) => void;
  onBrowserUrlChange: (sessionId: string, url: string, title?: string) => void;
  workspaceId: string;
  filesWindowOpen: boolean;
  repoPaths: string[];
  onCloseFiles: () => void;
  onOpenInEditor: (filePath: string) => void;
  editorWindowOpen: boolean;
  editorPendingFile: string | null;
  onCloseEditor: () => void;
  onEditorPendingHandled: () => void;
  sourceControlWindowOpen: boolean;
  onCloseSourceControl: () => void;
  devServersWindowOpen: boolean;
  onCloseDevServers: () => void;
  notesWindowOpen: boolean;
  onCloseNotes: () => void;
  kanbanWindowOpen: boolean;
  onCloseKanban: () => void;
  apiClientWindowOpen: boolean;
  onCloseApiClient: () => void;
  onOpenApiClient: () => void;
  databaseWindowOpen: boolean;
  onCloseDatabase: () => void;
  onOpenDatabase: () => void;
  designWindowOpen: boolean;
  onCloseDesign: () => void;
  onOpenDesign: () => void;
  activityLogsWindowOpen: boolean;
  onCloseActivityLogs: () => void;
  onOpenActivityLogs: () => void;
  onOpenFiles: () => void;
  onOpenEditor: () => void;
  onOpenSourceControl: () => void;
  onOpenDevServers: () => void;
  onOpenNotes: () => void;
  onOpenKanban: () => void;
  onOpenBrowser: (url?: string) => void;
  onFocusAgent: (sessionId: string) => void;
  onFocusPrompt: () => void;
  engineConnected: boolean;
  onActiveWindowChange?: (info: ActiveWindowInfo) => void;
}

export const WindowManager: React.FC<WindowManagerProps> = ({
  desktopId,
  agentSessions,
  queues,
  focusSessionId,
  onFocusSessionHandled,
  onMinimizedChange,
  onDesktopContextMenu,
  onRenameAgent,
  onTerminateAgent,
  onInterruptAgent,
  onCancelInstruction,
  onEditInstruction,
  browserSessions,
  onCloseBrowser,
  onBrowserUrlChange,
  workspaceId,
  filesWindowOpen,
  repoPaths,
  onCloseFiles,
  onOpenInEditor,
  editorWindowOpen,
  editorPendingFile,
  onCloseEditor,
  onEditorPendingHandled,
  sourceControlWindowOpen,
  onCloseSourceControl,
  devServersWindowOpen,
  onCloseDevServers,
  notesWindowOpen,
  onCloseNotes,
  kanbanWindowOpen,
  onCloseKanban,
  apiClientWindowOpen,
  onCloseApiClient,
  onOpenApiClient,
  databaseWindowOpen,
  onCloseDatabase,
  onOpenDatabase,
  designWindowOpen,
  onCloseDesign,
  onOpenDesign,
  activityLogsWindowOpen,
  onCloseActivityLogs,
  onOpenActivityLogs,
  onOpenFiles,
  onOpenEditor,
  onOpenSourceControl,
  onOpenDevServers,
  onOpenNotes,
  onOpenKanban,
  onOpenBrowser,
  onFocusAgent,
  onFocusPrompt,
  engineConnected,
  onActiveWindowChange
}) => {
  const [layouts, setLayouts] = useState<Record<string, WindowLayout>>({});
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const openAppWindowsRef = useRef({
    files: filesWindowOpen,
    editor: editorWindowOpen,
    sourceControl: sourceControlWindowOpen,
    devServers: devServersWindowOpen,
    notes: notesWindowOpen,
    kanban: kanbanWindowOpen,
    apiClient: apiClientWindowOpen,
    database: databaseWindowOpen,
    design: designWindowOpen,
    activityLogs: activityLogsWindowOpen
  });
  openAppWindowsRef.current = {
    files: filesWindowOpen,
    editor: editorWindowOpen,
    sourceControl: sourceControlWindowOpen,
    devServers: devServersWindowOpen,
    notes: notesWindowOpen,
    kanban: kanbanWindowOpen,
    apiClient: apiClientWindowOpen,
    database: databaseWindowOpen,
    design: designWindowOpen,
    activityLogs: activityLogsWindowOpen
  };

  // Active sessions in current desktop
  const desktopSessions = agentSessions.filter(
    (s) => s.desktopId === desktopId && s.status !== 'terminated'
  );
  const desktopBrowsers = browserSessions.filter((s) => s.desktopId === desktopId);
  const filesWindowId = getFilesWindowId(desktopId);
  const editorWindowId = getEditorWindowId(desktopId);
  const sourceControlWindowId = getSourceControlWindowId(desktopId);
  const devServersWindowId = getDevServersWindowId(desktopId);
  const notesWindowId = getNotesWindowId(desktopId);
  const kanbanWindowId = getKanbanWindowId(desktopId);
  const apiClientWindowId = getApiClientWindowId(desktopId);
  const databaseWindowId = getDatabaseWindowId(desktopId);
  const designWindowId = getDesignWindowId(desktopId);
  const activityLogsWindowId = getActivityLogsWindowId(desktopId);
  const allWindowIds = [
    ...desktopSessions.map((s) => s.id),
    ...desktopBrowsers.map((b) => b.id),
    ...(filesWindowOpen ? [filesWindowId] : []),
    ...(editorWindowOpen ? [editorWindowId] : []),
    ...(sourceControlWindowOpen ? [sourceControlWindowId] : []),
    ...(devServersWindowOpen ? [devServersWindowId] : []),
    ...(notesWindowOpen ? [notesWindowId] : []),
    ...(kanbanWindowOpen ? [kanbanWindowId] : []),
    ...(apiClientWindowOpen ? [apiClientWindowId] : []),
    ...(databaseWindowOpen ? [databaseWindowId] : []),
    ...(designWindowOpen ? [designWindowId] : []),
    ...(activityLogsWindowOpen ? [activityLogsWindowId] : [])
  ];

  // Load layouts from DB
  useEffect(() => {
    if (!window.agenticApi || !desktopId) return;

    window.agenticApi.getWindowLayouts(desktopId).then((saved) => {
      const open = openAppWindowsRef.current;
      const layoutMap: Record<string, WindowLayout> = {};
      for (const l of saved) {
        const shouldRestore =
          (l.windowId === filesWindowId && open.files) ||
          (l.windowId === editorWindowId && open.editor) ||
          (l.windowId === sourceControlWindowId && open.sourceControl) ||
          (l.windowId === devServersWindowId && open.devServers) ||
          (l.windowId === notesWindowId && open.notes) ||
          (l.windowId === kanbanWindowId && open.kanban) ||
          (l.windowId === apiClientWindowId && open.apiClient) ||
          (l.windowId === databaseWindowId && open.database) ||
          (l.windowId === designWindowId && open.design) ||
          (l.windowId === activityLogsWindowId && open.activityLogs);
        const layout =
          shouldRestore && l.state === 'minimized'
            ? { ...l, state: 'normal' as const, updatedAt: Date.now() }
            : l;
        layoutMap[l.windowId] = layout;
        if (layout.state === 'minimized') {
          onMinimizedChange(l.windowId, true);
        } else if (shouldRestore && l.state === 'minimized') {
          onMinimizedChange(l.windowId, false);
        }
      }
      setLayouts(layoutMap);
    });
  }, [
    desktopId,
    onMinimizedChange,
    filesWindowId,
    editorWindowId,
    sourceControlWindowId,
    devServersWindowId,
    notesWindowId,
    kanbanWindowId,
    apiClientWindowId,
    databaseWindowId,
    designWindowId,
    activityLogsWindowId
  ]);

  // Ensure default layout for new windows
  useEffect(() => {
    setLayouts((prev) => {
      const updated = { ...prev };
      let changed = false;

      allWindowIds.forEach((windowId, idx) => {
        const isOpenAppWindow =
          (filesWindowOpen && windowId === filesWindowId) ||
          (editorWindowOpen && windowId === editorWindowId) ||
          (sourceControlWindowOpen && windowId === sourceControlWindowId) ||
          (devServersWindowOpen && windowId === devServersWindowId) ||
          (notesWindowOpen && windowId === notesWindowId) ||
          (kanbanWindowOpen && windowId === kanbanWindowId) ||
          (apiClientWindowOpen && windowId === apiClientWindowId) ||
          (databaseWindowOpen && windowId === databaseWindowId) ||
          (designWindowOpen && windowId === designWindowId) ||
          (activityLogsWindowOpen && windowId === activityLogsWindowId);

        if (!updated[windowId]) {
          const cascadeOffset = (idx % 6) * 32;
          const isBrowser = windowId.startsWith('browser-');
          const isFiles = windowId.startsWith('files-');
          const isEditor = windowId.startsWith('editor-');
          const isSourceControl = windowId.startsWith('source-control-');
          const isDevServers = windowId.startsWith('dev-servers-');
          const isNotes = windowId.startsWith('notes-');
          const isKanban = windowId.startsWith('kanban-');
          const isApiClient = windowId.startsWith('api-client-');
          const isDatabase = windowId.startsWith('database-');
          const isDesign = windowId.startsWith('design-');
          const isActivityLogs = windowId.startsWith('activity-logs-');
          const defaultLayout: WindowLayout = {
            windowId,
            desktopId,
            x: 48 + cascadeOffset,
            y: 44 + cascadeOffset,
            width: isBrowser
              ? 960
              : isApiClient
                ? 900
                : isDatabase
                  ? 920
                  : isDesign
                    ? 940
                    : isActivityLogs
                      ? 880
                      : isEditor
                        ? 880
                        : isKanban
                          ? 860
                          : isSourceControl
                            ? 800
                            : isDevServers
                              ? 820
                              : isNotes
                                ? 760
                                : isFiles
                                  ? 720
                                  : 920,
            height: isBrowser
              ? 600
              : isApiClient
                ? 560
                : isDatabase
                  ? 560
                  : isDesign
                    ? 580
                    : isActivityLogs
                      ? 560
                      : isEditor
                        ? 560
                        : isKanban
                          ? 520
                          : isSourceControl
                            ? 520
                            : isDevServers
                              ? 540
                              : isNotes
                                ? 500
                                : isFiles
                                  ? 480
                                  : 620,
            state: 'normal',
            zIndex: idx + 1,
            updatedAt: Date.now()
          };
          updated[windowId] = defaultLayout;
          changed = true;
          window.agenticApi?.saveWindowLayout(defaultLayout);
        } else if (isOpenAppWindow && updated[windowId].state === 'minimized') {
          updated[windowId] = {
            ...updated[windowId],
            state: 'normal',
            updatedAt: Date.now()
          };
          onMinimizedChange(windowId, false);
          changed = true;
          window.agenticApi?.saveWindowLayout(updated[windowId]);
        }
      });

      return changed ? updated : prev;
    });
  }, [allWindowIds.join(','), desktopId]);

  const bringToFront = useCallback((windowId: string) => {
    setFocusedWindowId(windowId);
    setLayouts((prev) => {
      const current = prev[windowId];
      if (!current) return prev;
      const maxZ = Math.max(1, ...Object.values(prev).map((l) => l.zIndex));
      if (current.zIndex === maxZ) return prev;

      const updated = { ...current, zIndex: maxZ + 1, updatedAt: Date.now() };
      window.agenticApi?.saveWindowLayout(updated);
      return { ...prev, [windowId]: updated };
    });
  }, []);

  const focusWindow = useCallback(
    (windowId: string) => {
      setLayouts((prev) => {
        const win = prev[windowId];
        if (!win || win.state !== 'minimized') return prev;
        const updated: WindowLayout = { ...win, state: 'normal', updatedAt: Date.now() };
        window.agenticApi?.saveWindowLayout(updated);
        onMinimizedChange(windowId, false);
        return { ...prev, [windowId]: updated };
      });
      bringToFront(windowId);
    },
    [bringToFront, onMinimizedChange]
  );

  const handleStartDrag = (
    e: React.MouseEvent,
    windowId: string,
    initialX: number,
    initialY: number
  ) => {
    e.preventDefault();
    bringToFront(windowId);

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMouseX;
      const deltaY = moveEvent.clientY - startMouseY;

      const newX = Math.max(10, initialX + deltaX);
      const newY = Math.max(10, initialY + deltaY);

      setLayouts((prev) => {
        const win = prev[windowId];
        if (!win) return prev;
        return {
          ...prev,
          [windowId]: { ...win, x: newX, y: newY }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setLayouts((prev) => {
        const win = prev[windowId];
        if (win) {
          window.agenticApi?.saveWindowLayout(win);
        }
        return prev;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleStartResize = (
    e: React.MouseEvent,
    windowId: string,
    initialW: number,
    initialH: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(windowId);

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newW = Math.max(480, initialW + (moveEvent.clientX - startMouseX));
      const newH = Math.max(300, initialH + (moveEvent.clientY - startMouseY));

      setLayouts((prev) => {
        const win = prev[windowId];
        if (!win) return prev;
        return {
          ...prev,
          [windowId]: { ...win, width: newW, height: newH }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      setLayouts((prev) => {
        const win = prev[windowId];
        if (win) {
          window.agenticApi?.saveWindowLayout(win);
        }
        return prev;
      });
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const restoreWindow = (windowId: string) => {
    focusWindow(windowId);
  };

  const handleMinimize = (windowId: string) => {
    setLayouts((prev) => {
      const win = prev[windowId];
      if (!win) return prev;
      const updated: WindowLayout = { ...win, state: 'minimized', updatedAt: Date.now() };
      window.agenticApi?.saveWindowLayout(updated);
      onMinimizedChange(windowId, true);
      return { ...prev, [windowId]: updated };
    });
  };

  useEffect(() => {
    if (filesWindowOpen) focusWindow(filesWindowId);
  }, [filesWindowOpen, filesWindowId, focusWindow]);

  useEffect(() => {
    if (editorWindowOpen) focusWindow(editorWindowId);
  }, [editorWindowOpen, editorWindowId, focusWindow]);

  useEffect(() => {
    if (sourceControlWindowOpen) focusWindow(sourceControlWindowId);
  }, [sourceControlWindowOpen, sourceControlWindowId, focusWindow]);

  useEffect(() => {
    if (devServersWindowOpen) focusWindow(devServersWindowId);
  }, [devServersWindowOpen, devServersWindowId, focusWindow]);

  useEffect(() => {
    if (notesWindowOpen) focusWindow(notesWindowId);
  }, [notesWindowOpen, notesWindowId, focusWindow]);

  useEffect(() => {
    if (kanbanWindowOpen) focusWindow(kanbanWindowId);
  }, [kanbanWindowOpen, kanbanWindowId, focusWindow]);

  useEffect(() => {
    if (apiClientWindowOpen) focusWindow(apiClientWindowId);
  }, [apiClientWindowOpen, apiClientWindowId, focusWindow]);

  useEffect(() => {
    if (databaseWindowOpen) focusWindow(databaseWindowId);
  }, [databaseWindowOpen, databaseWindowId, focusWindow]);

  useEffect(() => {
    if (designWindowOpen) focusWindow(designWindowId);
  }, [designWindowOpen, designWindowId, focusWindow]);

  useEffect(() => {
    if (activityLogsWindowOpen) focusWindow(activityLogsWindowId);
  }, [activityLogsWindowOpen, activityLogsWindowId, focusWindow]);

  const canFocusWindow = useCallback(
    (windowId: string): boolean => {
      if (windowId === filesWindowId) return filesWindowOpen;
      if (windowId === editorWindowId) return editorWindowOpen;
      if (windowId === sourceControlWindowId) return sourceControlWindowOpen;
      if (windowId === devServersWindowId) return devServersWindowOpen;
      if (windowId === notesWindowId) return notesWindowOpen;
      if (windowId === kanbanWindowId) return kanbanWindowOpen;
      if (windowId === apiClientWindowId) return apiClientWindowOpen;
      if (windowId === databaseWindowId) return databaseWindowOpen;
      if (windowId === designWindowId) return designWindowOpen;
      if (windowId === activityLogsWindowId) return activityLogsWindowOpen;
      return (
        agentSessions.some(
          (s) =>
            s.id === windowId && s.desktopId === desktopId && s.status !== 'terminated'
        ) || browserSessions.some((b) => b.id === windowId && b.desktopId === desktopId)
      );
    },
    [
      agentSessions,
      browserSessions,
      desktopId,
      devServersWindowId,
      devServersWindowOpen,
      editorWindowId,
      editorWindowOpen,
      filesWindowId,
      filesWindowOpen,
      kanbanWindowId,
      kanbanWindowOpen,
      notesWindowId,
      notesWindowOpen,
      sourceControlWindowId,
      sourceControlWindowOpen,
      apiClientWindowId,
      apiClientWindowOpen,
      databaseWindowId,
      databaseWindowOpen,
      designWindowId,
      designWindowOpen,
      activityLogsWindowId,
      activityLogsWindowOpen
    ]
  );

  useEffect(() => {
    if (!focusSessionId) return;
    if (canFocusWindow(focusSessionId)) {
      focusWindow(focusSessionId);
      onFocusSessionHandled();
    }
  }, [
    focusSessionId,
    canFocusWindow,
    focusWindow,
    onFocusSessionHandled,
    filesWindowOpen,
    editorWindowOpen,
    sourceControlWindowOpen,
    devServersWindowOpen,
    notesWindowOpen,
    kanbanWindowOpen,
    apiClientWindowOpen,
    databaseWindowOpen,
    designWindowOpen,
    activityLogsWindowOpen,
    agentSessions,
    browserSessions
  ]);

  useEffect(() => {
    const onWindowAction = (event: Event) => {
      const detail = (event as CustomEvent<{ windowId: string; action: string }>).detail;
      if (!detail?.windowId || detail.action !== 'minimize') return;
      setLayouts((prev) => {
        const win = prev[detail.windowId];
        if (!win) return prev;
        const updated: WindowLayout = { ...win, state: 'minimized', updatedAt: Date.now() };
        window.agenticApi?.saveWindowLayout(updated);
        onMinimizedChange(detail.windowId, true);
        return { ...prev, [detail.windowId]: updated };
      });
    };
    window.addEventListener('agentic:window-action', onWindowAction);
    return () => window.removeEventListener('agentic:window-action', onWindowAction);
  }, [onMinimizedChange]);

  useEffect(() => {
    onActiveWindowChange?.(
      resolveActiveWindow({
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
      })
    );
  }, [
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
    activityLogsWindowOpen,
    onActiveWindowChange
  ]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full overflow-hidden"
      onContextMenu={(e) => {
        if (
          (e.target as HTMLElement).closest('[data-agent-window]') ||
          (e.target as HTMLElement).closest('[data-browser-window]') ||
          (e.target as HTMLElement).closest('[data-files-window]') ||
          (e.target as HTMLElement).closest('[data-editor-window]') ||
          (e.target as HTMLElement).closest('[data-source-control-window]') ||
          (e.target as HTMLElement).closest('[data-dev-servers-window]') ||
          (e.target as HTMLElement).closest('[data-notes-window]') ||
          (e.target as HTMLElement).closest('[data-kanban-window]') ||
          (e.target as HTMLElement).closest('[data-api-client-window]') ||
          (e.target as HTMLElement).closest('[data-database-window]') ||
          (e.target as HTMLElement).closest('[data-design-window]')
        ) {
          return;
        }
        e.preventDefault();
        onDesktopContextMenu(e.clientX, e.clientY);
      }}
    >
      {desktopSessions.map((session) => {
        const layout = layouts[session.id] || {
          x: 64,
          y: 32,
          width: 720,
          height: 480,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') {
          return null; // Minimized window rendered as icon in the dock
        }

        const isFocused = focusedWindowId === session.id;

        return (
          <div
            key={session.id}
            data-agent-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(session.id)}
          >
            {/* Draggable header trigger overlay */}
            <div
              onMouseDown={(e) => handleStartDrag(e, session.id, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />

            <AgentTerminalWindow
              session={session}
              queue={queues[session.id] || []}
              isFocused={isFocused}
              onFocus={() => bringToFront(session.id)}
              onMinimize={() => handleMinimize(session.id)}
              onClose={() => onTerminateAgent(session.id)}
              onRename={(newName) => onRenameAgent(session.id, newName)}
              onInterrupt={() => onInterruptAgent(session.id)}
              onCancelInstruction={onCancelInstruction}
              onEditInstruction={onEditInstruction}
            />

            {/* Resize handle in bottom-right corner */}
            <div
              onMouseDown={(e) =>
                handleStartResize(e, session.id, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })}

      {desktopBrowsers.map((browser) => {
        const layout = layouts[browser.id] || {
          x: 120,
          y: 48,
          width: 960,
          height: 600,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === browser.id;

        return (
          <div
            key={browser.id}
            data-browser-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(browser.id)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, browser.id, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <BrowserAppWindow
              session={browser}
              isFocused={isFocused}
              onFocus={() => bringToFront(browser.id)}
              onMinimize={() => handleMinimize(browser.id)}
              onClose={() => onCloseBrowser(browser.id)}
              onUrlChange={onBrowserUrlChange}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, browser.id, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })}

      {filesWindowOpen && (() => {
        const layout = layouts[filesWindowId] || {
          x: 96,
          y: 64,
          width: 640,
          height: 480,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === filesWindowId;

        return (
          <div
            key={filesWindowId}
            data-files-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(filesWindowId)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, filesWindowId, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <FilesAppWindow
              workspaceId={workspaceId}
              repoPaths={repoPaths}
              isFocused={isFocused}
              onFocus={() => bringToFront(filesWindowId)}
              onMinimize={() => handleMinimize(filesWindowId)}
              onClose={onCloseFiles}
              onOpenInEditor={onOpenInEditor}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, filesWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {editorWindowOpen && (() => {
        const layout = layouts[editorWindowId] || {
          x: 128,
          y: 80,
          width: 880,
          height: 560,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === editorWindowId;

        return (
          <div
            key={editorWindowId}
            data-editor-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(editorWindowId)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, editorWindowId, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <EditorAppWindow
              workspaceId={workspaceId}
              initialFilePath={editorPendingFile}
              isFocused={isFocused}
              onFocus={() => bringToFront(editorWindowId)}
              onMinimize={() => handleMinimize(editorWindowId)}
              onClose={onCloseEditor}
              onPendingFileHandled={onEditorPendingHandled}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, editorWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {sourceControlWindowOpen && (() => {
        const layout = layouts[sourceControlWindowId] || {
          x: 112,
          y: 72,
          width: 800,
          height: 520,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === sourceControlWindowId;

        return (
          <div
            key={sourceControlWindowId}
            data-source-control-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(sourceControlWindowId)}
          >
            <div
              onMouseDown={(e) =>
                handleStartDrag(e, sourceControlWindowId, layout.x, layout.y)
              }
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <SourceControlAppWindow
              workspaceId={workspaceId}
              repoPaths={repoPaths}
              isFocused={isFocused}
              onFocus={() => bringToFront(sourceControlWindowId)}
              onMinimize={() => handleMinimize(sourceControlWindowId)}
              onClose={onCloseSourceControl}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, sourceControlWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {devServersWindowOpen && (() => {
        const layout = layouts[devServersWindowId] || {
          x: 104,
          y: 68,
          width: 820,
          height: 540,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === devServersWindowId;

        return (
          <div
            key={devServersWindowId}
            data-dev-servers-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(devServersWindowId)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, devServersWindowId, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <DevServersAppWindow
              desktopId={desktopId}
              workspaceId={workspaceId}
              repoPaths={repoPaths}
              isFocused={isFocused}
              onFocus={() => bringToFront(devServersWindowId)}
              onMinimize={() => handleMinimize(devServersWindowId)}
              onClose={onCloseDevServers}
              onOpenUrl={(url) => onOpenBrowser(url)}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, devServersWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {notesWindowOpen && (() => {
        const layout = layouts[notesWindowId] || {
          x: 100,
          y: 60,
          width: 760,
          height: 500,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === notesWindowId;

        return (
          <div
            key={notesWindowId}
            data-notes-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(notesWindowId)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, notesWindowId, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <NotesAppWindow
              workspaceId={workspaceId}
              desktopId={desktopId}
              isFocused={isFocused}
              onFocus={() => bringToFront(notesWindowId)}
              onMinimize={() => handleMinimize(notesWindowId)}
              onClose={onCloseNotes}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, notesWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {kanbanWindowOpen && (() => {
        const layout = layouts[kanbanWindowId] || {
          x: 92,
          y: 56,
          width: 860,
          height: 520,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === kanbanWindowId;

        return (
          <div
            key={kanbanWindowId}
            data-kanban-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(kanbanWindowId)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, kanbanWindowId, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <KanbanAppWindow
              workspaceId={workspaceId}
              desktopId={desktopId}
              agentSessions={agentSessions}
              isFocused={isFocused}
              onFocus={() => bringToFront(kanbanWindowId)}
              onMinimize={() => handleMinimize(kanbanWindowId)}
              onClose={onCloseKanban}
              onFocusAgent={onFocusAgent}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, kanbanWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {apiClientWindowOpen && (() => {
        const layout = layouts[apiClientWindowId] || {
          x: 96,
          y: 52,
          width: 900,
          height: 560,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === apiClientWindowId;

        return (
          <div
            key={apiClientWindowId}
            data-api-client-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(apiClientWindowId)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, apiClientWindowId, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <ApiClientAppWindow
              workspaceId={workspaceId}
              desktopId={desktopId}
              isFocused={isFocused}
              onFocus={() => bringToFront(apiClientWindowId)}
              onMinimize={() => handleMinimize(apiClientWindowId)}
              onClose={onCloseApiClient}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, apiClientWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {databaseWindowOpen && (() => {
        const layout = layouts[databaseWindowId] || {
          x: 104,
          y: 60,
          width: 920,
          height: 560,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === databaseWindowId;

        return (
          <div
            key={databaseWindowId}
            data-database-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(databaseWindowId)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, databaseWindowId, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <DatabaseExplorerAppWindow
              workspaceId={workspaceId}
              desktopId={desktopId}
              isFocused={isFocused}
              onFocus={() => bringToFront(databaseWindowId)}
              onMinimize={() => handleMinimize(databaseWindowId)}
              onClose={onCloseDatabase}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, databaseWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {designWindowOpen && (() => {
        const layout = layouts[designWindowId] || {
          x: 112,
          y: 68,
          width: 940,
          height: 580,
          state: 'normal',
          zIndex: 1
        };

        if (layout.state === 'minimized') return null;

        const isFocused = focusedWindowId === designWindowId;

        return (
          <div
            key={designWindowId}
            data-design-window
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(designWindowId)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, designWindowId, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <DesignAssetsAppWindow
              workspaceId={workspaceId}
              desktopId={desktopId}
              isFocused={isFocused}
              onFocus={() => bringToFront(designWindowId)}
              onMinimize={() => handleMinimize(designWindowId)}
              onClose={onCloseDesign}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, designWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {/* Activity & Logs Window */}
      {activityLogsWindowOpen && (() => {
        const layout = layouts[activityLogsWindowId];
        if (!layout || layout.state === 'minimized') return null;
        const isFocused = focusedWindowId === activityLogsWindowId;

        return (
          <div
            key={activityLogsWindowId}
            style={{
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              zIndex: layout.zIndex
            }}
            className="absolute top-0 left-0 transition-transform duration-75"
            onMouseDown={() => bringToFront(activityLogsWindowId)}
          >
            <div
              onMouseDown={(e) => handleStartDrag(e, activityLogsWindowId, layout.x, layout.y)}
              className="absolute top-0 left-0 right-0 h-10 z-10"
            />
            <ActivityLogsAppWindow
              workspaceId={workspaceId}
              desktopId={desktopId}
              isFocused={isFocused}
              onFocus={() => bringToFront(activityLogsWindowId)}
              onMinimize={() => handleMinimize(activityLogsWindowId)}
              onClose={onCloseActivityLogs}
              onFocusAgent={onFocusAgent}
            />
            <div
              onMouseDown={(e) =>
                handleStartResize(e, activityLogsWindowId, layout.width, layout.height)
              }
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-20 hover:bg-primary/40 rounded-br-xl transition"
            />
          </div>
        );
      })()}

      {desktopSessions.length === 0 &&
        desktopBrowsers.length === 0 &&
        !filesWindowOpen &&
        !editorWindowOpen &&
        !sourceControlWindowOpen &&
        !devServersWindowOpen &&
        !notesWindowOpen &&
        !kanbanWindowOpen &&
        !apiClientWindowOpen &&
        !databaseWindowOpen &&
        !designWindowOpen &&
        !activityLogsWindowOpen && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full">
            <div className="w-12 h-12 rounded-2xl glass-chip flex items-center justify-center mb-3 mx-auto">
              <span className="text-xl">🤖</span>
            </div>
            <h3 className="text-sm font-semibold text-[var(--glass-text)]">Desktop is empty</h3>
            <p className="text-xs text-[var(--glass-text-muted)] mt-1 mb-4">
              Open an app or type a prompt below to launch an agent.
            </p>

            {!engineConnected && (
              <p className="text-xs text-[var(--banner-error-text)] bg-[var(--banner-error-bg)] border border-[var(--banner-error-border)] rounded-lg px-3 py-2 mb-4">
                Engine is still starting or unavailable. The prompt bar and apps will work once it connects.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: 'Files', icon: FolderOpen, action: onOpenFiles },
                { label: 'Editor', icon: Code2, action: onOpenEditor },
                { label: 'Git', icon: GitBranch, action: onOpenSourceControl },
                { label: 'Servers', icon: Server, action: onOpenDevServers },
                { label: 'Notes', icon: FileText, action: onOpenNotes },
                { label: 'Kanban', icon: Columns3, action: onOpenKanban },
                { label: 'API Client', icon: Send, action: onOpenApiClient },
                { label: 'Database', icon: Database, action: onOpenDatabase },
                { label: 'Design', icon: Palette, action: onOpenDesign },
                { label: 'Activity', icon: Activity, action: onOpenActivityLogs },
                { label: 'Browser', icon: Globe2, action: () => onOpenBrowser() }
              ].map(({ label, icon: Icon, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl glass-chip text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition"
                >
                  <Icon className="w-4 h-4 text-primary" />
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onFocusPrompt}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl glass-chip-active text-xs text-[var(--glass-text)]"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Focus prompt — try &ldquo;open files&rdquo; or &ldquo;Hey Stark, run tests&rdquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

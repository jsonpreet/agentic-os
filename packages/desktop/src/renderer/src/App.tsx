import React, { useState, useEffect, useCallback } from 'react';
import {
  Workspace,
  Desktop,
  AgentSession,
  AgentInstruction,
  DiscoveredCLI,
  AgentProvider,
  BrowserSession,
  PromptRouteResult
} from '@agentic/shared-contracts';
import { useAgentSpeech } from './lib/speech/use-agent-speech.js';
import { speakRouteConfirmation } from './lib/speech/route-feedback.js';
import { handleBrowserCommand } from './lib/browser-executor.js';
import { FloatingDock } from './components/dock/FloatingDock.js';
import { WindowManager } from './components/windowing/WindowManager.js';
import { SettingsModal } from './components/modals/SettingsModal.js';
import { NewWorkspaceModal } from './components/modals/NewWorkspaceModal.js';
import { CommandPalette } from './components/modals/CommandPalette.js';
import { TargetPickerModal } from './components/modals/TargetPickerModal.js';
import { Loader2, AlertCircle, FolderPlus, RefreshCw } from 'lucide-react';
import { WallpaperLayer } from './components/desktop/WallpaperLayer.js';
import { DesktopContextMenu } from './components/desktop/DesktopContextMenu.js';
import { EngineStatusBanner } from './components/desktop/EngineStatusBanner.js';
import { MacMenuBar } from './components/menubar/MacMenuBar.js';
import { DesktopWidgets } from './components/widgets/DesktopWidgets.js';
import { ExtensionWidgets } from './components/widgets/ExtensionWidgets.js';
import type { SettingsTab } from './components/modals/SettingsModal.js';
import {
  WallpaperSelection,
  getWallpaperForDesktop,
  setWallpaperForDesktop
} from './lib/wallpaper.js';
import { getFilesWindowId } from './lib/files-window.js';
import { getEditorWindowId } from './lib/editor-window.js';
import { getSourceControlWindowId } from './lib/source-control-window.js';
import { getDevServersWindowId } from './lib/dev-servers-window.js';
import { getNotesWindowId } from './lib/notes-window.js';
import { getKanbanWindowId } from './lib/kanban-window.js';
import { getApiClientWindowId } from './lib/api-client-window.js';
import { getDatabaseWindowId } from './lib/database-window.js';
import { getDesignWindowId } from './lib/design-window.js';
import { getActivityLogsWindowId } from './lib/activity-logs-window.js';
import {
  ActiveWindowInfo,
  workspaceIndexForShortcut
} from './lib/active-window.js';
import { applyWallpaperTone, getWallpaperTone } from './lib/wallpaper-tone.js';
import { bootstrapWorkspace } from './lib/workspace-bootstrap.js';
import {
  UiThemePreference,
  applyUiTheme,
  getUiThemePreference,
  setUiThemePreference,
  watchSystemTheme
} from './lib/ui-theme.js';

export const App: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [desktops, setDesktops] = useState<Desktop[]>([]);
  const [activeDesktopId, setActiveDesktopId] = useState<string | null>(null);
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([]);
  const [queues, setQueues] = useState<Record<string, AgentInstruction[]>>({});
  const [discoveredCLIs, setDiscoveredCLIs] = useState<DiscoveredCLI[]>([]);
  const [browserSessions, setBrowserSessions] = useState<BrowserSession[]>([]);
  const [filesOpenDesktops, setFilesOpenDesktops] = useState<Set<string>>(new Set());
  const [editorOpenDesktops, setEditorOpenDesktops] = useState<Set<string>>(new Set());
  const [editorPendingFile, setEditorPendingFile] = useState<Record<string, string>>({});
  const [sourceControlOpenDesktops, setSourceControlOpenDesktops] = useState<Set<string>>(
    new Set()
  );
  const [devServersOpenDesktops, setDevServersOpenDesktops] = useState<Set<string>>(new Set());
  const [notesOpenDesktops, setNotesOpenDesktops] = useState<Set<string>>(new Set());
  const [kanbanOpenDesktops, setKanbanOpenDesktops] = useState<Set<string>>(new Set());
  const [apiClientOpenDesktops, setApiClientOpenDesktops] = useState<Set<string>>(new Set());
  const [databaseOpenDesktops, setDatabaseOpenDesktops] = useState<Set<string>>(new Set());
  const [designOpenDesktops, setDesignOpenDesktops] = useState<Set<string>>(new Set());
  const [activityLogsOpenDesktops, setActivityLogsOpenDesktops] = useState<Set<string>>(new Set());

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewWorkspaceOpen, setIsNewWorkspaceOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [targetPicker, setTargetPicker] = useState<{
    draft: string;
    suggestedName?: string;
    message?: string;
  } | null>(null);
  const [wallpaper, setWallpaper] = useState<WallpaperSelection>(
    getWallpaperForDesktop(null)
  );
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null);
  const [minimizedSessionIds, setMinimizedSessionIds] = useState<Set<string>>(new Set());
  const [dockFocusToken, setDockFocusToken] = useState(0);
  const { registerAddressedSession } = useAgentSpeech(agentSessions);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance');
  const [desktopContextMenu, setDesktopContextMenu] = useState<{ x: number; y: number } | null>(
    null
  );
  const [engineConnected, setEngineConnected] = useState(true);
  const [engineLoading, setEngineLoading] = useState(true);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetryConnection = useCallback(() => {
    setEngineError(null);
    setEngineLoading(true);
    setRetryCount((prev) => prev + 1);
  }, []);
  const [activeWindow, setActiveWindow] = useState<ActiveWindowInfo>({
    id: 'desktop',
    kind: 'desktop',
    title: 'Agentic'
  });
  const [themePreference, setThemePreference] = useState<UiThemePreference>(getUiThemePreference);
  // Load wallpaper when active desktop changes
  useEffect(() => {
    setWallpaper(getWallpaperForDesktop(activeDesktopId));
  }, [activeDesktopId]);

  useEffect(() => {
    applyWallpaperTone(getWallpaperTone(wallpaper));
  }, [wallpaper]);

  useEffect(() => {
    applyUiTheme(themePreference);
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== 'system') return;
    return watchSystemTheme(() => applyUiTheme('system'));
  }, [themePreference]);

  const handleThemePreferenceChange = (preference: UiThemePreference) => {
    setThemePreference(preference);
    setUiThemePreference(preference);
  };

  const loadBrowserSessions = useCallback(async (desktopId: string) => {
    if (!window.agenticApi) return;
    const sessions = await window.agenticApi.getBrowserSessions(desktopId);
    setBrowserSessions(sessions);
  }, []);

  useEffect(() => {
    if (!activeDesktopId) {
      setBrowserSessions([]);
      return;
    }
    loadBrowserSessions(activeDesktopId);
  }, [activeDesktopId, loadBrowserSessions]);

  useEffect(() => {
    if (!window.agenticApi) return;
    const unsub = window.agenticApi.onBrowserCommand((event) => {
      handleBrowserCommand(event);
    });
    return unsub;
  }, []);

  const handleWallpaperChange = (selection: WallpaperSelection) => {
    setWallpaper(selection);
    if (activeDesktopId) {
      setWallpaperForDesktop(activeDesktopId, selection);
    }
  };

  const activeDesktop = desktops.find((d) => d.id === activeDesktopId) ?? null;
  const resolvedDesktopId = activeDesktopId ?? desktops[0]?.id ?? null;

  // Initialize workspaces and CLIs
  useEffect(() => {
    if (!window.agenticApi) {
      setEngineLoading(false);
      setEngineConnected(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      setEngineLoading(true);
      const started = Date.now();

      while (!cancelled) {
        try {
          const wsList = await window.agenticApi.getWorkspaces();
          if (cancelled) return;
          setEngineConnected(true);
          setEngineError(null);
          setWorkspaces(wsList);
          if (wsList.length > 0) {
            setActiveWorkspaceId((current) => current ?? wsList[0].id);
          }
          const clis = await window.agenticApi.getDiscoveredCLIs();
          if (!cancelled) setDiscoveredCLIs(clis);
          setEngineLoading(false);
          return;
        } catch (err) {
          if (cancelled) return;
          const message = err instanceof Error ? err.message : String(err);
          setEngineError(message);
          setEngineConnected(false);
          if (Date.now() - started > 60_000) {
            setEngineLoading(false);
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
        }
      }
    };

    init();

    // Event listeners
    const unsubStatus = window.agenticApi.onAgentStatus((event) => {
      setAgentSessions((prev) =>
        prev.map((s) => (s.id === event.sessionId ? { ...s, status: event.status } : s))
      );
    });

    const unsubQueue = window.agenticApi.onQueueUpdated((event) => {
      setQueues((prev) => ({
        ...prev,
        [event.sessionId]: event.queue
      }));
    });

    return () => {
      cancelled = true;
      unsubStatus();
      unsubQueue();
    };
  }, [retryCount]);

  // When active workspace changes, bootstrap desktops and load sessions
  useEffect(() => {
    if (!activeWorkspaceId || !window.agenticApi) return;

    let cancelled = false;

    const loadWorkspaceData = async () => {
      const ws = workspaces.find((w) => w.id === activeWorkspaceId);
      const boot = await bootstrapWorkspace(activeWorkspaceId, ws ?? null);
      if (cancelled || !boot) return;

      setDesktops(boot.desktops);
      setActiveDesktopId(boot.activeDesktopId);

      const sessions = await window.agenticApi.getAgentSessions(activeWorkspaceId);
      if (cancelled) return;
      setAgentSessions(sessions);

      const queueMap: Record<string, AgentInstruction[]> = {};
      for (const s of sessions) {
        const q = await window.agenticApi.getAgentQueue(s.id);
        queueMap[s.id] = q;
      }
      if (!cancelled) setQueues(queueMap);
    };

    loadWorkspaceData();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const wsId = workspaceIndexForShortcut(workspaces, Number(e.key) - 1);
        if (wsId) {
          e.preventDefault();
          setActiveWorkspaceId(wsId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaces]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  const ensureActiveDesktop = useCallback(async (): Promise<string | null> => {
    if (activeDesktopId) return activeDesktopId;
    const fallback = desktops[0]?.id ?? null;
    if (fallback) {
      setActiveDesktopId(fallback);
      return fallback;
    }
    if (!activeWorkspaceId) return null;

    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    const boot = await bootstrapWorkspace(activeWorkspaceId, ws ?? null);
    if (!boot) return null;

    setDesktops(boot.desktops);
    setActiveDesktopId(boot.activeDesktopId);
    return boot.activeDesktopId;
  }, [activeDesktopId, activeWorkspaceId, desktops, workspaces]);

  const refreshSessionsAndQueues = async (workspaceId: string) => {
    if (!window.agenticApi) return;

    const sessions = await window.agenticApi.getAgentSessions(workspaceId);
    setAgentSessions(sessions);

    const queueMap: Record<string, AgentInstruction[]> = {};
    for (const s of sessions) {
      const q = await window.agenticApi.getAgentQueue(s.id);
      queueMap[s.id] = q;
    }
    setQueues(queueMap);
  };

  const handleSelectWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
  };

  const handleSelectDesktop = (desktopId: string) => {
    setActiveDesktopId(desktopId);
    setMinimizedSessionIds(new Set());
    if (activeWorkspaceId && window.agenticApi) {
      window.agenticApi.updateWorkspace(activeWorkspaceId, { activeDesktopId: desktopId });
    }
  };

  const handleMinimizedChange = useCallback((sessionId: string, minimized: boolean) => {
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      if (minimized) next.add(sessionId);
      else next.delete(sessionId);
      return next;
    });
  }, []);

  const handleSelectAgentWindow = (sessionId: string) => {
    const agent = agentSessions.find((s) => s.id === sessionId);
    if (agent && agent.desktopId !== activeDesktopId) {
      handleSelectDesktop(agent.desktopId);
    }
    setFocusSessionId(sessionId);
  };

  const openSettings = (tab: SettingsTab = 'cli') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const handleOpenBrowser = async (url?: string) => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId || !window.agenticApi) {
      alert('Select a desktop before opening the browser.');
      return;
    }
    try {
      const session = await window.agenticApi.createBrowserSession(desktopId, url);
      setBrowserSessions((prev) => [...prev, session]);
      setFocusSessionId(session.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open browser';
      alert(message);
    }
  };

  const handleOpenFiles = async () => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening Files.');
      return;
    }
    setFilesOpenDesktops((prev) => new Set(prev).add(desktopId));
    setFocusSessionId(getFilesWindowId(desktopId));
  };

  const handleCloseFiles = () => {
    if (!activeDesktopId) return;
    setFilesOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getFilesWindowId(activeDesktopId));
      return next;
    });
  };

  const handleOpenEditor = async (filePath?: string) => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening the editor.');
      return;
    }
    setEditorOpenDesktops((prev) => new Set(prev).add(desktopId));
    if (filePath) {
      setEditorPendingFile((prev) => ({ ...prev, [desktopId]: filePath }));
    }
    setFocusSessionId(getEditorWindowId(desktopId));
  };

  const handleCloseEditor = () => {
    if (!activeDesktopId) return;
    setEditorOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setEditorPendingFile((prev) => {
      const next = { ...prev };
      delete next[activeDesktopId];
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getEditorWindowId(activeDesktopId));
      return next;
    });
  };

  const handleEditorPendingHandled = (desktopId: string) => {
    setEditorPendingFile((prev) => {
      if (!prev[desktopId]) return prev;
      const next = { ...prev };
      delete next[desktopId];
      return next;
    });
  };

  const handleOpenSourceControl = async () => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening Source Control.');
      return;
    }
    setSourceControlOpenDesktops((prev) => new Set(prev).add(desktopId));
    setFocusSessionId(getSourceControlWindowId(desktopId));
  };

  const handleCloseSourceControl = () => {
    if (!activeDesktopId) return;
    setSourceControlOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getSourceControlWindowId(activeDesktopId));
      return next;
    });
  };

  const handleOpenDevServers = async () => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening Dev Servers.');
      return;
    }
    setDevServersOpenDesktops((prev) => new Set(prev).add(desktopId));
    setFocusSessionId(getDevServersWindowId(desktopId));
  };

  const handleCloseDevServers = () => {
    if (!activeDesktopId) return;
    setDevServersOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getDevServersWindowId(activeDesktopId));
      return next;
    });
  };

  const handleOpenNotes = async () => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening Notes.');
      return;
    }
    setNotesOpenDesktops((prev) => new Set(prev).add(desktopId));
    setFocusSessionId(getNotesWindowId(desktopId));
  };

  const handleCloseNotes = () => {
    if (!activeDesktopId) return;
    setNotesOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getNotesWindowId(activeDesktopId));
      return next;
    });
  };

  const handleOpenKanban = async () => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening Kanban.');
      return;
    }
    setKanbanOpenDesktops((prev) => new Set(prev).add(desktopId));
    setFocusSessionId(getKanbanWindowId(desktopId));
  };

  const handleCloseKanban = () => {
    if (!activeDesktopId) return;
    setKanbanOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getKanbanWindowId(activeDesktopId));
      return next;
    });
  };

  const handleOpenApiClient = async () => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening API Client.');
      return;
    }
    setApiClientOpenDesktops((prev) => new Set(prev).add(desktopId));
    setFocusSessionId(getApiClientWindowId(desktopId));
  };

  const handleCloseApiClient = () => {
    if (!activeDesktopId) return;
    setApiClientOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getApiClientWindowId(activeDesktopId));
      return next;
    });
  };

  const handleOpenDatabase = async () => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening Database Explorer.');
      return;
    }
    setDatabaseOpenDesktops((prev) => new Set(prev).add(desktopId));
    setFocusSessionId(getDatabaseWindowId(desktopId));
  };

  const handleCloseDatabase = () => {
    if (!activeDesktopId) return;
    setDatabaseOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getDatabaseWindowId(activeDesktopId));
      return next;
    });
  };

  const handleOpenDesign = async () => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening Design & Assets.');
      return;
    }
    setDesignOpenDesktops((prev) => new Set(prev).add(desktopId));
    setFocusSessionId(getDesignWindowId(desktopId));
  };

  const handleCloseDesign = () => {
    if (!activeDesktopId) return;
    setDesignOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getDesignWindowId(activeDesktopId));
      return next;
    });
  };

  const handleOpenActivityLogs = async () => {
    const desktopId = await ensureActiveDesktop();
    if (!desktopId) {
      alert('Select a desktop before opening Activity & Logs.');
      return;
    }
    setActivityLogsOpenDesktops((prev) => new Set(prev).add(desktopId));
    setFocusSessionId(getActivityLogsWindowId(desktopId));
  };

  const handleCloseActivityLogs = () => {
    if (!activeDesktopId) return;
    setActivityLogsOpenDesktops((prev) => {
      const next = new Set(prev);
      next.delete(activeDesktopId);
      return next;
    });
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(getActivityLogsWindowId(activeDesktopId));
      return next;
    });
  };

  const handleCloseBrowser = async (sessionId: string) => {
    if (!window.agenticApi) return;
    await window.agenticApi.closeBrowserSession(sessionId);
    setBrowserSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setMinimizedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
  };

  const handleBrowserUrlChange = async (sessionId: string, url: string, title?: string) => {
    if (!window.agenticApi) return;
    const updated = await window.agenticApi.updateBrowserSession(sessionId, { url, title });
    setBrowserSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
  };

  const handleCreateWorkspace = async (name: string, repoPath?: string) => {
    if (!window.agenticApi) return;
    const newWs = await window.agenticApi.createWorkspace({
      name,
      repositories: repoPath ? [repoPath] : []
    });
    setWorkspaces((prev) => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
  };

  const handleCreateDesktop = async () => {
    if (!activeWorkspaceId || !window.agenticApi) return;
    const name = prompt('Enter desktop name:');
    if (!name?.trim()) return;

    const newDesktop = await window.agenticApi.createDesktop({
      workspaceId: activeWorkspaceId,
      name: name.trim()
    });
    setDesktops((prev) => [...prev, newDesktop]);
    setActiveDesktopId(newDesktop.id);
  };

  const handleRenameDesktop = async (desktopId: string, newName: string) => {
    if (!window.agenticApi) return;
    const updated = await window.agenticApi.renameDesktop(desktopId, newName);
    setDesktops((prev) => prev.map((d) => (d.id === desktopId ? updated : d)));
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!window.agenticApi) return;
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (!ws) return;

    const confirmed = confirm(
      `Delete workspace "${ws.name}"? This removes all desktops, agents, and layouts in this workspace.`
    );
    if (!confirmed) return;

    await window.agenticApi.deleteWorkspace(workspaceId);
    const remaining = workspaces.filter((w) => w.id !== workspaceId);
    setWorkspaces(remaining);

    if (activeWorkspaceId === workspaceId) {
      const next = remaining[0];
      setActiveWorkspaceId(next?.id ?? null);
      if (next) {
        const dList = await window.agenticApi.getDesktops(next.id);
        setDesktops(dList);
        setActiveDesktopId(next.activeDesktopId || dList[0]?.id || null);
        await refreshSessionsAndQueues(next.id);
      } else {
        setDesktops([]);
        setActiveDesktopId(null);
        setAgentSessions([]);
        setQueues({});
      }
    }
  };

  const registerSpeechIfAddressed = (result: PromptRouteResult) => {
    if (
      result.sessionId &&
      (result.action === 'sent_to_active' || result.action === 'queued_for_active')
    ) {
      registerAddressedSession({
        sessionId: result.sessionId,
        agentName: result.agentName ?? ''
      });
    }
  };

  const handleSendPrompt = async (
    prompt: string,
    targetSessionId?: string,
    fallbackProvider?: AgentProvider
  ): Promise<boolean> => {
    if (!activeWorkspaceId || !window.agenticApi) return false;

    try {
      const result = await window.agenticApi.sendPrompt({
        workspaceId: activeWorkspaceId,
        prompt,
        targetSessionId,
        fallbackProvider,
        repoPath: activeWorkspace?.repositories[0],
        desktopId: resolvedDesktopId ?? undefined
      });

      if (result.action === 'ambiguous') {
        setTargetPicker({
          draft: prompt,
          suggestedName: result.agentName,
          message: result.message
        });
        return false;
      }

      if (result.action === 'app_command') {
        let handled = false;
        if (result.appCommand === 'switch_desktop' && result.desktopName) {
          const desktop = desktops.find(
            (d) => d.name.toLowerCase() === result.desktopName!.toLowerCase()
          );
          if (desktop) {
            handleSelectDesktop(desktop.id);
            handled = true;
          } else {
            alert(`Desktop "${result.desktopName}" was not found in this workspace.`);
            return false;
          }
        }
        if (result.appCommand === 'open_browser') {
          await handleOpenBrowser(result.browserUrl);
          handled = true;
        }
        if (result.appCommand === 'open_files') {
          handleOpenFiles();
          handled = true;
        }
        if (result.appCommand === 'open_editor') {
          handleOpenEditor();
          handled = true;
        }
        if (result.appCommand === 'open_source_control') {
          handleOpenSourceControl();
          handled = true;
        }
        if (result.appCommand === 'open_dev_servers') {
          handleOpenDevServers();
          handled = true;
        }
        if (result.appCommand === 'open_notes') {
          handleOpenNotes();
          handled = true;
        }
        if (result.appCommand === 'open_kanban') {
          handleOpenKanban();
          handled = true;
        }
        if (result.appCommand === 'open_api_client') {
          handleOpenApiClient();
          handled = true;
        }
        if (result.appCommand === 'open_database') {
          handleOpenDatabase();
          handled = true;
        }
        if (result.appCommand === 'open_design') {
          handleOpenDesign();
          handled = true;
        }
        if (result.appCommand === 'open_activity_logs') {
          handleOpenActivityLogs();
          handled = true;
        }
        if (result.appCommand === 'focus_agent' && result.sessionId) {
          handleSelectAgentWindow(result.sessionId);
          handled = true;
        }
        if (handled) {
          const agent = result.sessionId
            ? agentSessions.find((s) => s.id === result.sessionId)
            : undefined;
          await speakRouteConfirmation(result, agent?.voice);
        }
        return handled;
      }

      registerSpeechIfAddressed(result);
      const routedAgent = result.sessionId
        ? agentSessions.find((s) => s.id === result.sessionId)
        : undefined;
      await speakRouteConfirmation(result, routedAgent?.voice);
      await refreshSessionsAndQueues(activeWorkspaceId);
      if (result.sessionId) {
        handleSelectAgentWindow(result.sessionId);
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send prompt';
      alert(message);
      return false;
    }
  };

  const handleTargetSelect = async (sessionId: string, prompt: string) => {
    setTargetPicker(null);
    await handleSendPrompt(prompt, sessionId);
  };

  const handleSpawnNewAgent = async (prompt: string) => {
    setTargetPicker(null);
    await handleSendPrompt(prompt);
  };

  const handleRenameAgent = async (sessionId: string, newName: string) => {
    if (!window.agenticApi) return;
    await window.agenticApi.renameAgentSession(sessionId, newName);
    setAgentSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, name: newName } : s))
    );
  };

  const handleTerminateAgent = async (sessionId: string) => {
    if (!window.agenticApi) return;
    await window.agenticApi.terminateAgentSession(sessionId);
    setAgentSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status: 'terminated' } : s))
    );
  };

  const handleInterruptAgent = async (sessionId: string) => {
    if (!window.agenticApi) return;
    await window.agenticApi.interruptAgent(sessionId);
  };

  const handleCancelInstruction = async (instructionId: string) => {
    if (!window.agenticApi || !activeWorkspaceId) return;
    await window.agenticApi.cancelInstruction(instructionId);
    await refreshSessionsAndQueues(activeWorkspaceId);
  };

  const handleEditInstruction = async (instructionId: string, newPrompt: string) => {
    if (!window.agenticApi || !activeWorkspaceId) return;
    await window.agenticApi.editInstruction(instructionId, newPrompt);
    await refreshSessionsAndQueues(activeWorkspaceId);
  };

  const handleRescanCLIs = async () => {
    if (!window.agenticApi) return;
    const clis = await window.agenticApi.rescanCLIs();
    setDiscoveredCLIs(clis);
  };

  const handleAgentVoiceChange = async (sessionId: string, voiceId: string | null) => {
    if (!window.agenticApi) return;
    const updated = await window.agenticApi.setAgentVoice(sessionId, voiceId);
    setAgentSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
  };

  const handleSetManualCLIPath = async (
    provider: AgentProvider,
    executablePath: string | null
  ) => {
    if (!window.agenticApi) return;
    try {
      const clis = await window.agenticApi.setManualCLIPath(provider, executablePath);
      setDiscoveredCLIs(clis);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set CLI path';
      alert(message);
    }
  };

  const dispatchWindowAction = (action: string) => {
    window.dispatchEvent(
      new CustomEvent('agentic:window-action', {
        detail: { windowId: activeWindow.id, action }
      })
    );
  };

  const handleCloseActiveWindow = () => {
    switch (activeWindow.kind) {
      case 'agent':
        handleTerminateAgent(activeWindow.id);
        break;
      case 'browser':
        handleCloseBrowser(activeWindow.id);
        break;
      case 'files':
        handleCloseFiles();
        break;
      case 'editor':
        handleCloseEditor();
        break;
      case 'source-control':
        handleCloseSourceControl();
        break;
      case 'dev-servers':
        handleCloseDevServers();
        break;
      case 'notes':
        handleCloseNotes();
        break;
      case 'kanban':
        handleCloseKanban();
        break;
      case 'api-client':
        handleCloseApiClient();
        break;
      case 'database':
        handleCloseDatabase();
        break;
      case 'design':
        handleCloseDesign();
        break;
      default:
        break;
    }
  };

  const handleMenuAction = (actionId: string) => {
    switch (actionId) {
      case 'desktop.new-workspace':
        setIsNewWorkspaceOpen(true);
        break;
      case 'desktop.open-files':
        handleOpenFiles();
        break;
      case 'desktop.open-editor':
        handleOpenEditor();
        break;
      case 'desktop.open-browser':
        handleOpenBrowser();
        break;
      case 'desktop.settings':
        openSettings('appearance');
        break;
      case 'desktop.command-palette':
        setIsSearchOpen(true);
        break;
      case 'agent.interrupt':
        if (activeWindow.kind === 'agent') handleInterruptAgent(activeWindow.id);
        break;
      case 'agent.rename': {
        if (activeWindow.kind !== 'agent') break;
        const agent = agentSessions.find((s) => s.id === activeWindow.id);
        const newName = prompt('Rename agent:', agent?.name ?? '');
        if (newName?.trim()) handleRenameAgent(activeWindow.id, newName.trim());
        break;
      }
      case 'browser.new-tab':
        handleOpenBrowser();
        break;
      case 'files.open-editor':
        handleOpenEditor();
        break;
      case 'editor.save':
        dispatchWindowAction('save');
        break;
      case 'git.refresh':
      case 'dev-servers.refresh':
      case 'notes.new':
      case 'kanban.new-task':
      case 'api-client.new':
      case 'api-client.send':
      case 'database.run':
      case 'design.refresh':
        dispatchWindowAction(actionId.split('.')[1] ?? actionId);
        break;
      case 'window.minimize':
        dispatchWindowAction('minimize');
        break;
      case 'window.close':
        handleCloseActiveWindow();
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative flex flex-col w-screen h-screen overflow-hidden">
      {/* Desktop wallpaper (full bleed behind glass UI) */}
      <WallpaperLayer selection={wallpaper} />

      <MacMenuBar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        activeWindow={activeWindow}
        onSelectWorkspace={handleSelectWorkspace}
        onMenuAction={handleMenuAction}
        onFocusSession={handleSelectAgentWindow}
      />

      <EngineStatusBanner
        engineConnected={engineConnected}
        engineLoading={engineLoading}
        engineError={engineError}
      />

      <div className="relative z-10 flex flex-col h-full pt-[28px]">
      {/* Main canvas — full bleed like CNVS */}
      <main className="flex-1 w-full h-screen relative overflow-hidden bg-transparent pb-20">
        {resolvedDesktopId ? (
          <>
          <DesktopWidgets
            desktopId={resolvedDesktopId}
            workspaceId={activeWorkspaceId ?? ''}
            agentSessions={agentSessions}
            onFocusSession={handleSelectAgentWindow}
            onOpenKanban={handleOpenKanban}
            onOpenDevServers={handleOpenDevServers}
          />
          <ExtensionWidgets
            host={{
              workspaceId: activeWorkspaceId ?? '',
              desktopId: resolvedDesktopId,
              repoPath: activeWorkspace?.repositories[0],
              onLaunchTask: (result) => {
                if (result.sessionId) {
                  handleSelectAgentWindow(result.sessionId);
                }
              }
            }}
          />
          <WindowManager
            desktopId={resolvedDesktopId}
            agentSessions={agentSessions}
            browserSessions={browserSessions}
            queues={queues}
            focusSessionId={focusSessionId}
            onFocusSessionHandled={() => setFocusSessionId(null)}
            onMinimizedChange={handleMinimizedChange}
            onDesktopContextMenu={(x, y) => setDesktopContextMenu({ x, y })}
            onRenameAgent={handleRenameAgent}
            onTerminateAgent={handleTerminateAgent}
            onInterruptAgent={handleInterruptAgent}
            onCancelInstruction={handleCancelInstruction}
            onEditInstruction={handleEditInstruction}
            onCloseBrowser={handleCloseBrowser}
            onBrowserUrlChange={handleBrowserUrlChange}
            workspaceId={activeWorkspaceId ?? ''}
            filesWindowOpen={
              resolvedDesktopId ? filesOpenDesktops.has(resolvedDesktopId) : false
            }
            repoPaths={activeWorkspace?.repositories ?? []}
            onCloseFiles={handleCloseFiles}
            onOpenInEditor={handleOpenEditor}
            editorWindowOpen={
              resolvedDesktopId ? editorOpenDesktops.has(resolvedDesktopId) : false
            }
            editorPendingFile={
              resolvedDesktopId ? editorPendingFile[resolvedDesktopId] ?? null : null
            }
            onCloseEditor={handleCloseEditor}
            onEditorPendingHandled={() => {
              if (resolvedDesktopId) handleEditorPendingHandled(resolvedDesktopId);
            }}
            sourceControlWindowOpen={
              resolvedDesktopId ? sourceControlOpenDesktops.has(resolvedDesktopId) : false
            }
            onCloseSourceControl={handleCloseSourceControl}
            onOpenFiles={handleOpenFiles}
            onOpenEditor={() => handleOpenEditor()}
            onOpenSourceControl={handleOpenSourceControl}
            onOpenDevServers={handleOpenDevServers}
            onOpenBrowser={handleOpenBrowser}
            onFocusPrompt={() => setDockFocusToken((t) => t + 1)}
            engineConnected={engineConnected}
            devServersWindowOpen={
              resolvedDesktopId ? devServersOpenDesktops.has(resolvedDesktopId) : false
            }
            onCloseDevServers={handleCloseDevServers}
            notesWindowOpen={
              resolvedDesktopId ? notesOpenDesktops.has(resolvedDesktopId) : false
            }
            onCloseNotes={handleCloseNotes}
            onOpenNotes={handleOpenNotes}
            kanbanWindowOpen={
              resolvedDesktopId ? kanbanOpenDesktops.has(resolvedDesktopId) : false
            }
            onCloseKanban={handleCloseKanban}
            onOpenKanban={handleOpenKanban}
            apiClientWindowOpen={
              resolvedDesktopId ? apiClientOpenDesktops.has(resolvedDesktopId) : false
            }
            onCloseApiClient={handleCloseApiClient}
            onOpenApiClient={handleOpenApiClient}
            databaseWindowOpen={
              resolvedDesktopId ? databaseOpenDesktops.has(resolvedDesktopId) : false
            }
            onCloseDatabase={handleCloseDatabase}
            onOpenDatabase={handleOpenDatabase}
            designWindowOpen={
              resolvedDesktopId ? designOpenDesktops.has(resolvedDesktopId) : false
            }
            onCloseDesign={handleCloseDesign}
            onOpenDesign={handleOpenDesign}
            activityLogsWindowOpen={
              resolvedDesktopId ? activityLogsOpenDesktops.has(resolvedDesktopId) : false
            }
            onCloseActivityLogs={handleCloseActivityLogs}
            onOpenActivityLogs={handleOpenActivityLogs}
            onFocusAgent={handleSelectAgentWindow}
            onActiveWindowChange={setActiveWindow}
          />
          </>
        ) : engineLoading ? (
          <div className="w-full h-full flex items-center justify-center p-6 select-none">
            <div className="flex flex-col items-center justify-center max-w-sm w-full px-8 py-8 rounded-2xl glass-surface border border-[var(--glass-border)] shadow-2xl backdrop-blur-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="relative flex items-center justify-center">
                {/* Glowing ambient pulse behind spinner */}
                <div className="absolute w-14 h-14 rounded-full bg-[var(--cnvs-accent)] opacity-25 blur-xl animate-pulse" />
                <Loader2 className="w-9 h-9 animate-spin text-[var(--cnvs-accent)] relative z-10" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-[var(--glass-text)] tracking-tight">
                  Loading Workspace
                </h3>
                <p className="text-xs text-[var(--glass-text-muted)] leading-relaxed">
                  Connecting to engine and initializing desktops…
                </p>
              </div>

              {engineError ? (
                <div className="w-full mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-left space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 overflow-hidden">
                      <p className="text-xs font-semibold text-red-400">Connection Delay</p>
                      <p className="text-[11px] text-red-300/85 break-words font-mono line-clamp-3">
                        {engineError}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleRetryConnection}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-200 transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--glass-text-muted)]">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Restoring session state…</span>
                </div>
              )}
            </div>
          </div>
        ) : !resolvedDesktopId ? (
          <div className="w-full h-full flex items-center justify-center p-6 select-none">
            <div className="flex flex-col items-center justify-center max-w-sm w-full px-8 py-8 rounded-2xl glass-surface border border-[var(--glass-border)] shadow-2xl backdrop-blur-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-2xl bg-[var(--glass-selected)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--glass-text)] shadow-inner">
                <FolderPlus className="w-7 h-7 text-[var(--cnvs-accent)]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-[var(--glass-text)] tracking-tight">
                  No Active Workspace
                </h3>
                <p className="text-xs text-[var(--glass-text-muted)] leading-relaxed">
                  {engineConnected
                    ? 'Create or select a workspace to open your virtual desktop.'
                    : 'The local engine is not connected.'}
                </p>
              </div>

              {engineConnected ? (
                <button
                  type="button"
                  onClick={() => setIsNewWorkspaceOpen(true)}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--cnvs-accent)] text-stone-950 hover:opacity-90 shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create Workspace
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRetryConnection}
                  className="px-4 py-2 rounded-xl text-xs font-medium glass-button text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        ) : null}
      </main>

      {/* CNVS-style floating prompt pill */}
      <FloatingDock
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        desktops={desktops}
        activeDesktopId={activeDesktopId}
        engineConnected={engineConnected}
        engineLoading={engineLoading}
        agentSessions={agentSessions}
        discoveredCLIs={discoveredCLIs}
        onSendPrompt={handleSendPrompt}
        onSelectAgentWindow={handleSelectAgentWindow}
        onSelectDesktop={handleSelectDesktop}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={() => setIsNewWorkspaceOpen(true)}
        onOpenSettings={() => openSettings('appearance')}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBrowser={() => handleOpenBrowser()}
        onOpenFiles={handleOpenFiles}
        onOpenEditor={() => handleOpenEditor()}
        onOpenSourceControl={handleOpenSourceControl}
        onOpenDevServers={handleOpenDevServers}
        onOpenNotes={handleOpenNotes}
        onOpenKanban={handleOpenKanban}
        onOpenApiClient={handleOpenApiClient}
        onOpenDatabase={handleOpenDatabase}
        onOpenDesign={handleOpenDesign}
        onOpenActivityLogs={handleOpenActivityLogs}
        minimizedSessionIds={minimizedSessionIds}
        focusToken={dockFocusToken}
      />

      {desktopContextMenu && (
        <DesktopContextMenu
          x={desktopContextMenu.x}
          y={desktopContextMenu.y}
          onClose={() => setDesktopContextMenu(null)}
          onOpenAppearanceSettings={() => openSettings('appearance')}
          onWallpaperChange={handleWallpaperChange}
          currentWallpaper={wallpaper}
        />
      )}

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        discoveredCLIs={discoveredCLIs}
        onRescanCLIs={handleRescanCLIs}
        onSetManualCLIPath={handleSetManualCLIPath}
        wallpaper={wallpaper}
        onWallpaperChange={handleWallpaperChange}
        activeDesktopName={activeDesktop?.name}
        initialTab={settingsTab}
        agentSessions={agentSessions}
        onAgentVoiceChange={handleAgentVoiceChange}
        themePreference={themePreference}
        onThemePreferenceChange={handleThemePreferenceChange}
      />

      <NewWorkspaceModal
        isOpen={isNewWorkspaceOpen}
        onClose={() => setIsNewWorkspaceOpen(false)}
        onCreateWorkspace={handleCreateWorkspace}
      />

      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        workspaces={workspaces}
        desktops={desktops}
        onSelectWorkspace={handleSelectWorkspace}
        onSelectDesktop={handleSelectDesktop}
        onOpenSettings={() => openSettings('cli')}
        onCreateWorkspace={() => setIsNewWorkspaceOpen(true)}
        onOpenFiles={handleOpenFiles}
        onOpenEditor={() => handleOpenEditor()}
        onOpenSourceControl={handleOpenSourceControl}
        onOpenDevServers={handleOpenDevServers}
        onOpenNotes={handleOpenNotes}
        onOpenKanban={handleOpenKanban}
        onOpenApiClient={handleOpenApiClient}
        onOpenDatabase={handleOpenDatabase}
        onOpenDesign={handleOpenDesign}
        onOpenActivityLogs={handleOpenActivityLogs}
        onOpenBrowser={() => handleOpenBrowser()}
      />

      <TargetPickerModal
        isOpen={targetPicker !== null}
        draftPrompt={targetPicker?.draft ?? ''}
        suggestedName={targetPicker?.suggestedName}
        message={targetPicker?.message}
        agentSessions={agentSessions}
        onClose={() => setTargetPicker(null)}
        onSelect={handleTargetSelect}
        onSpawnNew={handleSpawnNewAgent}
      />
      </div>
    </div>
  );
};

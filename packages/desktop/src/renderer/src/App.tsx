import React, { useState, useEffect } from 'react';
import {
  Workspace,
  Desktop,
  AgentSession,
  AgentInstruction,
  DiscoveredCLI,
  AgentProvider
} from '@agentic/shared-contracts';
import { TopHUD } from './components/hud/TopHUD.js';
import { FloatingDock } from './components/dock/FloatingDock.js';
import { WindowManager } from './components/windowing/WindowManager.js';
import { SettingsModal } from './components/modals/SettingsModal.js';
import { NewWorkspaceModal } from './components/modals/NewWorkspaceModal.js';
import { CommandPalette } from './components/modals/CommandPalette.js';

export const App: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [desktops, setDesktops] = useState<Desktop[]>([]);
  const [activeDesktopId, setActiveDesktopId] = useState<string | null>(null);
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([]);
  const [queues, setQueues] = useState<Record<string, AgentInstruction[]>>({});
  const [discoveredCLIs, setDiscoveredCLIs] = useState<DiscoveredCLI[]>([]);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewWorkspaceOpen, setIsNewWorkspaceOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Initialize workspaces and CLIs
  useEffect(() => {
    if (!window.agenticApi) return;

    const init = async () => {
      const wsList = await window.agenticApi.getWorkspaces();
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        const firstWs = wsList[0];
        setActiveWorkspaceId(firstWs.id);

        const dList = await window.agenticApi.getDesktops(firstWs.id);
        setDesktops(dList);
        setActiveDesktopId(firstWs.activeDesktopId || dList[0]?.id || null);

        const sessions = await window.agenticApi.getAgentSessions(firstWs.id);
        setAgentSessions(sessions);
      }

      const clis = await window.agenticApi.getDiscoveredCLIs();
      setDiscoveredCLIs(clis);
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
      unsubStatus();
      unsubQueue();
    };
  }, []);

  // When active workspace changes, load its desktops and sessions
  useEffect(() => {
    if (!activeWorkspaceId || !window.agenticApi) return;

    const loadWorkspaceData = async () => {
      const dList = await window.agenticApi.getDesktops(activeWorkspaceId);
      setDesktops(dList);

      const ws = workspaces.find((w) => w.id === activeWorkspaceId);
      const initialDesktopId =
        ws?.activeDesktopId && dList.some((d) => d.id === ws.activeDesktopId)
          ? ws.activeDesktopId
          : dList[0]?.id || null;

      setActiveDesktopId(initialDesktopId);

      const sessions = await window.agenticApi.getAgentSessions(activeWorkspaceId);
      setAgentSessions(sessions);

      // Load queues for all sessions
      const queueMap: Record<string, AgentInstruction[]> = {};
      for (const s of sessions) {
        const q = await window.agenticApi.getAgentQueue(s.id);
        queueMap[s.id] = q;
      }
      setQueues(queueMap);
    };

    loadWorkspaceData();
  }, [activeWorkspaceId]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  const handleSelectWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
  };

  const handleSelectDesktop = (desktopId: string) => {
    setActiveDesktopId(desktopId);
    if (activeWorkspaceId && window.agenticApi) {
      window.agenticApi.updateWorkspace(activeWorkspaceId, { activeDesktopId: desktopId });
    }
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

  const handleSendPrompt = async (
    prompt: string,
    targetSessionId?: string,
    fallbackProvider?: AgentProvider
  ) => {
    if (!activeWorkspaceId || !window.agenticApi) return;

    await window.agenticApi.sendPrompt({
      workspaceId: activeWorkspaceId,
      prompt,
      targetSessionId,
      fallbackProvider,
      repoPath: activeWorkspace?.repositories[0]
    });

    // Refresh sessions and queues
    const sessions = await window.agenticApi.getAgentSessions(activeWorkspaceId);
    setAgentSessions(sessions);

    const queueMap: Record<string, AgentInstruction[]> = {};
    for (const s of sessions) {
      const q = await window.agenticApi.getAgentQueue(s.id);
      queueMap[s.id] = q;
    }
    setQueues(queueMap);
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

    const sessions = await window.agenticApi.getAgentSessions(activeWorkspaceId);
    const queueMap: Record<string, AgentInstruction[]> = {};
    for (const s of sessions) {
      const q = await window.agenticApi.getAgentQueue(s.id);
      queueMap[s.id] = q;
    }
    setQueues(queueMap);
  };

  const handleRescanCLIs = async () => {
    if (!window.agenticApi) return;
    const clis = await window.agenticApi.rescanCLIs();
    setDiscoveredCLIs(clis);
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-background">
      {/* Top HUD */}
      <TopHUD
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        desktops={desktops}
        activeDesktopId={activeDesktopId}
        agentSessions={agentSessions}
        discoveredCLIs={discoveredCLIs}
        onSelectWorkspace={handleSelectWorkspace}
        onSelectDesktop={handleSelectDesktop}
        onCreateWorkspace={() => setIsNewWorkspaceOpen(true)}
        onCreateDesktop={handleCreateDesktop}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      {/* Main Virtual Desktop viewport */}
      <main className="flex-1 w-full h-[calc(100vh-48px)] relative overflow-hidden">
        {activeDesktopId && (
          <WindowManager
            desktopId={activeDesktopId}
            agentSessions={agentSessions}
            queues={queues}
            onRenameAgent={handleRenameAgent}
            onTerminateAgent={handleTerminateAgent}
            onInterruptAgent={handleInterruptAgent}
            onCancelInstruction={handleCancelInstruction}
          />
        )}
      </main>

      {/* Floating Prompt Dock */}
      <FloatingDock
        agentSessions={agentSessions}
        discoveredCLIs={discoveredCLIs}
        currentRepo={activeWorkspace?.repositories[0]}
        onSendPrompt={handleSendPrompt}
        onSelectAgentWindow={(sessionId) => {
          // Find which desktop this agent belongs to
          const agent = agentSessions.find((s) => s.id === sessionId);
          if (agent && agent.desktopId !== activeDesktopId) {
            handleSelectDesktop(agent.desktopId);
          }
        }}
        onOpenNewAgentWindow={() => {}}
        onSelectRepo={() => setIsNewWorkspaceOpen(true)}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        discoveredCLIs={discoveredCLIs}
        onRescanCLIs={handleRescanCLIs}
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
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCreateWorkspace={() => setIsNewWorkspaceOpen(true)}
      />
    </div>
  );
};

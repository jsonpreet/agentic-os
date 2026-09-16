import React, { useState } from 'react';
import {
  Workspace,
  Desktop,
  AgentSession,
  DiscoveredCLI
} from '@agentic/shared-contracts';
import {
  FolderGit2,
  ChevronDown,
  Plus,
  Search,
  Settings,
  Layers,
  Sparkles,
  Terminal
} from 'lucide-react';

interface TopHUDProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  desktops: Desktop[];
  activeDesktopId: string | null;
  agentSessions: AgentSession[];
  discoveredCLIs: DiscoveredCLI[];
  onSelectWorkspace: (id: string) => void;
  onSelectDesktop: (id: string) => void;
  onCreateWorkspace: () => void;
  onCreateDesktop: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
}

export const TopHUD: React.FC<TopHUDProps> = ({
  workspaces,
  activeWorkspace,
  desktops,
  activeDesktopId,
  agentSessions,
  discoveredCLIs,
  onSelectWorkspace,
  onSelectDesktop,
  onCreateWorkspace,
  onCreateDesktop,
  onOpenSettings,
  onOpenSearch
}) => {
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);

  const activeAgents = agentSessions.filter((s) => s.status !== 'terminated');
  const workingCount = activeAgents.filter((s) => s.status === 'working').length;
  const availableCLICount = discoveredCLIs.filter((c) => c.isAvailable).length;

  return (
    <header className="h-12 w-full bg-surface/70 backdrop-blur-md border-b border-border flex items-center justify-between px-4 z-40 titlebar-drag">
      {/* Left side: traffic light offset + Workspace Selector */}
      <div className="flex items-center space-x-3 pl-16 titlebar-no-drag">
        <div className="relative">
          <button
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-surface-elevated/80 hover:bg-surface-hover border border-white/5 transition text-sm font-medium text-zinc-200"
          >
            <FolderGit2 className="w-4 h-4 text-primary" />
            <span className="truncate max-w-[140px]">
              {activeWorkspace?.name || 'Select Workspace'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {workspaceDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-60 rounded-xl bg-surface-elevated border border-white/10 shadow-2xl p-1.5 z-50">
              <div className="text-[11px] font-semibold text-zinc-400 px-2 py-1 uppercase tracking-wider">
                Workspaces
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      onSelectWorkspace(ws.id);
                      setWorkspaceDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-left transition ${
                      ws.id === activeWorkspace?.id
                        ? 'bg-primary/20 text-primary font-medium'
                        : 'text-zinc-300 hover:bg-surface-hover'
                    }`}
                  >
                    <span className="truncate">{ws.name}</span>
                    <span className="text-xs text-zinc-500 font-mono">
                      {ws.repositories.length} repo{ws.repositories.length === 1 ? '' : 's'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="h-px bg-white/5 my-1" />
              <button
                onClick={() => {
                  setWorkspaceDropdownOpen(false);
                  onCreateWorkspace();
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-sm text-zinc-300 hover:bg-surface-hover transition"
              >
                <Plus className="w-4 h-4 text-zinc-400" />
                <span>New Workspace...</span>
              </button>
            </div>
          )}
        </div>

        {/* Repositories pill */}
        {activeWorkspace && activeWorkspace.repositories.length > 0 && (
          <div className="hidden md:flex items-center space-x-1.5 text-xs text-zinc-400 bg-white/5 px-2.5 py-1 rounded-md border border-white/5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="truncate max-w-[120px]">
              {activeWorkspace.repositories[0].split('/').pop()}
            </span>
          </div>
        )}
      </div>

      {/* Center: Virtual Desktop Switcher */}
      <div className="flex items-center space-x-1 bg-surface-elevated/90 p-1 rounded-xl border border-white/5 titlebar-no-drag">
        {desktops.map((desktop) => {
          const isActive = desktop.id === activeDesktopId;
          return (
            <button
              key={desktop.id}
              onClick={() => onSelectDesktop(desktop.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              {desktop.name}
            </button>
          );
        })}
        <button
          onClick={onCreateDesktop}
          title="Add Desktop"
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right side: Running Agents, CLI status, Command search, Settings */}
      <div className="flex items-center space-x-3 titlebar-no-drag">
        {/* Active Agents Badge */}
        <div className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-surface-elevated/80 border border-white/5 text-xs">
          <span className="relative flex h-2 w-2">
            {workingCount > 0 ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-500" />
            )}
          </span>
          <span className="text-zinc-300 font-medium">
            {activeAgents.length} agent{activeAgents.length === 1 ? '' : 's'}
          </span>
          {workingCount > 0 && (
            <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.2 rounded font-mono">
              {workingCount} working
            </span>
          )}
        </div>

        {/* Discovered CLIs Indicator */}
        <div
          onClick={onOpenSettings}
          title="Detected CLIs"
          className="cursor-pointer hidden lg:flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-surface-elevated/60 hover:bg-surface-hover border border-white/5 text-xs text-zinc-400 transition"
        >
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          <span>{availableCLICount} CLI{availableCLICount === 1 ? '' : 's'}</span>
        </div>

        {/* Global Search trigger */}
        <button
          onClick={onOpenSearch}
          className="flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-surface-elevated/80 hover:bg-surface-hover border border-white/5 text-xs text-zinc-400 transition"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-zinc-400">
            ⌘K
          </kbd>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface-hover border border-white/5 transition"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

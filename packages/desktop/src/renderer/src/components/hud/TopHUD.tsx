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
  Terminal,
  Globe2,
  FolderOpen,
  Code2,
  GitBranch
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
  onRenameDesktop: (desktopId: string, newName: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenBrowser: () => void;
  onOpenFiles: () => void;
  onOpenEditor: () => void;
  onOpenSourceControl: () => void;
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
  onRenameDesktop,
  onDeleteWorkspace,
  onOpenSettings,
  onOpenSearch,
  onOpenBrowser,
  onOpenFiles,
  onOpenEditor,
  onOpenSourceControl
}) => {
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);

  const activeAgents = agentSessions.filter((s) => s.status !== 'terminated');
  const workingCount = activeAgents.filter((s) => s.status === 'working').length;
  const availableCLICount = discoveredCLIs.filter((c) => c.isAvailable).length;

  return (
    <header className="h-12 w-full glass-bar flex items-center justify-between px-4 z-40 titlebar-drag">
      {/* Left side: traffic light offset + Workspace Selector */}
      <div className="flex items-center space-x-3 pl-16 titlebar-no-drag">
        <div className="relative">
          <button
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg glass-chip transition text-sm font-medium text-[var(--glass-text)]"
          >
            <FolderGit2 className="w-4 h-4 text-primary" />
            <span className="truncate max-w-[140px]">
              {activeWorkspace?.name || 'Select Workspace'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--glass-text-muted)]" />
          </button>

          {workspaceDropdownOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-60 rounded-xl glass-popover p-1.5 z-50">
              <div className="text-[11px] font-semibold text-[var(--glass-text-muted)] px-2 py-1 uppercase tracking-wider">
                Workspaces
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className={`flex items-center gap-1 px-1 py-0.5 rounded-lg ${
                      ws.id === activeWorkspace?.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        onSelectWorkspace(ws.id);
                        setWorkspaceDropdownOpen(false);
                      }}
                      className={`flex-1 flex items-center justify-between px-1.5 py-1 rounded-lg text-sm text-left transition ${
                        ws.id === activeWorkspace?.id
                          ? 'text-primary font-medium'
                          : 'text-[var(--glass-text)] hover:bg-surface-hover'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      <span className="text-xs text-[var(--glass-text-muted)] font-mono ml-2">
                        {ws.repositories.length} repo{ws.repositories.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    {workspaces.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteWorkspace(ws.id);
                          setWorkspaceDropdownOpen(false);
                        }}
                        title="Delete workspace"
                        className="p-1 text-[var(--glass-text-muted)] hover:text-red-400 hover:bg-red-400/10 rounded transition text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="h-px bg-[var(--glass-hover)] my-1" />
              <button
                onClick={() => {
                  setWorkspaceDropdownOpen(false);
                  onCreateWorkspace();
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-sm text-[var(--glass-text)] hover:bg-surface-hover transition"
              >
                <Plus className="w-4 h-4 text-[var(--glass-text-muted)]" />
                <span>New Workspace...</span>
              </button>
            </div>
          )}
        </div>

        {/* Repositories pill */}
        {activeWorkspace && activeWorkspace.repositories.length > 0 && (
          <div className="hidden md:flex items-center space-x-1.5 text-xs text-[var(--glass-text-muted)] glass-chip px-2.5 py-1 rounded-md font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="truncate max-w-[120px]">
              {activeWorkspace.repositories[0].split('/').pop()}
            </span>
          </div>
        )}
      </div>

      {/* Center: Virtual Desktop Switcher */}
      <div className="flex items-center space-x-1 glass-chip p-1 rounded-xl titlebar-no-drag">
        {desktops.map((desktop) => {
          const isActive = desktop.id === activeDesktopId;
          return (
            <button
              key={desktop.id}
              onClick={() => onSelectDesktop(desktop.id)}
              onDoubleClick={(e) => {
                e.preventDefault();
                const newName = prompt('Rename desktop:', desktop.name);
                if (newName?.trim() && newName.trim() !== desktop.name) {
                  onRenameDesktop(desktop.id, newName.trim());
                }
              }}
              title="Double-click to rename"
              className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                isActive
                  ? 'glass-chip-active ui-modal-tab-active'
                  : 'text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] hover:bg-[var(--glass-hover)]'
              }`}
            >
              {desktop.name}
            </button>
          );
        })}
        <button
          onClick={onCreateDesktop}
          title="Add Desktop"
          className="p-1 rounded-lg text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right side: Running Agents, CLI status, Command search, Settings */}
      <div className="flex items-center space-x-3 titlebar-no-drag">
        {/* Active Agents Badge */}
        <div className="flex items-center space-x-2 px-2.5 py-1 rounded-lg glass-chip text-xs">
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
          <span className="text-[var(--glass-text)] font-medium">
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
          className="cursor-pointer hidden lg:flex items-center space-x-1.5 px-2 py-1 rounded-lg glass-chip text-xs text-[var(--glass-text-muted)] transition"
        >
          <Terminal className="w-3.5 h-3.5 text-[var(--glass-text-muted)]" />
          <span>{availableCLICount} CLI{availableCLICount === 1 ? '' : 's'}</span>
        </div>

        <button
          onClick={onOpenFiles}
          title="Open Files"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg glass-chip text-xs text-[var(--glass-text-muted)] transition"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Files</span>
        </button>

        <button
          onClick={onOpenEditor}
          title="Open Editor"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg glass-chip text-xs text-[var(--glass-text-muted)] transition"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Editor</span>
        </button>

        <button
          onClick={onOpenSourceControl}
          title="Open Source Control"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg glass-chip text-xs text-[var(--glass-text-muted)] transition"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Git</span>
        </button>

        <button
          onClick={onOpenBrowser}
          title="Open Browser"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg glass-chip text-xs text-[var(--glass-text-muted)] transition"
        >
          <Globe2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Browser</span>
        </button>

        {/* Global Search trigger */}
        <button
          onClick={onOpenSearch}
          className="flex items-center space-x-2 px-2.5 py-1 rounded-lg glass-chip text-xs text-[var(--glass-text-muted)] transition"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="text-[10px] font-mono bg-[var(--glass-hover)] px-1.5 py-0.5 rounded text-[var(--glass-text-muted)]">
            ⌘K
          </kbd>
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-lg text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] glass-chip transition"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

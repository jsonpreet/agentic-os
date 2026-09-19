import React, { useState, useEffect } from 'react';
import { Workspace, Desktop } from '@agentic/shared-contracts';
import {
  Search,
  Monitor,
  FolderGit2,
  Terminal,
  Plus,
  FolderOpen,
  Code2,
  GitBranch,
  Globe2,
  Server,
  FileText,
  Columns3,
  Send,
  Database,
  Palette,
  Activity
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  desktops: Desktop[];
  onSelectWorkspace: (id: string) => void;
  onSelectDesktop: (id: string) => void;
  onOpenSettings: () => void;
  onCreateWorkspace: () => void;
  onOpenFiles: () => void;
  onOpenEditor: () => void;
  onOpenSourceControl: () => void;
  onOpenDevServers: () => void;
  onOpenNotes: () => void;
  onOpenKanban: () => void;
  onOpenApiClient: () => void;
  onOpenDatabase: () => void;
  onOpenDesign: () => void;
  onOpenActivityLogs: () => void;
  onOpenBrowser: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  workspaces,
  desktops,
  onSelectWorkspace,
  onSelectDesktop,
  onOpenSettings,
  onCreateWorkspace,
  onOpenFiles,
  onOpenEditor,
  onOpenSourceControl,
  onOpenDevServers,
  onOpenNotes,
  onOpenKanban,
  onOpenApiClient,
  onOpenDatabase,
  onOpenDesign,
  onOpenActivityLogs,
  onOpenBrowser
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 glass-scrim z-50 flex items-start justify-center pt-24 p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl max-w-lg w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-[var(--glass-border-subtle)] space-x-3">
          <Search className="w-4 h-4 text-[var(--glass-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search desktops..."
            className="flex-1 bg-transparent text-sm text-[var(--glass-text)] placeholder-[var(--glass-text-muted)] focus:outline-none"
            autoFocus
          />
          <kbd className="text-[10px] font-mono bg-[var(--glass-hover)] px-1.5 py-0.5 rounded text-[var(--glass-text-muted)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-1 text-xs">
          <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2 py-1 uppercase tracking-wider">
            Virtual Desktops
          </div>
          {desktops
            .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
            .map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  onSelectDesktop(d.id);
                  onClose();
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-[var(--glass-text)] hover:bg-surface-hover transition text-left"
              >
                <Monitor className="w-4 h-4 text-primary" />
                <span>Switch to <strong>{d.name}</strong> desktop</span>
              </button>
            ))}

          <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2 py-1 uppercase tracking-wider mt-2">
            Workspaces
          </div>
          {workspaces
            .filter((w) => w.name.toLowerCase().includes(query.toLowerCase()))
            .map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  onSelectWorkspace(w.id);
                  onClose();
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-[var(--glass-text)] hover:bg-surface-hover transition text-left"
              >
                <FolderGit2 className="w-4 h-4 text-accent" />
                <span>Open <strong>{w.name}</strong> workspace</span>
              </button>
            ))}

          <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2 py-1 uppercase tracking-wider mt-2">
            Apps
          </div>
          {[
            { label: 'Open Files', icon: FolderOpen, action: onOpenFiles },
            { label: 'Open Editor', icon: Code2, action: onOpenEditor },
            { label: 'Open Source Control', icon: GitBranch, action: onOpenSourceControl },
            { label: 'Open Dev Servers', icon: Server, action: onOpenDevServers },
            { label: 'Open Notes', icon: FileText, action: onOpenNotes },
            { label: 'Open Kanban', icon: Columns3, action: onOpenKanban },
            { label: 'Open API Client', icon: Send, action: onOpenApiClient },
            { label: 'Open Database Explorer', icon: Database, action: onOpenDatabase },
            { label: 'Open Design & Assets', icon: Palette, action: onOpenDesign },
            { label: 'Open Activity & Logs', icon: Activity, action: onOpenActivityLogs },
            { label: 'Open Browser', icon: Globe2, action: onOpenBrowser }
          ]
            .filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
            .map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                onClick={() => {
                  action();
                  onClose();
                }}
                className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-[var(--glass-text)] hover:bg-surface-hover transition text-left"
              >
                <Icon className="w-4 h-4 text-primary" />
                <span>{label}</span>
              </button>
            ))}

          <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2 py-1 uppercase tracking-wider mt-2">
            Actions
          </div>
          <button
            onClick={() => {
              onCreateWorkspace();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-[var(--glass-text)] hover:bg-surface-hover transition text-left"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Create new workspace...</span>
          </button>
          <button
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-[var(--glass-text)] hover:bg-surface-hover transition text-left"
          >
            <Terminal className="w-4 h-4 text-[var(--glass-text-muted)]" />
            <span>Inspect discovered CLIs &amp; settings...</span>
          </button>
        </div>
      </div>
    </div>
  );
};

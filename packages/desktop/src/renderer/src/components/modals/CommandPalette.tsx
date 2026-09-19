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
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredDesktops = desktops.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase())
  );
  const filteredWorkspaces = workspaces.filter((w) =>
    w.name.toLowerCase().includes(query.toLowerCase())
  );
  const allApps = [
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
  ];
  const filteredApps = allApps.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );
  const actionItems = [
    {
      id: 'create-ws',
      label: 'Create new workspace...',
      icon: Plus,
      iconColor: 'text-emerald-400',
      action: () => {
        onCreateWorkspace();
        onClose();
      }
    },
    {
      id: 'inspect-settings',
      label: 'Inspect discovered CLIs & settings...',
      icon: Terminal,
      iconColor: 'text-[var(--glass-text-muted)]',
      action: () => {
        onOpenSettings();
        onClose();
      }
    }
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  // Build flattened list for keyboard navigation
  const flatItems: Array<{ key: string; action: () => void }> = [
    ...filteredDesktops.map((d) => ({
      key: `desktop-${d.id}`,
      action: () => {
        onSelectDesktop(d.id);
        onClose();
      }
    })),
    ...filteredWorkspaces.map((w) => ({
      key: `ws-${w.id}`,
      action: () => {
        onSelectWorkspace(w.id);
        onClose();
      }
    })),
    ...filteredApps.map((a) => ({
      key: `app-${a.label}`,
      action: () => {
        a.action();
        onClose();
      }
    })),
    ...actionItems.map((act) => ({
      key: act.id,
      action: act.action
    }))
  ];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatItems.length > 0 && flatItems[selectedIndex]) {
          flatItems[selectedIndex].action();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, flatItems, selectedIndex]);

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <div
      className="fixed inset-0 glass-scrim z-50 flex items-start justify-center pt-24 p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-[var(--glass-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-[var(--glass-border-subtle)] space-x-3">
          <Search className="w-4 h-4 text-[var(--glass-text-muted)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search desktops..."
            className="flex-1 bg-transparent text-sm text-[var(--glass-text)] placeholder-[var(--glass-text-muted)] focus:outline-none"
            autoFocus
          />
          <kbd className="text-[10px] font-mono bg-[var(--glass-hover)] px-1.5 py-0.5 rounded text-[var(--glass-text-muted)] border border-[var(--glass-border-subtle)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
          {filteredDesktops.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2.5 py-1 uppercase tracking-wider">
                Virtual Desktops
              </div>
              {filteredDesktops.map((d) => {
                const itemIdx = currentIndex++;
                const isSelected = itemIdx === selectedIndex;
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      onSelectDesktop(d.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(itemIdx)}
                    className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl text-[var(--glass-text)] transition text-left ${
                      isSelected
                        ? 'bg-[var(--glass-selected)] font-medium'
                        : 'hover:bg-[var(--glass-hover)]'
                    }`}
                  >
                    <Monitor className="w-4 h-4 text-primary shrink-0" />
                    <span>Switch to <strong>{d.name}</strong> desktop</span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredWorkspaces.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2.5 py-1 uppercase tracking-wider mt-2">
                Workspaces
              </div>
              {filteredWorkspaces.map((w) => {
                const itemIdx = currentIndex++;
                const isSelected = itemIdx === selectedIndex;
                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      onSelectWorkspace(w.id);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(itemIdx)}
                    className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl text-[var(--glass-text)] transition text-left ${
                      isSelected
                        ? 'bg-[var(--glass-selected)] font-medium'
                        : 'hover:bg-[var(--glass-hover)]'
                    }`}
                  >
                    <FolderGit2 className="w-4 h-4 text-accent shrink-0" />
                    <span>Open <strong>{w.name}</strong> workspace</span>
                  </button>
                );
              })}
            </div>
          )}

          {filteredApps.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2.5 py-1 uppercase tracking-wider mt-2">
                Apps
              </div>
              {filteredApps.map(({ label, icon: Icon, action }) => {
                const itemIdx = currentIndex++;
                const isSelected = itemIdx === selectedIndex;
                return (
                  <button
                    key={label}
                    onClick={() => {
                      action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(itemIdx)}
                    className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl text-[var(--glass-text)] transition text-left ${
                      isSelected
                        ? 'bg-[var(--glass-selected)] font-medium'
                        : 'hover:bg-[var(--glass-hover)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {actionItems.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2.5 py-1 uppercase tracking-wider mt-2">
                Actions
              </div>
              {actionItems.map(({ id, label, icon: Icon, iconColor, action }) => {
                const itemIdx = currentIndex++;
                const isSelected = itemIdx === selectedIndex;
                return (
                  <button
                    key={id}
                    onClick={action}
                    onMouseEnter={() => setSelectedIndex(itemIdx)}
                    className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-xl text-[var(--glass-text)] transition text-left ${
                      isSelected
                        ? 'bg-[var(--glass-selected)] font-medium'
                        : 'hover:bg-[var(--glass-hover)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {flatItems.length === 0 && (
            <p className="text-center py-6 text-[var(--glass-text-muted)] text-xs">
              No matching commands or desktops found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Workspace, Desktop } from '@agentic/shared-contracts';
import { Search, Monitor, FolderGit2, Terminal, Plus, X } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  desktops: Desktop[];
  onSelectWorkspace: (id: string) => void;
  onSelectDesktop: (id: string) => void;
  onOpenSettings: () => void;
  onCreateWorkspace: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  workspaces,
  desktops,
  onSelectWorkspace,
  onSelectDesktop,
  onOpenSettings,
  onCreateWorkspace
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
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
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-start justify-center pt-24 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-elevated border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-white/5 space-x-3">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search desktops..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            autoFocus
          />
          <kbd className="text-[10px] font-mono bg-white/5 px-1.5 py-0.5 rounded text-zinc-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-1 text-xs">
          <div className="text-[10px] font-semibold text-zinc-500 px-2 py-1 uppercase tracking-wider">
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
                className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-zinc-300 hover:bg-surface-hover transition text-left"
              >
                <Monitor className="w-4 h-4 text-primary" />
                <span>Switch to <strong>{d.name}</strong> desktop</span>
              </button>
            ))}

          <div className="text-[10px] font-semibold text-zinc-500 px-2 py-1 uppercase tracking-wider mt-2">
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
                className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-zinc-300 hover:bg-surface-hover transition text-left"
              >
                <FolderGit2 className="w-4 h-4 text-accent" />
                <span>Open <strong>{w.name}</strong> workspace</span>
              </button>
            ))}

          <div className="text-[10px] font-semibold text-zinc-500 px-2 py-1 uppercase tracking-wider mt-2">
            Actions
          </div>
          <button
            onClick={() => {
              onCreateWorkspace();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-zinc-300 hover:bg-surface-hover transition text-left"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Create new workspace...</span>
          </button>
          <button
            onClick={() => {
              onOpenSettings();
              onClose();
            }}
            className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-xl text-zinc-300 hover:bg-surface-hover transition text-left"
          >
            <Terminal className="w-4 h-4 text-zinc-400" />
            <span>Inspect discovered CLIs &amp; settings...</span>
          </button>
        </div>
      </div>
    </div>
  );
};

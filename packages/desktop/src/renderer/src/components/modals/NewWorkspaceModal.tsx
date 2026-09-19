import React, { useState } from 'react';
import { X, FolderGit2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NewWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateWorkspace: (name: string, repoPath?: string) => Promise<void>;
}

export const NewWorkspaceModal: React.FC<NewWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreateWorkspace
}) => {
  const [name, setName] = useState('');
  const [repoPath, setRepoPath] = useState('');
  const [gitStatus, setGitStatus] = useState<{ isGit: boolean; hasCommits: boolean } | null>(null);
  const [isInitializingGit, setIsInitializingGit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCheckRepo = async () => {
    const trimmed = repoPath.trim();
    if (!trimmed || !window.agenticApi) return;

    try {
      const res = await window.agenticApi.checkGitRepo(trimmed);
      setGitStatus(res);
    } catch {
      setGitStatus({ isGit: false, hasCommits: false });
    }
  };

  const handleInitGit = async () => {
    const trimmed = repoPath.trim();
    if (!trimmed || !window.agenticApi) return;

    setIsInitializingGit(true);
    try {
      await window.agenticApi.initGitRepo(trimmed);
      const res = await window.agenticApi.checkGitRepo(trimmed);
      setGitStatus(res);
    } finally {
      setIsInitializingGit(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsSubmitting(true);
    try {
      await onCreateWorkspace(trimmedName, repoPath.trim() || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 glass-scrim z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="glass-modal rounded-2xl p-6 max-w-md w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--glass-border-subtle)] pb-3">
          <div className="flex items-center space-x-2">
            <FolderGit2 className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-[var(--glass-text)]">Create New Workspace</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[var(--glass-text-muted)] font-medium mb-1">Workspace Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Web App"
              className="w-full bg-[var(--glass-inset-bg)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-[var(--glass-text)] focus:outline-none focus:border-primary/50"
            />
          </div>

          <div>
            <label className="block text-[var(--glass-text-muted)] font-medium mb-1">
              Repository Path <span className="text-[var(--glass-text-muted)]">(optional)</span>
            </label>
            <div className="flex space-x-1.5">
              <input
                type="text"
                value={repoPath}
                onChange={(e) => {
                  setRepoPath(e.target.value);
                  setGitStatus(null);
                }}
                onBlur={handleCheckRepo}
                placeholder="/path/to/project"
                className="flex-1 bg-[var(--glass-inset-bg)] border border-[var(--glass-border)] rounded-xl px-3 py-2 text-[var(--glass-text)] font-mono text-[11px] focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={handleCheckRepo}
                className="px-2.5 py-1 rounded-xl bg-[var(--glass-hover)] hover:bg-[var(--glass-hover)] text-[var(--glass-text)] font-medium text-xs transition"
              >
                Verify
              </button>
            </div>
          </div>

          {/* Git status validation and 1-click init */}
          {gitStatus && (
            <div>
              {gitStatus.isGit && gitStatus.hasCommits ? (
                <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-400/10 p-2.5 rounded-xl border border-emerald-400/20">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Valid Git repository with initial commit ready for worktrees.</span>
                </div>
              ) : (
                <div className="bg-amber-400/10 p-3 rounded-xl border border-amber-400/20 space-y-2 text-amber-300">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">
                      {!gitStatus.isGit
                        ? 'Directory is not a Git repository'
                        : 'Repository has no commits yet'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--glass-text)] leading-relaxed">
                    Agentic Desktop requires an initial baseline commit to create isolated Git worktrees for agents.
                  </p>
                  <button
                    type="button"
                    disabled={isInitializingGit}
                    onClick={handleInitGit}
                    className="w-full py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 font-medium transition"
                  >
                    {isInitializingGit ? 'Initializing Git...' : 'Initialize Git & Create Baseline Commit'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[var(--glass-border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition ${
              name.trim() && !isSubmitting
                ? 'bg-primary text-white hover:bg-primary-hover shadow-sm'
                : 'bg-[var(--glass-hover)] text-[var(--glass-text-muted)] cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Creating...' : 'Create Workspace'}
          </button>
        </div>
      </form>
    </div>
  );
};

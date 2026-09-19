import React, { useCallback, useEffect, useState } from 'react';
import { GitChangedFile, GitStatusResult } from '@agentic/shared-contracts';
import {
  GitBranch,
  Minus,
  RefreshCw,
  Upload,
  X,
  Plus,
  MinusCircle,
  Check,
  GitPullRequest,
  ExternalLink
} from 'lucide-react';

interface SourceControlAppWindowProps {
  workspaceId: string;
  repoPaths: string[];
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

function statusLabel(file: GitChangedFile): string {
  if (file.kind === 'untracked') return 'U';
  if (file.staged) return file.indexStatus;
  return file.worktreeStatus;
}

export const SourceControlAppWindow: React.FC<SourceControlAppWindowProps> = ({
  workspaceId,
  repoPaths,
  isFocused,
  onFocus,
  onMinimize,
  onClose
}) => {
  const [repoPath, setRepoPath] = useState(repoPaths[0] ?? '');
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [prBase, setPrBase] = useState('');
  const [prDraft, setPrDraft] = useState(false);
  const [showPrForm, setShowPrForm] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (repoPaths.length > 0 && !repoPaths.includes(repoPath)) {
      setRepoPath(repoPaths[0]);
    }
  }, [repoPaths, repoPath]);

  const refresh = useCallback(async () => {
    if (!window.agenticApi || !repoPath) return;
    setLoading(true);
    setError(null);
    setPushMessage(null);
    try {
      const next = await window.agenticApi.getGitStatus(workspaceId, repoPath);
      setStatus(next);
      if (selectedPath && !next.changedFiles.some((f) => f.path === selectedPath)) {
        setSelectedPath(null);
        setDiff('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load git status');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, repoPath, selectedPath]);

  useEffect(() => {
    if (repoPath) refresh();
  }, [repoPath, refresh]);

  const loadDiff = async (file: GitChangedFile) => {
    if (!window.agenticApi) return;
    setSelectedPath(file.path);
    setError(null);
    try {
      const result = await window.agenticApi.getGitDiff(
        workspaceId,
        repoPath,
        file.path,
        file.staged
      );
      setDiff(result.diff || '(No diff output)');
    } catch (err) {
      setDiff('');
      setError(err instanceof Error ? err.message : 'Failed to load diff');
    }
  };

  const stageFile = async (filePath: string) => {
    if (!window.agenticApi) return;
    setError(null);
    try {
      const next = await window.agenticApi.stageGitFiles(workspaceId, repoPath, [filePath]);
      setStatus(next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stage file');
    }
  };

  const unstageFile = async (filePath: string) => {
    if (!window.agenticApi) return;
    setError(null);
    try {
      const next = await window.agenticApi.unstageGitFiles(workspaceId, repoPath, [filePath]);
      setStatus(next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unstage file');
    }
  };

  const stageAll = async () => {
    if (!window.agenticApi) return;
    setError(null);
    try {
      const next = await window.agenticApi.stageGitFiles(workspaceId, repoPath, []);
      setStatus(next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stage changes');
    }
  };

  const handleCommit = async () => {
    if (!window.agenticApi) return;
    setError(null);
    setPushMessage(null);
    try {
      const result = await window.agenticApi.commitGit(workspaceId, repoPath, commitMessage);
      setCommitMessage('');
      setPushMessage(`Committed ${result.commitHash} on ${result.branch}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit');
    }
  };

  const handlePush = async () => {
    if (!window.agenticApi) return;
    setError(null);
    setPrUrl(null);
    try {
      const result = await window.agenticApi.pushGit(workspaceId, repoPath);
      setPushMessage(result.message);
      if (!result.success) setError(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push');
    }
  };

  const handleCreatePr = async () => {
    if (!window.agenticApi) return;
    setError(null);
    setPushMessage(null);
    setPrUrl(null);
    try {
      const result = await window.agenticApi.createPullRequest(workspaceId, repoPath, {
        title: prTitle,
        body: prBody || undefined,
        base: prBase || undefined,
        draft: prDraft
      });
      if (result.success) {
        setPushMessage(result.message);
        setPrUrl(result.url ?? null);
        setShowPrForm(false);
        setPrTitle('');
        setPrBody('');
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pull request');
    }
  };

  const staged = status?.changedFiles.filter((f) => f.staged) ?? [];
  const unstaged = status?.changedFiles.filter((f) => !f.staged) ?? [];

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-source-control-window
    >
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move shrink-0">
        <GitBranch className="w-4 h-4 text-primary shrink-0 ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] shrink-0">Source Control</span>

        {repoPaths.length > 1 && (
          <select
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="titlebar-no-drag glass-input-recess rounded-lg px-2 py-0.5 text-[11px] text-[var(--glass-text)] max-w-[140px]"
          >
            {repoPaths.map((p) => (
              <option key={p} value={p}>
                {p.split('/').pop() ?? p}
              </option>
            ))}
          </select>
        )}

        {status && (
          <span className="text-[11px] text-[var(--glass-text-muted)] font-mono truncate titlebar-no-drag">
            {status.branch}
            {status.ahead ? ` ↑${status.ahead}` : ''}
            {status.behind ? ` ↓${status.behind}` : ''}
          </span>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 titlebar-no-drag">
          <button
            onClick={(e) => {
              e.stopPropagation();
              refresh();
            }}
            disabled={loading}
            className={`p-1 text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] glass-chip rounded ${loading ? 'animate-spin' : ''}`}
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            className="p-1 text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] glass-chip rounded"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-[var(--glass-text-muted)] hover:text-red-400 glass-chip rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {(error || pushMessage) && (
        <div
          className={`px-3 py-1.5 text-[11px] border-b ${
            error
              ? 'text-amber-300 bg-amber-400/10 border-amber-400/20'
              : 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20'
          }`}
        >
          <span>{error || pushMessage}</span>
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-2 inline-flex items-center gap-0.5 text-emerald-200 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Open PR
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {repoPaths.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-xs text-[var(--glass-text-muted)] text-center">
          Attach a repository to this workspace to use source control.
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b border-[var(--glass-border-subtle)] space-y-2 shrink-0">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message"
              rows={2}
              className="w-full glass-input-recess rounded-lg px-2.5 py-1.5 text-xs text-[var(--glass-text)] resize-none focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleCommit}
                disabled={!commitMessage.trim() || staged.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-send-btn text-[11px] text-white disabled:opacity-40"
              >
                <Check className="w-3 h-3" />
                Commit
              </button>
              <button
                onClick={stageAll}
                disabled={unstaged.length === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-chip text-[11px] text-[var(--glass-text)] disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
                Stage all
              </button>
              <button
                onClick={handlePush}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-chip text-[11px] text-[var(--glass-text)]"
              >
                <Upload className="w-3 h-3" />
                Push
              </button>
              <button
                onClick={() => setShowPrForm((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-chip text-[11px] text-[var(--glass-text)]"
              >
                <GitPullRequest className="w-3 h-3" />
                {showPrForm ? 'Hide PR' : 'Create PR'}
              </button>
            </div>

            {showPrForm && (
              <div className="space-y-2 pt-1 border-t border-[var(--glass-border-subtle)]">
                <input
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  placeholder="PR title"
                  className="w-full glass-input-recess rounded-lg px-2.5 py-1.5 text-xs text-[var(--glass-text)] focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
                <textarea
                  value={prBody}
                  onChange={(e) => setPrBody(e.target.value)}
                  placeholder="PR description (optional)"
                  rows={3}
                  className="w-full glass-input-recess rounded-lg px-2.5 py-1.5 text-xs text-[var(--glass-text)] resize-none focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center gap-2">
                  <input
                    value={prBase}
                    onChange={(e) => setPrBase(e.target.value)}
                    placeholder="Base branch (optional)"
                    className="flex-1 glass-input-recess rounded-lg px-2.5 py-1.5 text-xs text-[var(--glass-text)] focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--glass-text-muted)] shrink-0">
                    <input
                      type="checkbox"
                      checked={prDraft}
                      onChange={(e) => setPrDraft(e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    Draft
                  </label>
                </div>
                <button
                  onClick={handleCreatePr}
                  disabled={!prTitle.trim()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-send-btn text-[11px] text-white disabled:opacity-40"
                >
                  <GitPullRequest className="w-3 h-3" />
                  Create pull request
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 flex min-h-0">
            <div className="w-2/5 border-r border-[var(--glass-border-subtle)] overflow-y-auto text-xs">
              {status?.clean ? (
                <p className="p-3 text-[var(--glass-text-muted)]">Working tree clean.</p>
              ) : (
                <>
                  {staged.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--glass-text-muted)] uppercase tracking-wider">
                        Staged
                      </div>
                      {staged.map((file) => (
                        <FileRow
                          key={`s-${file.path}`}
                          file={file}
                          selected={selectedPath === file.path}
                          onSelect={() => loadDiff(file)}
                          onStage={() => stageFile(file.path)}
                          onUnstage={() => unstageFile(file.path)}
                        />
                      ))}
                    </div>
                  )}
                  {unstaged.length > 0 && (
                    <div>
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--glass-text-muted)] uppercase tracking-wider">
                        Changes
                      </div>
                      {unstaged.map((file) => (
                        <FileRow
                          key={`u-${file.path}`}
                          file={file}
                          selected={selectedPath === file.path}
                          onSelect={() => loadDiff(file)}
                          onStage={() => stageFile(file.path)}
                          onUnstage={() => unstageFile(file.path)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex-1 overflow-auto p-3">
              {selectedPath ? (
                <pre className="text-[11px] text-[var(--glass-text)] font-mono whitespace-pre-wrap break-words">
                  {diff}
                </pre>
              ) : (
                <p className="text-xs text-[var(--glass-text-muted)]">Select a file to view its diff.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function FileRow({
  file,
  selected,
  onSelect,
  onStage,
  onUnstage
}: {
  file: GitChangedFile;
  selected: boolean;
  onSelect: () => void;
  onStage: () => void;
  onUnstage: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-1 px-2 py-1 hover:bg-[var(--glass-hover)] ${
        selected ? 'bg-primary/10' : ''
      }`}
    >
      <button onClick={onSelect} className="flex-1 flex items-center gap-2 text-left min-w-0">
        <span className="font-mono text-[10px] text-[var(--glass-text-muted)] w-3">{statusLabel(file)}</span>
        <span className="truncate text-[var(--glass-text)]">{file.path}</span>
      </button>
      {file.staged ? (
        <button onClick={onUnstage} title="Unstage" className="p-0.5 text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]">
          <MinusCircle className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button onClick={onStage} title="Stage" className="p-0.5 text-[var(--glass-text-muted)] hover:text-emerald-400">
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

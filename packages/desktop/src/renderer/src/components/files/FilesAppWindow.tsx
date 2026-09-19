import React, { useCallback, useEffect, useState } from 'react';
import { FileEntry, FilePreview } from '@agentic/shared-contracts';
import {
  ChevronRight,
  File,
  Folder,
  FolderGit2,
  FolderOpen,
  Minus,
  X
} from 'lucide-react';

interface FilesAppWindowProps {
  workspaceId: string;
  repoPaths: string[];
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onOpenInEditor: (filePath: string) => void;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FilesAppWindow: React.FC<FilesAppWindowProps> = ({
  workspaceId,
  repoPaths,
  isFocused,
  onFocus,
  onMinimize,
  onClose,
  onOpenInEditor
}) => {
  const [rootPath, setRootPath] = useState(repoPaths[0] ?? '');
  const [currentPath, setCurrentPath] = useState(repoPaths[0] ?? '');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (repoPaths.length > 0 && !repoPaths.includes(rootPath)) {
      setRootPath(repoPaths[0]);
      setCurrentPath(repoPaths[0]);
    }
  }, [repoPaths, rootPath]);

  const loadDirectory = useCallback(
    async (dirPath: string) => {
      if (!window.agenticApi || !dirPath) return;
      setLoading(true);
      setError(null);
      try {
        const list = await window.agenticApi.listDirectory(workspaceId, dirPath);
        setEntries(list);
        setCurrentPath(dirPath);
        setPreview(null);
        setSelectedPath(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to list directory');
      } finally {
        setLoading(false);
      }
    },
    [workspaceId]
  );

  useEffect(() => {
    if (rootPath) {
      loadDirectory(rootPath);
    }
  }, [rootPath, loadDirectory]);

  const loadPreview = async (filePath: string) => {
    if (!window.agenticApi) return;
    setSelectedPath(filePath);
    setError(null);
    try {
      const result = await window.agenticApi.readTextFile(workspaceId, filePath);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
      setPreview(null);
    }
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.kind === 'directory') {
      loadDirectory(entry.path);
      return;
    }
    loadPreview(entry.path);
  };

  const handleEntryDoubleClick = (entry: FileEntry) => {
    if (entry.kind === 'file') {
      onOpenInEditor(entry.path);
    }
  };

  const breadcrumbParts = currentPath.replace(rootPath, '').split('/').filter(Boolean);

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-files-window
    >
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move shrink-0">
        <FolderOpen className="w-4 h-4 text-primary shrink-0 ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] shrink-0">Files</span>

        {repoPaths.length > 1 && (
          <select
            value={rootPath}
            onChange={(e) => {
              setRootPath(e.target.value);
              setCurrentPath(e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            className="titlebar-no-drag glass-input-recess rounded-lg px-2 py-0.5 text-[11px] text-[var(--glass-text)] max-w-[180px]"
          >
            {repoPaths.map((p) => (
              <option key={p} value={p}>
                {p.split('/').pop() ?? p}
              </option>
            ))}
          </select>
        )}

        <div className="flex-1 flex items-center gap-0.5 text-[11px] text-[var(--glass-text-muted)] truncate titlebar-no-drag px-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              loadDirectory(rootPath);
            }}
            className="hover:text-[var(--glass-text)] truncate"
          >
            {rootPath.split('/').pop() ?? rootPath}
          </button>
          {breadcrumbParts.map((part, idx) => {
            const partial = pathJoin(rootPath, breadcrumbParts.slice(0, idx + 1));
            return (
              <span key={partial} className="flex items-center gap-0.5 shrink-0">
                <ChevronRight className="w-3 h-3" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    loadDirectory(partial);
                  }}
                  className="hover:text-[var(--glass-text)]"
                >
                  {part}
                </button>
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5 titlebar-no-drag">
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

      {error && (
        <div className="px-3 py-1.5 text-[11px] text-amber-300 bg-amber-400/10 border-b border-amber-400/20">
          {error}
        </div>
      )}

      {repoPaths.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-xs text-[var(--glass-text-muted)] text-center">
          No repository attached to this workspace. Add a repo path when creating the workspace.
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <div className="w-2/5 border-r border-[var(--glass-border-subtle)] overflow-y-auto">
            {loading ? (
              <p className="p-3 text-xs text-[var(--glass-text-muted)]">Loading…</p>
            ) : (
              <ul className="py-1">
                {currentPath !== rootPath && (
                  <li>
                    <button
                      onClick={() => loadDirectory(pathParent(currentPath))}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--glass-text-muted)] hover:bg-[var(--glass-hover)]"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      ..
                    </button>
                  </li>
                )}
                {entries.map((entry) => (
                  <li key={entry.path}>
                    <button
                      onClick={() => handleEntryClick(entry)}
                      onDoubleClick={() => handleEntryDoubleClick(entry)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-[var(--glass-hover)] ${
                        selectedPath === entry.path ? 'bg-primary/10 text-primary' : 'text-[var(--glass-text)]'
                      }`}
                    >
                      {entry.kind === 'directory' ? (
                        <Folder className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                      ) : (
                        <File className="w-3.5 h-3.5 text-[var(--glass-text-muted)] shrink-0" />
                      )}
                      <span className="truncate flex-1">{entry.name}</span>
                      {entry.kind === 'file' && (
                        <span className="text-[10px] text-[var(--glass-text-muted)] shrink-0">
                          {formatSize(entry.size)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {preview ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--glass-border-subtle)] shrink-0">
                  <span className="text-[11px] text-[var(--glass-text-muted)] font-mono truncate">
                    {preview.path.split('/').pop()}
                  </span>
                  {preview.kind === 'text' && (
                    <button
                      onClick={() => onOpenInEditor(preview.path)}
                      className="text-[11px] px-2 py-0.5 rounded-lg glass-chip text-[var(--glass-text)]"
                    >
                      Open in Editor
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-3">
                  {preview.kind === 'text' ? (
                    <pre className="text-[11px] text-[var(--glass-text)] font-mono whitespace-pre-wrap break-words">
                      {preview.content}
                      {preview.truncated && (
                        <span className="block mt-2 text-[var(--glass-text-muted)]">…truncated preview</span>
                      )}
                    </pre>
                  ) : (
                    <img
                      src={`data:${preview.mimeType};base64,${preview.dataBase64}`}
                      alt={preview.path}
                      className="max-w-full max-h-full object-contain mx-auto"
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--glass-text-muted)] p-6 text-center">
                <FolderGit2 className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">Select a file to preview, or double-click to edit.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function pathParent(dirPath: string): string {
  const normalized = dirPath.replace(/\/$/, '');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return normalized;
  return normalized.slice(0, idx);
}

function pathJoin(root: string, parts: string[]): string {
  if (parts.length === 0) return root;
  return `${root.replace(/\/$/, '')}/${parts.join('/')}`;
}

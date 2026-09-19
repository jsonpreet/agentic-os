import React, { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Code2, Minus, Save, X } from 'lucide-react';
import { languageForPath } from '../../lib/editor-language.js';

interface EditorTab {
  id: string;
  filePath: string;
  content: string;
  savedContent: string;
}

interface EditorAppWindowProps {
  workspaceId: string;
  initialFilePath?: string | null;
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onPendingFileHandled?: () => void;
}

function tabIdForPath(filePath: string): string {
  return `tab-${filePath}`;
}

export const EditorAppWindow: React.FC<EditorAppWindowProps> = ({
  workspaceId,
  initialFilePath,
  isFocused,
  onFocus,
  onMinimize,
  onClose,
  onPendingFileHandled
}) => {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openedPathsRef = useRef<Set<string>>(new Set());

  const openFile = useCallback(async (filePath: string): Promise<void> => {
      if (!window.agenticApi) return;
      setError(null);

      let openedExisting = false;
      setTabs((prev) => {
        const existing = prev.find((t) => t.filePath === filePath);
        if (existing) {
          openedExisting = true;
          setActiveTabId(existing.id);
          return prev;
        }
        return prev;
      });
      if (openedExisting) return;

      try {
        const preview = await window.agenticApi.readTextFile(workspaceId, filePath);
        if (preview.kind !== 'text') {
          setError('Only text files can be opened in the editor.');
          return;
        }

        const tab: EditorTab = {
          id: tabIdForPath(filePath),
          filePath,
          content: preview.content,
          savedContent: preview.content
        };
        setTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open file');
      }
    },
    [workspaceId]
  );

  useEffect(() => {
    if (!initialFilePath || openedPathsRef.current.has(initialFilePath)) return;
    openedPathsRef.current.add(initialFilePath);
    void openFile(initialFilePath).then(() => onPendingFileHandled?.());
  }, [initialFilePath, openFile, onPendingFileHandled]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const handleSave = async () => {
    if (!activeTab || !window.agenticApi) return;
    setIsSaving(true);
    setError(null);
    try {
      await window.agenticApi.writeTextFile(workspaceId, activeTab.filePath, activeTab.content);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTab.id ? { ...t, savedContent: activeTab.content } : t
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[next.length - 1]?.id ?? null);
      }
      return next;
    });
  };

  const fileName = activeTab?.filePath.split('/').pop() ?? 'Editor';

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-editor-window
    >
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move shrink-0">
        <Code2 className="w-4 h-4 text-primary shrink-0 ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] truncate max-w-[160px]">{fileName}</span>

        <div className="flex-1 flex items-center gap-1 overflow-x-auto titlebar-no-drag px-1">
          {tabs.map((tab) => {
            const dirty = tab.content !== tab.savedContent;
            const name = tab.filePath.split('/').pop() ?? tab.filePath;
            return (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTabId(tab.id);
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] shrink-0 transition ${
                  tab.id === activeTabId
                    ? 'glass-chip-active ui-modal-tab-active'
                    : 'glass-chip text-[var(--glass-text-muted)]'
                }`}
              >
                <span className="truncate max-w-[100px]">{name}</span>
                {dirty && <span className="text-amber-400">•</span>}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5 titlebar-no-drag">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={!activeTab || isSaving}
            title="Save (⌘S)"
            className="p-1 text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] glass-chip rounded disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
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

      {error && (
        <div className="px-3 py-1.5 text-[11px] text-amber-300 bg-amber-400/10 border-b border-amber-400/20">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0">
        {activeTab ? (
          <Editor
            height="100%"
            language={languageForPath(activeTab.filePath)}
            value={activeTab.content}
            theme="vs-dark"
            onChange={(value) => {
              const next = value ?? '';
              setTabs((prev) =>
                prev.map((t) => (t.id === activeTab.id ? { ...t, content: next } : t))
              );
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--glass-text-muted)]">
            <Code2 className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs">Open a file from the Files app to start editing.</p>
          </div>
        )}
      </div>
    </div>
  );
};

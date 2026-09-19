import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WorkspaceNote } from '@agentic/shared-contracts';
import { FileText, Minus, Plus, Trash2, X } from 'lucide-react';

interface NotesAppWindowProps {
  workspaceId: string;
  desktopId: string;
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

function formatSavedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const NotesAppWindow: React.FC<NotesAppWindowProps> = ({
  workspaceId,
  desktopId,
  isFocused,
  onFocus,
  onMinimize,
  onClose
}) => {
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshNotes = useCallback(async () => {
    if (!window.agenticApi) return;
    const list = await window.agenticApi.listNotes(workspaceId, desktopId);
    setNotes(list);
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0].id);
    }
  }, [workspaceId, desktopId, selectedId]);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  useEffect(() => {
    if (!selectedId) {
      setTitle('');
      setContent('');
      return;
    }
    const note = notes.find((entry) => entry.id === selectedId);
    if (!note) return;
    setTitle(note.title);
    setContent(note.content);
    setSaveState('idle');
  }, [selectedId, notes]);

  const persistNote = useCallback(
    async (nextTitle: string, nextContent: string) => {
      if (!window.agenticApi || !selectedId) return;
      setSaveState('saving');
      setError(null);
      try {
        const updated = await window.agenticApi.updateNote({
          noteId: selectedId,
          title: nextTitle,
          content: nextContent
        });
        setNotes((prev) =>
          prev.map((note) => (note.id === updated.id ? updated : note)).sort(
            (a, b) => b.updatedAt - a.updatedAt
          )
        );
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        setError(err instanceof Error ? err.message : 'Failed to save note');
      }
    },
    [selectedId]
  );

  useEffect(() => {
    if (!selectedId) return;
    const note = notes.find((entry) => entry.id === selectedId);
    if (!note) return;
    if (note.title === title && note.content === content) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistNote(title, content);
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, content, selectedId, notes, persistNote]);

  const handleCreate = async () => {
    if (!window.agenticApi) return;
    setError(null);
    try {
      const note = await window.agenticApi.createNote({
        workspaceId,
        desktopId,
        title: 'Untitled',
        content: ''
      });
      setNotes((prev) => [note, ...prev]);
      setSelectedId(note.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    }
  };

  const handleDelete = async () => {
    if (!window.agenticApi || !selectedId) return;
    if (!confirm('Delete this note?')) return;
    setError(null);
    try {
      await window.agenticApi.deleteNote(selectedId);
      const remaining = notes.filter((note) => note.id !== selectedId);
      setNotes(remaining);
      setSelectedId(remaining[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  const selected = notes.find((note) => note.id === selectedId) ?? null;

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-notes-window
    >
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move shrink-0">
        <FileText className="w-3.5 h-3.5 text-primary ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] flex-1">Notes</span>
        {selected && (
          <span className="text-[10px] text-[var(--glass-text-muted)] mr-1">
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? `Saved ${formatSavedAt(selected.updatedAt)}`
                : saveState === 'error'
                  ? 'Save failed'
                  : 'Autosave on'}
          </span>
        )}
        <button
          type="button"
          onClick={onMinimize}
          className="p-1 rounded-md hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)]"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className="w-52 border-r border-[var(--glass-border-subtle)] flex flex-col shrink-0">
          <div className="p-2 border-b border-[var(--glass-border-subtle)]">
            <button
              type="button"
              onClick={handleCreate}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg glass-chip text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)]"
            >
              <Plus className="w-3.5 h-3.5" />
              New note
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {notes.length === 0 && (
              <p className="text-[11px] text-[var(--glass-text-muted)] px-2 py-3">No notes yet.</p>
            )}
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => setSelectedId(note.id)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition ${
                  note.id === selectedId
                    ? 'glass-chip-active text-[var(--glass-text)]'
                    : 'text-[var(--glass-text-muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--glass-text)]'
                }`}
              >
                <div className="font-medium truncate">{note.title}</div>
                <div className="text-[10px] text-[var(--glass-text-muted)] mt-0.5">
                  {formatSavedAt(note.updatedAt)}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1 flex flex-col min-w-0">
          {selected ? (
            <>
              <div className="px-3 py-2 border-b border-[var(--glass-border-subtle)] flex items-center gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note title"
                  className="flex-1 bg-transparent text-sm font-medium text-[var(--glass-text)] outline-none"
                />
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--glass-text-muted)] hover:text-red-300"
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write markdown notes, specs, or meeting notes…"
                className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[var(--glass-text)] outline-none font-mono leading-relaxed"
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--glass-text-muted)]">
              Create a note to get started.
            </div>
          )}
        </section>
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-red-300 border-t border-red-400/20 bg-red-500/10">
          {error}
        </div>
      )}
    </div>
  );
};

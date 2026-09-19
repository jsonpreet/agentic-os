import { describe, it, expect } from 'vitest';
import { PromptRouteResult } from '@agentic/shared-contracts';
import { confirmationForRoute } from '../src/renderer/src/lib/speech/route-feedback.js';
import { getFilesWindowId, isFilesWindowId } from '../src/renderer/src/lib/files-window.js';
import { getEditorWindowId } from '../src/renderer/src/lib/editor-window.js';
import { getSourceControlWindowId } from '../src/renderer/src/lib/source-control-window.js';
import { getDevServersWindowId } from '../src/renderer/src/lib/dev-servers-window.js';
import { getNotesWindowId } from '../src/renderer/src/lib/notes-window.js';
import { getKanbanWindowId } from '../src/renderer/src/lib/kanban-window.js';

/**
 * Milestone 3 acceptance (renderer):
 * developer workflow app commands → TTS confirmations → per-desktop window ids
 *
 * Manual follow-up (`pnpm dev`):
 * Editor → Browser → Git → Create PR
 */
describe('Milestone 3 acceptance (renderer)', () => {
  const desktopId = 'desktop-build';

  it('confirms developer workflow app commands for speech feedback', () => {
    const cases: Array<{ command: PromptRouteResult['appCommand']; expected: string }> = [
      { command: 'open_files', expected: 'Opening files.' },
      { command: 'open_editor', expected: 'Opening editor.' },
      { command: 'open_source_control', expected: 'Opening source control.' },
      { command: 'open_dev_servers', expected: 'Opening dev servers.' },
      { command: 'open_notes', expected: 'Opening notes.' },
      { command: 'open_kanban', expected: 'Opening kanban board.' }
    ];

    for (const { command, expected } of cases) {
      expect(
        confirmationForRoute({
          action: 'app_command',
          appCommand: command
        })
      ).toBe(expected);
    }
  });

  it('uses stable per-desktop window ids for M3 apps', () => {
    expect(getFilesWindowId(desktopId)).toBe('files-desktop-build');
    expect(isFilesWindowId('files-desktop-build')).toBe(true);

    expect(getEditorWindowId(desktopId)).toBe('editor-desktop-build');
    expect(getSourceControlWindowId(desktopId)).toBe('source-control-desktop-build');
    expect(getDevServersWindowId(desktopId)).toBe('dev-servers-desktop-build');
    expect(getNotesWindowId(desktopId)).toBe('notes-desktop-build');
    expect(getKanbanWindowId(desktopId)).toBe('kanban-desktop-build');
  });
});

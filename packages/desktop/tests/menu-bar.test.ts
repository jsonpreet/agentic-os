import { describe, expect, it } from 'vitest';
import {
  resolveActiveWindow,
  workspaceIndexForShortcut
} from '../src/renderer/src/lib/active-window.js';
import { getMenusForKind } from '../src/renderer/src/lib/menu-bar-menus.js';
import { getWallpaperTone } from '../src/renderer/src/lib/wallpaper-tone.js';

describe('resolveActiveWindow', () => {
  it('returns desktop when nothing is focused', () => {
    const info = resolveActiveWindow({
      focusedWindowId: null,
      desktopId: 'd1',
      agentSessions: [],
      browserSessions: [],
      filesWindowOpen: false,
      editorWindowOpen: false,
      sourceControlWindowOpen: false,
      devServersWindowOpen: false,
      notesWindowOpen: false,
      kanbanWindowOpen: false
    });
    expect(info).toEqual({ id: 'desktop', kind: 'desktop', title: 'Agentic' });
  });

  it('resolves agent session title', () => {
    const info = resolveActiveWindow({
      focusedWindowId: 's1',
      desktopId: 'd1',
      agentSessions: [
        {
          id: 's1',
          desktopId: 'd1',
          name: 'Stark',
          status: 'working'
        } as never
      ],
      browserSessions: [],
      filesWindowOpen: false,
      editorWindowOpen: false,
      sourceControlWindowOpen: false,
      devServersWindowOpen: false,
      notesWindowOpen: false,
      kanbanWindowOpen: false
    });
    expect(info.kind).toBe('agent');
    expect(info.title).toBe('Stark');
  });

  it('resolves files window when open', () => {
    const info = resolveActiveWindow({
      focusedWindowId: 'files-d1',
      desktopId: 'd1',
      agentSessions: [],
      browserSessions: [],
      filesWindowOpen: true,
      editorWindowOpen: false,
      sourceControlWindowOpen: false,
      devServersWindowOpen: false,
      notesWindowOpen: false,
      kanbanWindowOpen: false
    });
    expect(info.kind).toBe('files');
    expect(info.title).toBe('Files');
  });
});

describe('getMenusForKind', () => {
  it('includes File and View for desktop', () => {
    const menus = getMenusForKind('desktop');
    expect(menus.map((m) => m.label)).toEqual(['File', 'View']);
    expect(menus[0].items.some((i) => i.id === 'desktop.new-workspace')).toBe(true);
  });

  it('includes Window menu for agent windows', () => {
    const menus = getMenusForKind('agent');
    expect(menus.some((m) => m.label === 'Window')).toBe(true);
  });
});

describe('workspaceIndexForShortcut', () => {
  it('maps index to workspace id', () => {
    const workspaces = [{ id: 'a' }, { id: 'b' }];
    expect(workspaceIndexForShortcut(workspaces, 0)).toBe('a');
    expect(workspaceIndexForShortcut(workspaces, 1)).toBe('b');
    expect(workspaceIndexForShortcut(workspaces, 9)).toBeNull();
  });
});

describe('getWallpaperTone', () => {
  it('marks garden as light', () => {
    expect(getWallpaperTone({ kind: 'builtin', id: 'garden' })).toBe('light');
  });

  it('defaults custom wallpapers to dark', () => {
    expect(
      getWallpaperTone({ kind: 'custom', storeId: 'x', mediaType: 'image', name: 'Mine' })
    ).toBe('dark');
  });
});

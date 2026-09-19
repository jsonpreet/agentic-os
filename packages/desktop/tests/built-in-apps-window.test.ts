import { describe, expect, it } from 'vitest';
import { resolveActiveWindow } from '../src/renderer/src/lib/active-window.js';
import { getMenusForKind } from '../src/renderer/src/lib/menu-bar-menus.js';
import { getApiClientWindowId, isApiClientWindowId } from '../src/renderer/src/lib/api-client-window.js';
import { getDatabaseWindowId, isDatabaseWindowId } from '../src/renderer/src/lib/database-window.js';
import { getDesignWindowId, isDesignWindowId } from '../src/renderer/src/lib/design-window.js';
import { getActivityLogsWindowId, isActivityLogsWindowId } from '../src/renderer/src/lib/activity-logs-window.js';

describe('Built-in Apps Desktop Windows', () => {
  it('identifies and formats window IDs correctly', () => {
    const desktopId = 'desktop-alpha';

    const apiId = getApiClientWindowId(desktopId);
    expect(apiId).toBe('api-client-desktop-alpha');
    expect(isApiClientWindowId(apiId)).toBe(true);
    expect(isApiClientWindowId('other-window')).toBe(false);

    const dbId = getDatabaseWindowId(desktopId);
    expect(dbId).toBe('database-desktop-alpha');
    expect(isDatabaseWindowId(dbId)).toBe(true);

    const designId = getDesignWindowId(desktopId);
    expect(designId).toBe('design-desktop-alpha');
    expect(isDesignWindowId(designId)).toBe(true);

    const activityId = getActivityLogsWindowId(desktopId);
    expect(activityId).toBe('activity-logs-desktop-alpha');
    expect(isActivityLogsWindowId(activityId)).toBe(true);
    expect(isActivityLogsWindowId('other-window')).toBe(false);
  });

  it('resolves active window for API client, Database Explorer, Design & Assets, and Activity & Logs', () => {
    const desktopId = 'd1';

    // API Client
    const apiWindow = resolveActiveWindow({
      focusedWindowId: getApiClientWindowId(desktopId),
      desktopId,
      agentSessions: [],
      browserSessions: [],
      filesWindowOpen: false,
      editorWindowOpen: false,
      sourceControlWindowOpen: false,
      devServersWindowOpen: false,
      notesWindowOpen: false,
      kanbanWindowOpen: false,
      apiClientWindowOpen: true
    });
    expect(apiWindow.kind).toBe('api-client');
    expect(apiWindow.title).toBe('API Client');

    // Database Explorer
    const dbWindow = resolveActiveWindow({
      focusedWindowId: getDatabaseWindowId(desktopId),
      desktopId,
      agentSessions: [],
      browserSessions: [],
      filesWindowOpen: false,
      editorWindowOpen: false,
      sourceControlWindowOpen: false,
      devServersWindowOpen: false,
      notesWindowOpen: false,
      kanbanWindowOpen: false,
      databaseWindowOpen: true
    });
    expect(dbWindow.kind).toBe('database');
    expect(dbWindow.title).toBe('Database Explorer');

    // Design & Assets
    const designWindow = resolveActiveWindow({
      focusedWindowId: getDesignWindowId(desktopId),
      desktopId,
      agentSessions: [],
      browserSessions: [],
      filesWindowOpen: false,
      editorWindowOpen: false,
      sourceControlWindowOpen: false,
      devServersWindowOpen: false,
      notesWindowOpen: false,
      kanbanWindowOpen: false,
      designWindowOpen: true
    });
    expect(designWindow.kind).toBe('design');
    expect(designWindow.title).toBe('Design & Assets');

    // Activity & Logs
    const activityWindow = resolveActiveWindow({
      focusedWindowId: getActivityLogsWindowId(desktopId),
      desktopId,
      agentSessions: [],
      browserSessions: [],
      filesWindowOpen: false,
      editorWindowOpen: false,
      sourceControlWindowOpen: false,
      devServersWindowOpen: false,
      notesWindowOpen: false,
      kanbanWindowOpen: false,
      activityLogsWindowOpen: true
    });
    expect(activityWindow.kind).toBe('activity-logs');
    expect(activityWindow.title).toBe('Activity & Logs');
  });

  it('provides menu bar actions for API client, Database Explorer, Design & Assets, and Activity & Logs', () => {
    const apiMenus = getMenusForKind('api-client');
    expect(apiMenus.some((m) => m.label === 'Request')).toBe(true);
    const requestMenu = apiMenus.find((m) => m.label === 'Request');
    expect(requestMenu?.items.some((i) => i.id === 'api-client.send')).toBe(true);

    const dbMenus = getMenusForKind('database');
    expect(dbMenus.some((m) => m.label === 'Query')).toBe(true);
    const queryMenu = dbMenus.find((m) => m.label === 'Query');
    expect(queryMenu?.items.some((i) => i.id === 'database.run')).toBe(true);

    const designMenus = getMenusForKind('design');
    expect(designMenus.some((m) => m.label === 'Design')).toBe(true);
    const designMenu = designMenus.find((m) => m.label === 'Design');
    expect(designMenu?.items.some((i) => i.id === 'design.refresh')).toBe(true);

    const activityMenus = getMenusForKind('activity-logs');
    expect(activityMenus.some((m) => m.label === 'Logs')).toBe(true);
    const logsMenu = activityMenus.find((m) => m.label === 'Logs');
    expect(logsMenu?.items.some((i) => i.id === 'activity.refresh')).toBe(true);
    expect(logsMenu?.items.some((i) => i.id === 'activity.export')).toBe(true);
  });
});

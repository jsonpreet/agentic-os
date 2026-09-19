import { ActiveWindowKind } from './active-window.js';

export interface MenuBarMenuItem {
  id: string;
  label: string;
  shortcut?: string;
}

export interface MenuBarMenu {
  label: string;
  items: MenuBarMenuItem[];
}

const WINDOW_ITEMS: MenuBarMenuItem[] = [
  { id: 'window.minimize', label: 'Minimize' },
  { id: 'window.close', label: 'Close Window' }
];

export function getMenusForKind(kind: ActiveWindowKind): MenuBarMenu[] {
  switch (kind) {
    case 'desktop':
      return [
        {
          label: 'File',
          items: [
            { id: 'desktop.new-workspace', label: 'New Workspace' },
            { id: 'desktop.open-files', label: 'Files' },
            { id: 'desktop.open-editor', label: 'Editor' },
            { id: 'desktop.open-browser', label: 'Browser' },
            { id: 'desktop.settings', label: 'Settings', shortcut: '⌘,' }
          ]
        },
        {
          label: 'View',
          items: [{ id: 'desktop.command-palette', label: 'Command Palette', shortcut: '⌘K' }]
        }
      ];
    case 'agent':
      return [
        {
          label: 'Agent',
          items: [
            { id: 'agent.interrupt', label: 'Interrupt' },
            { id: 'agent.rename', label: 'Rename' }
          ]
        },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'browser':
      return [
        {
          label: 'Browser',
          items: [{ id: 'browser.new-tab', label: 'New Tab' }]
        },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'files':
      return [
        {
          label: 'File',
          items: [{ id: 'files.open-editor', label: 'Open in Editor' }]
        },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'editor':
      return [
        {
          label: 'File',
          items: [{ id: 'editor.save', label: 'Save', shortcut: '⌘S' }]
        },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'source-control':
      return [
        {
          label: 'Git',
          items: [{ id: 'git.refresh', label: 'Refresh Status' }]
        },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'dev-servers':
      return [
        { label: 'Server', items: [{ id: 'dev-servers.refresh', label: 'Refresh' }] },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'notes':
      return [
        { label: 'Note', items: [{ id: 'notes.new', label: 'New Note' }] },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'kanban':
      return [
        { label: 'Board', items: [{ id: 'kanban.new-task', label: 'New Task' }] },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'api-client':
      return [
        {
          label: 'Request',
          items: [
            { id: 'api-client.new', label: 'New Request' },
            { id: 'api-client.send', label: 'Send Request', shortcut: '⌘↵' }
          ]
        },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'database':
      return [
        {
          label: 'Query',
          items: [{ id: 'database.run', label: 'Run Query', shortcut: '⌘↵' }]
        },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'design':
      return [
        {
          label: 'Design',
          items: [{ id: 'design.refresh', label: 'Refresh Overview' }]
        },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    case 'activity-logs':
      return [
        {
          label: 'Logs',
          items: [
            { id: 'activity.refresh', label: 'Refresh Events', shortcut: '⌘R' },
            { id: 'activity.clear', label: 'Clear Logs' },
            { id: 'activity.export', label: 'Export JSON', shortcut: '⌘E' }
          ]
        },
        { label: 'Window', items: WINDOW_ITEMS }
      ];
    default:
      return [];
  }
}

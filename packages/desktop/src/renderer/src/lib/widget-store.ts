export type DesktopWidgetId =
  | 'running-agents'
  | 'notifications'
  | 'quick-note'
  | 'dev-servers'
  | 'kanban-tasks';

export interface DesktopWidgetLayout {
  enabled: DesktopWidgetId[];
  quickNote: string;
}

const DEFAULT_LAYOUT: DesktopWidgetLayout = {
  enabled: ['running-agents', 'notifications', 'quick-note', 'dev-servers', 'kanban-tasks'],
  quickNote: ''
};

function storageKey(desktopId: string): string {
  return `agentic:widgets:${desktopId}`;
}

export function getWidgetLayout(desktopId: string | null): DesktopWidgetLayout {
  if (!desktopId) return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(storageKey(desktopId));
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as DesktopWidgetLayout;
    return {
      enabled: parsed.enabled ?? DEFAULT_LAYOUT.enabled,
      quickNote: parsed.quickNote ?? ''
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveWidgetLayout(desktopId: string, layout: DesktopWidgetLayout): void {
  localStorage.setItem(storageKey(desktopId), JSON.stringify(layout));
}

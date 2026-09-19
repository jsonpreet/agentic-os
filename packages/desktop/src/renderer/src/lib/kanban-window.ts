export function getKanbanWindowId(desktopId: string): string {
  return `kanban-${desktopId}`;
}

export function isKanbanWindowId(windowId: string): boolean {
  return windowId.startsWith('kanban-');
}

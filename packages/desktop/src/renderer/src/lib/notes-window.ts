export function getNotesWindowId(desktopId: string): string {
  return `notes-${desktopId}`;
}

export function isNotesWindowId(windowId: string): boolean {
  return windowId.startsWith('notes-');
}

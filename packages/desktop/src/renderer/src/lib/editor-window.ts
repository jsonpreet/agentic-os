export function getEditorWindowId(desktopId: string): string {
  return `editor-${desktopId}`;
}

export function isEditorWindowId(windowId: string): boolean {
  return windowId.startsWith('editor-');
}

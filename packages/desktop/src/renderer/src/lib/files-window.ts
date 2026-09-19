export function getFilesWindowId(desktopId: string): string {
  return `files-${desktopId}`;
}

export function isFilesWindowId(windowId: string): boolean {
  return windowId.startsWith('files-');
}

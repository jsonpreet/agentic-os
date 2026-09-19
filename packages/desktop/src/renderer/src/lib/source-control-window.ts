export function getSourceControlWindowId(desktopId: string): string {
  return `source-control-${desktopId}`;
}

export function isSourceControlWindowId(windowId: string): boolean {
  return windowId.startsWith('source-control-');
}

export function getBrowserWindowId(desktopId: string): string {
  return `browser-app-${desktopId}`;
}

export function isBrowserWindowId(windowId: string): boolean {
  return windowId.startsWith('browser-app-');
}

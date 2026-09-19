export function getDevServersWindowId(desktopId: string): string {
  return `dev-servers-${desktopId}`;
}

export function isDevServersWindowId(windowId: string): boolean {
  return windowId.startsWith('dev-servers-');
}

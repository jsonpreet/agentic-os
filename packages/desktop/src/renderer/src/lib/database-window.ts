export function getDatabaseWindowId(desktopId: string): string {
  return `database-${desktopId}`;
}

export function isDatabaseWindowId(windowId: string): boolean {
  return windowId.startsWith('database-');
}

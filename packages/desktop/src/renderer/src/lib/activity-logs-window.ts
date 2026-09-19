export function getActivityLogsWindowId(desktopId: string): string {
  return `activity-logs-${desktopId}`;
}

export function isActivityLogsWindowId(windowId: string): boolean {
  return windowId.startsWith('activity-logs-');
}

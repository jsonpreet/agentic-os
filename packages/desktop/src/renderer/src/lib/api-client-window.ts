export function getApiClientWindowId(desktopId: string): string {
  return `api-client-${desktopId}`;
}

export function isApiClientWindowId(windowId: string): boolean {
  return windowId.startsWith('api-client-');
}

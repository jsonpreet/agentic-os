export function getDesignWindowId(desktopId: string): string {
  return `design-${desktopId}`;
}

export function isDesignWindowId(windowId: string): boolean {
  return windowId.startsWith('design-');
}

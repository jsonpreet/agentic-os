export type DesktopType = 'build' | 'design' | 'research' | 'review' | 'custom';

export interface Desktop {
  id: string;
  workspaceId: string;
  name: string;
  type: DesktopType;
  order: number;
  createdAt: number;
}

export interface Workspace {
  id: string;
  name: string;
  icon?: string;
  repositories: string[];
  activeDesktopId?: string;
  createdAt: number;
  updatedAt: number;
}

export type WindowState = 'normal' | 'minimized' | 'maximized';

export interface WindowLayout {
  windowId: string;
  desktopId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: WindowState;
  zIndex: number;
  updatedAt: number;
}

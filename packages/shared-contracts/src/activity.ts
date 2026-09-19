export type ActivityCategory =
  | 'agent'
  | 'git'
  | 'dev_server'
  | 'browser'
  | 'network'
  | 'database'
  | 'system';

export type ActivitySeverity = 'info' | 'warn' | 'error' | 'success';

export interface ActivityEvent {
  id: string;
  workspaceId?: string | null;
  desktopId?: string | null;
  category: ActivityCategory;
  severity: ActivitySeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: number;
}

export interface CreateActivityEventParams {
  workspaceId?: string | null;
  desktopId?: string | null;
  category: ActivityCategory;
  severity: ActivitySeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
}

export interface ActivityEventQuery {
  workspaceId?: string;
  desktopId?: string;
  category?: ActivityCategory;
  severity?: ActivitySeverity;
  search?: string;
  limit?: number;
  offset?: number;
}

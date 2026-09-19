export type NotificationType =
  | 'completion'
  | 'failure'
  | 'approval'
  | 'dev_server_failure'
  | 'usage_threshold'
  | 'device_disconnected';

export interface AgenticNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  genericPushBody: string;
  sessionId?: string;
  desktopId?: string;
  workspaceId?: string;
  read: boolean;
  createdAt: number;
}

export interface ListNotificationsParams {
  limit?: number;
  unreadOnly?: boolean;
}

export interface MarkNotificationReadParams {
  notificationId: string;
}

export interface DismissNotificationParams {
  notificationId: string;
}

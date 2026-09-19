import { nanoid } from 'nanoid';
import {
  AgenticNotification,
  AgentStatus,
  DevServerStatus,
  ListNotificationsParams,
  NotificationType
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';

const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export interface RecordNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  genericPushBody: string;
  sessionId?: string;
  desktopId?: string;
  workspaceId?: string;
  dedupeKey: string;
}

export class NotificationService {
  constructor(private db: EngineDatabase) {}

  listNotifications(params: ListNotificationsParams = {}): AgenticNotification[] {
    const limit = params.limit ?? 50;
    return this.db.listNotifications(limit, params.unreadOnly ?? false);
  }

  getUnreadCount(): number {
    return this.db.countUnreadNotifications();
  }

  markRead(notificationId: string): AgenticNotification | null {
    return this.db.markNotificationRead(notificationId);
  }

  markAllRead(): number {
    return this.db.markAllNotificationsRead();
  }

  dismiss(notificationId: string): boolean {
    return this.db.dismissNotification(notificationId);
  }

  record(input: RecordNotificationInput): AgenticNotification | null {
    const recent = this.db.findRecentNotificationByDedupeKey(
      input.dedupeKey,
      Date.now() - DEDUPE_WINDOW_MS
    );
    if (recent) {
      return null;
    }

    const notification: AgenticNotification = {
      id: `notif-${nanoid()}`,
      type: input.type,
      title: input.title,
      body: input.body,
      genericPushBody: input.genericPushBody,
      sessionId: input.sessionId,
      desktopId: input.desktopId,
      workspaceId: input.workspaceId,
      read: false,
      createdAt: Date.now()
    };
    this.db.saveNotification(notification, input.dedupeKey);
    return notification;
  }

  handleAgentStatusChange(
    sessionId: string,
    status: AgentStatus,
    previousStatus?: AgentStatus
  ): AgenticNotification | null {
    const session = this.db.getAgentSession(sessionId);
    if (!session) return null;

    if (status === 'awaiting_approval') {
      return this.record({
        type: 'approval',
        title: `${session.name} needs approval`,
        body: `${session.name} is waiting for your response.`,
        genericPushBody: 'An agent needs your approval.',
        sessionId,
        desktopId: session.desktopId,
        workspaceId: session.workspaceId,
        dedupeKey: `approval:${sessionId}`
      });
    }

    if (previousStatus === 'working' && status === 'idle') {
      return this.record({
        type: 'completion',
        title: `${session.name} finished`,
        body: `${session.name} is idle and ready for the next instruction.`,
        genericPushBody: 'An agent finished a task.',
        sessionId,
        desktopId: session.desktopId,
        workspaceId: session.workspaceId,
        dedupeKey: `completion:${sessionId}:${session.updatedAt}`
      });
    }

    if (status === 'interrupted' || status === 'terminated') {
      return this.record({
        type: 'failure',
        title: `${session.name} stopped`,
        body: `${session.name} is ${status}.`,
        genericPushBody: 'An agent session stopped unexpectedly.',
        sessionId,
        desktopId: session.desktopId,
        workspaceId: session.workspaceId,
        dedupeKey: `failure:${sessionId}:${status}`
      });
    }

    return null;
  }

  handleDevServerStatus(
    sessionId: string,
    status: DevServerStatus,
    name: string,
    desktopId?: string
  ): AgenticNotification | null {
    if (status !== 'failed') return null;

    return this.record({
      type: 'dev_server_failure',
      title: `Dev server failed: ${name}`,
      body: `${name} exited unexpectedly.`,
      genericPushBody: 'A dev server failed.',
      desktopId,
      dedupeKey: `dev-server-failed:${sessionId}`
    });
  }

  handleRelayDisconnected(): AgenticNotification | null {
    return this.record({
      type: 'device_disconnected',
      title: 'Relay disconnected',
      body: 'Remote viewers lost the live connection to this host.',
      genericPushBody: 'Your device disconnected from relay.',
      dedupeKey: `relay-disconnected:${Date.now()}`
    });
  }
}

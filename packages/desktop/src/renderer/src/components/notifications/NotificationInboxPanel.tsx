import React from 'react';
import { AgenticNotification } from '@agentic/shared-contracts';
import { CheckCheck, X } from 'lucide-react';

interface NotificationInboxPanelProps {
  notifications: AgenticNotification[];
  unreadCount: number;
  loading: boolean;
  onMarkAllRead: () => void;
  onOpen: (notification: AgenticNotification) => void;
  onDismiss: (notificationId: string) => void;
}

function formatWhen(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export const NotificationInboxPanel: React.FC<NotificationInboxPanelProps> = ({
  notifications,
  unreadCount,
  loading,
  onMarkAllRead,
  onOpen,
  onDismiss
}) => (
  <div className="w-80 max-h-[60vh] overflow-hidden mac-menu-popover z-[80]">
    <div className="flex items-center justify-between px-3 py-2 border-b mac-menu-divider">
      <p className="mac-menu-heading">Notifications</p>
      <button
        type="button"
        onClick={onMarkAllRead}
        disabled={loading || unreadCount === 0}
        className="flex items-center gap-1 text-[11px] mac-menu-subtext hover:opacity-80 disabled:opacity-40"
      >
        <CheckCheck className="w-3 h-3" />
        Mark all read
      </button>
    </div>

    <div className="overflow-y-auto max-h-[calc(60vh-40px)]">
      {notifications.length === 0 ? (
        <p className="px-3 py-6 text-xs mac-menu-subtext text-center">No notifications yet.</p>
      ) : (
        notifications.map((notification) => (
          <div
            key={notification.id}
            className={`px-3 py-2.5 border-b mac-menu-divider ${
              notification.read ? 'opacity-70' : 'bg-[var(--mac-menu-hover)]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => onOpen(notification)}
                className="flex-1 text-left"
              >
                <p className="text-xs font-medium mac-menu-heading">{notification.title}</p>
                <p className="text-[11px] mac-menu-subtext mt-0.5">{notification.body}</p>
                <p className="text-[10px] mac-menu-subtext mt-1 opacity-80">
                  {formatWhen(notification.createdAt)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onDismiss(notification.id)}
                className="p-1 mac-menu-subtext hover:opacity-80"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

import React, { useCallback, useEffect, useState } from 'react';
import { AgenticNotification } from '@agentic/shared-contracts';
import { Bell, CheckCheck, X } from 'lucide-react';

interface NotificationInboxProps {
  onFocusSession?: (sessionId: string) => void;
}

function formatWhen(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export const NotificationInbox: React.FC<NotificationInboxProps> = ({ onFocusSession }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AgenticNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!window.agenticApi) return;
    setLoading(true);
    try {
      const [items, count] = await Promise.all([
        window.agenticApi.listNotifications({ limit: 30 }),
        window.agenticApi.getUnreadNotificationCount()
      ]);
      setNotifications(items);
      setUnreadCount(count);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = window.agenticApi?.onNotificationCreated(() => {
      refresh();
    });
    return () => unsubscribe?.();
  }, [refresh]);

  const handleMarkAllRead = async () => {
    if (!window.agenticApi) return;
    await window.agenticApi.markAllNotificationsRead();
    await refresh();
  };

  const handleOpen = async (notification: AgenticNotification) => {
    if (!window.agenticApi) return;
    if (!notification.read) {
      await window.agenticApi.markNotificationRead({ notificationId: notification.id });
    }
    if (notification.sessionId && onFocusSession) {
      onFocusSession(notification.sessionId);
    }
    await refresh();
    setOpen(false);
  };

  const handleDismiss = async (notificationId: string) => {
    if (!window.agenticApi) return;
    await window.agenticApi.dismissNotification({ notificationId });
    await refresh();
  };

  return (
    <div className="fixed top-4 right-4 z-50 titlebar-no-drag">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) refresh();
        }}
        className="relative p-2 rounded-xl glass-chip text-[var(--glass-text)] hover:text-[var(--glass-text)]"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-semibold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 max-h-[60vh] overflow-hidden rounded-xl glass-popover shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--glass-border-subtle)]">
            <p className="text-xs font-medium text-[var(--glass-text)]">Notifications</p>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={loading || unreadCount === 0}
              className="flex items-center gap-1 text-[11px] text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] disabled:opacity-40"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(60vh-40px)]">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-xs text-[var(--glass-text-muted)] text-center">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-3 py-2.5 border-b border-[var(--glass-border-subtle)] ${
                    notification.read ? 'opacity-70' : 'bg-[var(--glass-hover)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpen(notification)}
                      className="flex-1 text-left"
                    >
                      <p className="text-xs font-medium text-[var(--glass-text)]">{notification.title}</p>
                      <p className="text-[11px] text-[var(--glass-text-muted)] mt-0.5">{notification.body}</p>
                      <p className="text-[10px] text-[var(--glass-text-muted)] mt-1">{formatWhen(notification.createdAt)}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(notification.id)}
                      className="p-1 text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]"
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
      )}
    </div>
  );
};

import { useCallback, useEffect, useState } from 'react';
import { AgenticNotification } from '@agentic/shared-contracts';

export function useNotificationInbox() {
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

  const markAllRead = useCallback(async () => {
    if (!window.agenticApi) return;
    await window.agenticApi.markAllNotificationsRead();
    await refresh();
  }, [refresh]);

  const openNotification = useCallback(
    async (notification: AgenticNotification) => {
      if (!window.agenticApi) return notification;
      if (!notification.read) {
        await window.agenticApi.markNotificationRead({ notificationId: notification.id });
      }
      await refresh();
      return notification;
    },
    [refresh]
  );

  const dismissNotification = useCallback(
    async (notificationId: string) => {
      if (!window.agenticApi) return;
      await window.agenticApi.dismissNotification({ notificationId });
      await refresh();
    },
    [refresh]
  );

  return {
    notifications,
    unreadCount,
    loading,
    refresh,
    markAllRead,
    openNotification,
    dismissNotification
  };
}

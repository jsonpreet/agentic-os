import React, { useState } from 'react';
import { Workspace } from '@agentic/shared-contracts';
import { Bell } from 'lucide-react';
import { ActiveWindowInfo } from '../../lib/active-window.js';
import { getMenusForKind } from '../../lib/menu-bar-menus.js';
import { NotificationInboxPanel } from '../notifications/NotificationInboxPanel.js';
import { useNotificationInbox } from '../notifications/useNotificationInbox.js';
import { MenuBarBattery } from './MenuBarBattery.js';
import { MenuBarClock } from './MenuBarClock.js';
import { MenuBarMenuDropdown } from './MenuBarMenuDropdown.js';
import { MenuBarUsagePanel } from './MenuBarUsagePanel.js';

interface MacMenuBarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWindow: ActiveWindowInfo;
  onSelectWorkspace: (workspaceId: string) => void;
  onMenuAction: (actionId: string) => void;
  onFocusSession?: (sessionId: string) => void;
}

export const MacMenuBar: React.FC<MacMenuBarProps> = ({
  workspaces,
  activeWorkspaceId,
  activeWindow,
  onSelectWorkspace,
  onMenuAction,
  onFocusSession
}) => {
  const [openMenuLabel, setOpenMenuLabel] = useState<string | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const inbox = useNotificationInbox();

  const menus = getMenusForKind(activeWindow.kind);
  const appTitle = activeWindow.kind === 'desktop' ? 'Agentic' : activeWindow.title;
  const menuOpen = openMenuLabel !== null || usageOpen || notificationsOpen;

  const closeDropdowns = () => {
    setOpenMenuLabel(null);
    setUsageOpen(false);
    setNotificationsOpen(false);
  };

  const toggleUsage = () => {
    setOpenMenuLabel(null);
    setNotificationsOpen(false);
    setUsageOpen((v) => !v);
  };

  const toggleNotifications = () => {
    setOpenMenuLabel(null);
    setUsageOpen(false);
    setNotificationsOpen((v) => {
      if (!v) inbox.refresh();
      return !v;
    });
  };

  return (
    <>
      {menuOpen && (
        <div
          className="fixed inset-0 top-[28px] z-[65] titlebar-no-drag"
          onClick={() => closeDropdowns()}
          aria-hidden
        />
      )}
    <header
      className="fixed top-0 inset-x-0 h-[28px] z-[70] glass-menubar flex items-center titlebar-drag"
      data-tauri-drag-region
      onClick={() => closeDropdowns()}
    >
      {/* Left: workspace numbers + app name + menus (macOS order) */}
      <div
        className="flex items-center gap-1 min-w-0 flex-1 pl-[76px] titlebar-no-drag"
        onClick={(e) => e.stopPropagation()}
      >
        {workspaces.map((ws, index) => {
          const isActive = ws.id === activeWorkspaceId;
          return (
            <button
              key={ws.id}
              type="button"
              title={ws.name}
              onClick={() => {
                closeDropdowns();
                onSelectWorkspace(ws.id);
              }}
              className={`min-w-[16px] h-[16px] rounded px-0.5 text-[10px] transition menubar-hover ${
                isActive ? 'menubar-ws-active' : 'menubar-text-muted'
              }`}
            >
              {index + 1}
            </button>
          );
        })}

        <span className="w-px h-3 mx-1 shrink-0 bg-current opacity-25 menubar-text-muted" aria-hidden />

        <span className="text-[13px] menubar-text menubar-title truncate shrink-0 max-w-[160px] px-1">
          {appTitle}
        </span>

        <div className="flex items-center min-w-0">
          {menus.map((menu) => (
            <MenuBarMenuDropdown
              key={menu.label}
              menu={menu}
              open={openMenuLabel === menu.label}
              onToggle={() => {
                setUsageOpen(false);
                setNotificationsOpen(false);
                setOpenMenuLabel((current) => (current === menu.label ? null : menu.label));
              }}
              onAction={(actionId) => {
                onMenuAction(actionId);
                setOpenMenuLabel(null);
              }}
            />
          ))}
        </div>
      </div>

      {/* Right: status cluster */}
      <div
        className="flex items-center gap-1.5 pr-3 titlebar-no-drag shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <MenuBarUsagePanel open={usageOpen} onToggle={toggleUsage} />
        <MenuBarBattery />
        <div className="relative">
          <button
            type="button"
            onClick={toggleNotifications}
            className="relative p-0.5 rounded menubar-text menubar-hover transition"
            title="Notifications"
          >
            <Bell className="w-3.5 h-3.5 drop-shadow-sm" strokeWidth={2} />
            {inbox.unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-[9px] font-semibold text-white flex items-center justify-center shadow-sm">
                {inbox.unreadCount > 9 ? '9+' : inbox.unreadCount}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute top-full right-0 mt-1">
              <NotificationInboxPanel
                notifications={inbox.notifications}
                unreadCount={inbox.unreadCount}
                loading={inbox.loading}
                onMarkAllRead={inbox.markAllRead}
                onOpen={async (notification) => {
                  await inbox.openNotification(notification);
                  if (notification.sessionId && onFocusSession) {
                    onFocusSession(notification.sessionId);
                  }
                  setNotificationsOpen(false);
                }}
                onDismiss={inbox.dismissNotification}
              />
            </div>
          )}
        </div>
        <MenuBarClock />
      </div>
    </header>
    </>
  );
};

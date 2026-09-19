import React from 'react';
import { MenuBarMenu } from '../../lib/menu-bar-menus.js';

interface MenuBarMenuDropdownProps {
  menu: MenuBarMenu;
  open: boolean;
  onToggle: () => void;
  onAction: (actionId: string) => void;
}

export const MenuBarMenuDropdown: React.FC<MenuBarMenuDropdownProps> = ({
  menu,
  open,
  onToggle,
  onAction
}) => (
  <div className="relative">
    <button
      type="button"
      onClick={onToggle}
      className={`px-2 py-0.5 rounded text-[13px] transition titlebar-no-drag ${
        open ? 'menubar-text menubar-hover' : 'menubar-text-muted menubar-hover'
      }`}
    >
      {menu.label}
    </button>
    {open && (
      <div className="absolute top-full left-0 mt-1 min-w-[180px] mac-menu-popover titlebar-no-drag z-[80]">
        {menu.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onAction(item.id)}
            className="w-full flex items-center justify-between gap-3 px-2.5 py-1 rounded mac-menu-item"
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="mac-menu-shortcut">{item.shortcut}</span>}
          </button>
        ))}
      </div>
    )}
  </div>
);

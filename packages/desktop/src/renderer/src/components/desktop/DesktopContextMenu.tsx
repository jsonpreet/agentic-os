import React, { useEffect, useRef } from 'react';
import { Image, Palette } from 'lucide-react';
import {
  BUILTIN_WALLPAPERS,
  WallpaperSelection
} from '../../lib/wallpaper.js';

interface DesktopContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onOpenAppearanceSettings: () => void;
  onWallpaperChange: (selection: WallpaperSelection) => void;
  currentWallpaper: WallpaperSelection;
}

export const DesktopContextMenu: React.FC<DesktopContextMenuProps> = ({
  x,
  y,
  onClose,
  onOpenAppearanceSettings,
  onWallpaperChange,
  currentWallpaper
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const menuWidth = 220;
  const menuHeight = 320;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      style={{ left, top }}
      className="fixed z-50 w-56 glass-popover rounded-xl p-1.5 shadow-2xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        onClick={() => {
          onOpenAppearanceSettings();
          onClose();
        }}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition text-left"
      >
        <Palette className="w-4 h-4 text-primary" />
        Wallpaper Settings...
      </button>

      <div className="h-px bg-[var(--glass-border-subtle)] my-1" />

      <div className="text-[10px] font-semibold text-[var(--glass-text-muted)] px-2 py-1 uppercase tracking-wider">
        Quick Wallpapers
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-1 pb-1">
        {BUILTIN_WALLPAPERS.map((wp) => {
          const isActive =
            currentWallpaper.kind === 'builtin' && currentWallpaper.id === wp.id;
          return (
            <button
              key={wp.id}
              onClick={() => {
                onWallpaperChange({ kind: 'builtin', id: wp.id });
                onClose();
              }}
              title={wp.name}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                isActive ? 'border-primary ring-1 ring-primary/40' : 'border-[var(--glass-border)] hover:border-[var(--glass-border)]'
              }`}
            >
              <div
                className={`absolute inset-0 ${wp.previewClass} ${wp.id === 'aurora' ? 'wallpaper-animated' : ''}`}
              />
            </button>
          );
        })}
      </div>

      <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] text-[var(--glass-text-muted)]">
        <Image className="w-3 h-3" />
        Right-click desktop · per-desktop wallpaper
      </div>
    </div>
  );
};

import { WallpaperSelection, getBuiltinWallpaper } from './wallpaper.js';

export type WallpaperTone = 'light' | 'dark';

const BUILTIN_TONES: Record<string, WallpaperTone> = {
  sonoma: 'dark',
  sequoia: 'dark',
  monterey: 'dark',
  aurora: 'dark',
  garden: 'light',
  midnight: 'dark'
};

export function getWallpaperTone(selection: WallpaperSelection): WallpaperTone {
  if (selection.kind === 'builtin') {
    return BUILTIN_TONES[selection.id] ?? 'dark';
  }
  return 'dark';
}

export function applyWallpaperTone(tone: WallpaperTone): void {
  document.documentElement.dataset.uiTone = tone;
}

/** Apply default tone on startup before React hydrates wallpaper state. */
export function applyDefaultWallpaperTone(): void {
  applyWallpaperTone('dark');
}

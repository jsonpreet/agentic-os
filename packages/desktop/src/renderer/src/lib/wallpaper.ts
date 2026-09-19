export type WallpaperMediaType = 'image' | 'video';

export type WallpaperSelection =
  | { kind: 'builtin'; id: string }
  | { kind: 'custom'; storeId: string; mediaType: WallpaperMediaType; name: string };

export type WallpaperTone = 'light' | 'dark';

export interface BuiltinWallpaper {
  id: string;
  name: string;
  mediaType: WallpaperMediaType;
  tone: WallpaperTone;
  /** CSS class for gradient/animated builtins, or asset URL for image/video */
  previewClass?: string;
  src?: string;
  description?: string;
}

export const BUILTIN_WALLPAPERS: BuiltinWallpaper[] = [
  {
    id: 'sonoma',
    name: 'Sonoma',
    mediaType: 'image',
    tone: 'dark',
    previewClass: 'wallpaper-builtin-sonoma',
    description: 'Cool blue-purple macOS-style gradient'
  },
  {
    id: 'sequoia',
    name: 'Sequoia',
    mediaType: 'image',
    tone: 'dark',
    previewClass: 'wallpaper-builtin-sequoia',
    description: 'Warm sunset tones'
  },
  {
    id: 'monterey',
    name: 'Monterey',
    mediaType: 'image',
    tone: 'dark',
    previewClass: 'wallpaper-builtin-monterey',
    description: 'Deep ocean blues'
  },
  {
    id: 'aurora',
    name: 'Aurora',
    mediaType: 'image',
    tone: 'dark',
    previewClass: 'wallpaper-builtin-aurora',
    description: 'Animated northern lights'
  },
  {
    id: 'garden',
    name: 'Garden',
    mediaType: 'image',
    tone: 'light',
    previewClass: 'wallpaper-builtin-garden',
    description: 'Bright lakeside scene (CNVS-style)'
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mediaType: 'image',
    tone: 'dark',
    previewClass: 'wallpaper-builtin-midnight',
    description: 'Subtle dark mesh'
  }
];

export const DEFAULT_WALLPAPER: WallpaperSelection = { kind: 'builtin', id: 'sonoma' };

const STORAGE_PREFIX = 'agentic-wallpaper:';

export function getWallpaperForDesktop(desktopId: string | null): WallpaperSelection {
  if (!desktopId) return DEFAULT_WALLPAPER;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${desktopId}`);
    if (!raw) return DEFAULT_WALLPAPER;
    return JSON.parse(raw) as WallpaperSelection;
  } catch {
    return DEFAULT_WALLPAPER;
  }
}

export function setWallpaperForDesktop(desktopId: string, selection: WallpaperSelection): void {
  localStorage.setItem(`${STORAGE_PREFIX}${desktopId}`, JSON.stringify(selection));
}

export function getBuiltinWallpaper(id: string): BuiltinWallpaper | undefined {
  return BUILTIN_WALLPAPERS.find((w) => w.id === id);
}

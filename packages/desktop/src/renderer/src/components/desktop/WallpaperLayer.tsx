import React, { useEffect, useRef, useState } from 'react';
import {
  BuiltinWallpaper,
  WallpaperSelection,
  getBuiltinWallpaper
} from '../../lib/wallpaper.js';
import { getCustomWallpaperUrl } from '../../lib/wallpaper-store.js';

interface WallpaperLayerProps {
  selection: WallpaperSelection;
}

export const WallpaperLayer: React.FC<WallpaperLayerProps> = ({ selection }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const builtin: BuiltinWallpaper | undefined =
    selection.kind === 'builtin' ? getBuiltinWallpaper(selection.id) : undefined;

  useEffect(() => {
    if (selection.kind !== 'custom') {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setCustomUrl(null);
      return;
    }

    let cancelled = false;
    getCustomWallpaperUrl(selection.storeId).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = url;
      setCustomUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [selection]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // Autoplay may be blocked until user interaction; muted loop usually works.
    });
  }, [customUrl, builtin?.src]);

  const isAnimatedBuiltin = builtin?.previewClass === 'wallpaper-builtin-aurora';

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {selection.kind === 'custom' && customUrl ? (
        selection.mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={customUrl}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={customUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      ) : builtin?.src ? (
        builtin.mediaType === 'video' ? (
          <video
            ref={videoRef}
            src={builtin.src}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={builtin.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      ) : (
        <div
          className={`absolute inset-0 ${builtin?.previewClass ?? 'wallpaper-builtin-sonoma'} ${
            isAnimatedBuiltin ? 'wallpaper-animated' : ''
          }`}
        />
      )}

      {/* Vignette + dim for glass legibility */}
      <div className="absolute inset-0 wallpaper-vignette pointer-events-none" />
    </div>
  );
};

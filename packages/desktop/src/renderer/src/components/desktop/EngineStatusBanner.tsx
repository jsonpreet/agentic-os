import React from 'react';
import { isTauriRuntime } from '../../lib/is-tauri.js';

interface EngineStatusBannerProps {
  engineConnected: boolean;
  engineLoading: boolean;
  engineError?: string | null;
}

export const EngineStatusBanner: React.FC<EngineStatusBannerProps> = ({
  engineConnected,
  engineLoading,
  engineError
}) => {
  if (engineLoading) return null;

  if (!engineConnected) {
    const detail = engineError?.trim();
    return (
      <div className="fixed top-8 inset-x-0 z-[60] px-4 pointer-events-none">
        <div className="mx-auto max-w-2xl rounded-xl border border-[var(--banner-error-border)] bg-[var(--banner-error-bg)] px-4 py-2.5 text-xs text-[var(--banner-error-text)] text-center backdrop-blur-md">
          {detail ? (
            <>Couldn’t start the engine: {detail}</>
          ) : isTauriRuntime() ? (
            <>Engine not connected. Quit and run <code className="font-mono">pnpm dev</code> from the repo root.</>
          ) : (
            <>
              Engine not connected. From the repo root run{' '}
              <code className="font-mono">pnpm dev:web</code> — a plain Vite tab cannot talk to
              the local engine on its own.
            </>
          )}
        </div>
      </div>
    );
  }

  if (isTauriRuntime()) return null;

  return (
    <div className="fixed top-8 inset-x-0 z-[60] px-4 pointer-events-none">
      <div className="mx-auto max-w-xl rounded-xl border border-[var(--banner-info-border)] bg-[var(--banner-info-bg)] px-3 py-1.5 text-[11px] text-[var(--banner-info-text)] text-center backdrop-blur-md">
        Web preview — for the full desktop app use <code className="font-mono">pnpm dev</code>{' '}
        (Tauri).
      </div>
    </div>
  );
};

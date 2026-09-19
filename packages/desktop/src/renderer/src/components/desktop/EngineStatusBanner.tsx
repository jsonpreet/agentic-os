import React from 'react';
import { isTauriRuntime } from '../../lib/is-tauri.js';
import { AlertCircle, Info } from 'lucide-react';

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
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-500/40 bg-stone-900/92 shadow-2xl px-4 py-2.5 text-xs text-red-200 backdrop-blur-xl pointer-events-auto flex items-center justify-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <div className="truncate text-left flex-1">
            {detail ? (
              <span>Couldn’t start the engine: <strong className="font-mono text-red-300">{detail}</strong></span>
            ) : isTauriRuntime() ? (
              <span>Engine not connected. Quit and run <code className="font-mono text-red-300">pnpm dev</code> from the repo root.</span>
            ) : (
              <span>
                Engine not connected. From the repo root run{' '}
                <code className="font-mono text-red-300">pnpm dev:web</code> — a plain Vite tab cannot talk to the local engine on its own.
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isTauriRuntime()) return null;

  return (
    <div className="fixed top-8 inset-x-0 z-[60] px-4 pointer-events-none">
      <div className="mx-auto max-w-xl rounded-2xl border border-amber-500/40 bg-stone-900/92 shadow-2xl px-3 py-1.5 text-[11px] text-amber-200 backdrop-blur-xl flex items-center justify-center gap-2">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>Web preview — for the full desktop app use <code className="font-mono text-amber-300">pnpm dev</code> (Tauri).</span>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { DiscoveredCLI } from '@agentic/shared-contracts';
import { X, RefreshCw, Terminal, CheckCircle2, XCircle, Info } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  discoveredCLIs: DiscoveredCLI[];
  onRescanCLIs: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  discoveredCLIs,
  onRescanCLIs
}) => {
  const [isScanning, setIsScanning] = useState(false);

  if (!isOpen) return null;

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      await onRescanCLIs();
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-elevated border border-white/10 rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center space-x-2.5">
            <Terminal className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-zinc-100">Discovered Agent CLIs</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-start space-x-2 text-xs text-zinc-400 bg-white/5 p-3 rounded-xl border border-white/5 leading-relaxed">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              Agentic Desktop inspects your interactive login shell environment (<code className="text-zinc-300">$SHELL -ilc &lsquo;env&rsquo;</code>) and standard macOS paths to automatically detect installed agent tools.
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {discoveredCLIs.map((cli) => (
              <div
                key={cli.provider}
                className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-zinc-200">{cli.name}</span>
                    <span className="font-mono text-[10px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">
                      {cli.command}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono truncate max-w-sm">
                    {cli.executablePath || 'Not found in PATH'}
                  </div>
                  {cli.version && (
                    <div className="text-[10px] text-zinc-500">
                      Version: {cli.version}
                    </div>
                  )}
                </div>

                <div>
                  {cli.isAvailable ? (
                    <span className="flex items-center space-x-1 text-emerald-400 font-medium text-[11px] bg-emerald-400/10 px-2 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-zinc-500 font-medium text-[11px] bg-white/5 px-2 py-1 rounded-lg">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Not Installed</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <button
            onClick={handleRescan}
            disabled={isScanning}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-white/10 text-xs text-zinc-200 transition font-medium border border-white/5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Rescan Environment'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-xs font-medium text-white transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

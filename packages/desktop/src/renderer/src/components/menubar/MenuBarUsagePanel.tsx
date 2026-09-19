import React, { useCallback, useEffect, useState } from 'react';
import { UsageOverview } from '@agentic/shared-contracts';
import { Activity, RefreshCw } from 'lucide-react';
import { UsageProviderCard } from '../modals/UsageProviderCard.js';

interface MenuBarUsagePanelProps {
  open: boolean;
  onToggle: () => void;
}

export const MenuBarUsagePanel: React.FC<MenuBarUsagePanelProps> = ({ open, onToggle }) => {
  const [overview, setOverview] = useState<UsageOverview | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!window.agenticApi) return;
    setLoading(true);
    try {
      const next = await window.agenticApi.getUsageOverview();
      setOverview(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="p-0.5 rounded menubar-text menubar-hover transition titlebar-no-drag"
        title="Agent usage"
      >
        <Activity className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-72 max-h-[60vh] overflow-hidden mac-menu-popover titlebar-no-drag z-[80]">
          <div className="flex items-center justify-between px-3 py-2 border-b mac-menu-divider">
            <p className="mac-menu-heading">Usage</p>
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1 text-[11px] mac-menu-subtext hover:opacity-80 disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(60vh-40px)]">
            {overview?.message && (
              <p className="text-[11px] mac-menu-subtext px-1">{overview.message}</p>
            )}
            {overview?.providers.map((provider) => (
              <UsageProviderCard key={provider.provider} provider={provider} />
            ))}
            {!overview?.providers.length && (
              <p className="text-xs mac-menu-subtext text-center py-4">
                No usage data yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

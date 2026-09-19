import React, { useCallback, useEffect, useState } from 'react';
import { UsageOverview } from '@agentic/shared-contracts';
import { RefreshCw } from 'lucide-react';
import { UsageProviderCard } from './UsageProviderCard.js';

export const UsageSettingsPanel: React.FC = () => {
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
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--glass-text-muted)] leading-relaxed">{overview?.message}</p>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg glass-chip text-[11px] text-[var(--glass-text)]"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="space-y-2">
        {overview?.providers.map((provider) => (
          <UsageProviderCard key={provider.provider} provider={provider} />
        ))}
      </div>
    </div>
  );
};

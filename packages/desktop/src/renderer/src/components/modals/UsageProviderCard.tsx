import React from 'react';
import { ProviderUsageSnapshot } from '@agentic/shared-contracts';

interface UsageProviderCardProps {
  provider: ProviderUsageSnapshot;
}

export const UsageProviderCard: React.FC<UsageProviderCardProps> = ({ provider }) => (
  <div className="rounded-lg p-3 bg-[var(--glass-hover)] border border-[var(--glass-border-subtle)]">
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium text-[var(--mac-menu-text,var(--glass-text))] capitalize">
        {provider.provider}
      </p>
      <span className="text-[10px] text-[var(--mac-menu-text-muted,var(--glass-text-muted))] uppercase">
        {provider.availability}
      </span>
    </div>
    <p className="text-[11px] text-[var(--glass-text-muted)] mt-1">{provider.message}</p>
    <p className="text-[11px] text-[var(--glass-text-muted)] mt-2">
      Account: {provider.accountLabel} · Active sessions: {provider.activeSessions}
    </p>
  </div>
);

import { AgentProvider } from './agent.js';

export type UsageAvailability = 'available' | 'unavailable' | 'estimated';

export interface ProviderUsageSnapshot {
  provider: AgentProvider;
  accountLabel: string;
  used?: number;
  remaining?: number;
  limit?: number;
  resetAt?: number;
  activeSessions: number;
  lastRefreshedAt?: number;
  source: string;
  availability: UsageAvailability;
  message: string;
}

export interface UsageOverview {
  providers: ProviderUsageSnapshot[];
  message: string;
}

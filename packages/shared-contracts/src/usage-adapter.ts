import { AgentProvider } from './agent.js';
import { ProviderUsageSnapshot } from './usage.js';

export interface UsageAdapterContext {
  provider: AgentProvider;
  executablePath?: string;
  activeSessions: number;
}

export interface UsageAdapter {
  provider: AgentProvider;
  fetch(context: UsageAdapterContext): Promise<ProviderUsageSnapshot>;
}

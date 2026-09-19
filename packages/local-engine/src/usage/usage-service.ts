import { AgentProvider, ProviderUsageSnapshot, UsageOverview } from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';
import { getUsageAdapters } from './provider-usage-adapters.js';
import { unavailableUsage } from './usage-parsers.js';

const STATIC_PROVIDERS: AgentProvider[] = ['cursor', 'custom'];

export class UsageService {
  constructor(private db: EngineDatabase) {}

  async getUsageOverview(): Promise<UsageOverview> {
    const sessions = this.db.getAllAgentSessions();
    const activeByProvider = new Map<AgentProvider, number>();
    const cliByProvider = new Map(
      this.db.getCLIIntegrations().map((cli) => [cli.provider, cli.executablePath ?? undefined])
    );

    for (const session of sessions) {
      if (session.status === 'terminated') continue;
      activeByProvider.set(
        session.provider,
        (activeByProvider.get(session.provider) ?? 0) + 1
      );
    }

    const adapterResults = await Promise.all(
      getUsageAdapters().map((adapter) =>
        adapter.fetch({
          provider: adapter.provider,
          executablePath: cliByProvider.get(adapter.provider),
          activeSessions: activeByProvider.get(adapter.provider) ?? 0
        })
      )
    );

    const staticProviders = STATIC_PROVIDERS.map((provider) =>
      unavailableUsage(
        provider,
        activeByProvider.get(provider) ?? 0,
        provider === 'cursor'
          ? 'Cursor usage is not exposed via CLI yet.'
          : 'Custom provider usage is not tracked.'
      )
    );

    const providers: ProviderUsageSnapshot[] = [...adapterResults, ...staticProviders];
    const connectedCount = providers.filter((provider) => provider.availability === 'available').length;

    return {
      providers,
      message:
        connectedCount > 0
          ? `${connectedCount} provider(s) connected via CLI. Allowance fields appear when adapters expose them.`
          : 'Connect provider CLIs to see account status. Allowance data is never inferred from terminal activity.'
    };
  }
}

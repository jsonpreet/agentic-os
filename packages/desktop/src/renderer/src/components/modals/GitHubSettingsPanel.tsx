import React, { useCallback, useEffect, useState } from 'react';
import { GitHubAuthStatus } from '@agentic/shared-contracts';
import { CheckCircle2, ExternalLink, RefreshCw, XCircle } from 'lucide-react';

export const GitHubSettingsPanel: React.FC = () => {
  const [status, setStatus] = useState<GitHubAuthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!window.agenticApi) return;
    setLoading(true);
    setError(null);
    try {
      const next = await window.agenticApi.getGitHubAuthStatus();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check GitHub status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signedIn = status?.isAuthenticated ?? false;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--glass-text-muted)] leading-relaxed">
        Agentic uses the official <code className="font-mono text-[var(--glass-text)]">gh</code> CLI for
        GitHub sign-in and pull requests. Install{' '}
        <a
          href="https://cli.github.com"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          GitHub CLI
          <ExternalLink className="w-3 h-3" />
        </a>{' '}
        if it is missing, then authenticate once in a terminal.
      </p>

      <div className="glass-chip rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--glass-text)]">Connection status</span>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg glass-chip text-[11px] text-[var(--glass-text)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <p className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {status && (
          <div className="flex items-start gap-2.5">
            {signedIn ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-[var(--glass-text-muted)] shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <p className={signedIn ? 'text-emerald-200' : 'text-[var(--glass-text)]'}>{status.message}</p>
              {status.username && status.hostname && (
                <p className="text-[var(--glass-text-muted)]">
                  {status.username} @ {status.hostname}
                  {status.protocol ? ` · ${status.protocol}` : ''}
                </p>
              )}
              {!status.isInstalled && (
                <p className="text-[var(--glass-text-muted)]">brew install gh</p>
              )}
              {status.isInstalled && !status.isAuthenticated && (
                <p className="text-[var(--glass-text-muted)] font-mono">gh auth login</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

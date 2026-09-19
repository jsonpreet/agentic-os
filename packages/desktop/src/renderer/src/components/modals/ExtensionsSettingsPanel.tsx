import React, { useCallback, useEffect, useState } from 'react';
import { InstalledExtension } from '@agentic/shared-contracts';
import { FolderOpen, RefreshCw } from 'lucide-react';

export const ExtensionsSettingsPanel: React.FC = () => {
  const [extensions, setExtensions] = useState<InstalledExtension[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [installPath, setInstallPath] = useState('');

  const refresh = useCallback(async () => {
    if (!window.agenticApi) return;
    setLoading(true);
    setError(null);
    try {
      const items = await window.agenticApi.listInstalledExtensions();
      setExtensions(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load extensions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleInstall = async () => {
    if (!window.agenticApi || !installPath.trim()) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const installed = await window.agenticApi.installExtension({
        sourcePath: installPath.trim()
      });
      setMessage(`Installed ${installed.manifest.name} v${installed.manifest.version}.`);
      setInstallPath('');
      window.dispatchEvent(new Event('agentic:extensions-changed'));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install extension');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--glass-text-muted)] leading-relaxed">
        Install local extension bundles from a folder containing <code>manifest.json</code>.
        Installed apps live in <code>~/.agentic/extensions/</code>.
      </p>

      <div className="glass-chip rounded-xl p-4 space-y-2">
        <p className="text-xs font-medium text-[var(--glass-text)]">Install extension</p>
        <input
          value={installPath}
          onChange={(event) => setInstallPath(event.target.value)}
          placeholder="/path/to/extension"
          className="w-full text-xs bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-[var(--glass-text)] outline-none font-mono"
        />
        <button
          type="button"
          onClick={handleInstall}
          disabled={loading || !installPath.trim()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl glass-chip text-xs text-[var(--glass-text)] disabled:opacity-40"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Install from path
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--glass-text)]">App library</p>
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
        {extensions.length === 0 ? (
          <p className="text-[11px] text-[var(--glass-text-muted)]">No extensions installed.</p>
        ) : (
          extensions.map((extension) => (
            <div key={extension.manifest.id} className="glass-chip rounded-xl p-3">
              <p className="text-xs font-medium text-[var(--glass-text)]">{extension.manifest.name}</p>
              <p className="text-[11px] text-[var(--glass-text-muted)]">
                v{extension.manifest.version} · SDK {extension.manifest.sdkVersion}
              </p>
              {extension.manifest.description && (
                <p className="text-[11px] text-[var(--glass-text-muted)] mt-1">{extension.manifest.description}</p>
              )}
              <p className="text-[10px] text-[var(--glass-text-muted)] mt-2 font-mono break-all">
                {extension.installPath}
              </p>
              <p className="text-[10px] text-[var(--glass-text-muted)] mt-1">
                Permissions: {extension.manifest.permissions.join(', ') || 'none'}
              </p>
            </div>
          ))
        )}
      </div>

      {message && (
        <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-lg px-3 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
};

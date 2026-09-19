import React, { useCallback, useEffect, useState } from 'react';
import { AccountStatus, PairedDevice, SyncStatus } from '@agentic/shared-contracts';
import { buildRelayViewerUrl } from '../../lib/relay-viewer-client.js';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  HardDrive,
  RefreshCw,
  Shield
} from 'lucide-react';

function formatWhen(timestamp?: number): string {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleString();
}

export const CloudSettingsPanel: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [relayUrlDraft, setRelayUrlDraft] = useState('ws://localhost:3848');
  const [emailDraft, setEmailDraft] = useState('dev@agentic.local');
  const [pairingCodeDraft, setPairingCodeDraft] = useState('');

  const refresh = useCallback(async () => {
    if (!window.agenticApi) return;
    setLoading(true);
    setError(null);
    try {
      const [next, accountStatus] = await Promise.all([
        window.agenticApi.getSyncStatus(),
        window.agenticApi.getAccountStatus()
      ]);
      setStatus(next);
      setAccount(accountStatus);
      if (next.preferences.relayUrl) {
        setRelayUrlDraft(next.preferences.relayUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cloud status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggleLocalOnly = async () => {
    if (!window.agenticApi || !status) return;
    setError(null);
    setMessage(null);
    try {
      const next = await window.agenticApi.updateSyncPreferences({
        localOnlyMode: !status.preferences.localOnlyMode
      });
      setStatus(next);
      setMessage(
        next.preferences.localOnlyMode
          ? 'Local-only mode enabled.'
          : 'Local-only mode disabled — snapshots can be saved.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    }
  };

  const handleConnectRelay = async () => {
    if (!window.agenticApi) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await window.agenticApi.updateSyncPreferences({ relayUrl: relayUrlDraft.trim() });
      const relay = await window.agenticApi.connectRelay({ relayUrl: relayUrlDraft.trim() });
      setMessage(relay.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect relay');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectRelay = async () => {
    if (!window.agenticApi) return;
    setError(null);
    setMessage(null);
    try {
      const relay = await window.agenticApi.disconnectRelay();
      setMessage(relay.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect relay');
    }
  };

  const handleCreateSnapshot = async () => {
    if (!window.agenticApi) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await window.agenticApi.createSyncSnapshot();
      setMessage(`Encrypted snapshot v${result.meta.version} saved locally.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create snapshot');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!window.agenticApi) return;
    if (!confirm('Restore the latest encrypted snapshot? Unsaved catalog changes may be overwritten.')) {
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await window.agenticApi.restoreLatestSyncSnapshot();
      setMessage(
        `Restored snapshot with ${result.notes} notes and ${result.kanbanTasks} kanban tasks.`
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore snapshot');
    } finally {
      setLoading(false);
    }
  };

  const handleShowRecoveryKey = async () => {
    if (!window.agenticApi) return;
    setError(null);
    try {
      const key = await window.agenticApi.getRecoveryKey();
      setRecoveryKey(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recovery key');
    }
  };

  const handleCopyRecoveryKey = async () => {
    if (!recoveryKey) return;
    await navigator.clipboard.writeText(recoveryKey);
    setMessage('Recovery key copied to clipboard.');
  };

  const handleSignIn = async () => {
    if (!window.agenticApi) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const next = await window.agenticApi.signInDev({ email: emailDraft.trim() });
      setAccount(next);
      setMessage(`Signed in as ${next.session?.email}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!window.agenticApi) return;
    setError(null);
    setMessage(null);
    try {
      const next = await window.agenticApi.signOutAccount();
      setAccount(next);
      setMessage('Signed out.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    }
  };

  const handleApprovePairing = async () => {
    if (!window.agenticApi || !pairingCodeDraft.trim()) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const next = await window.agenticApi.approvePairing({ code: pairingCodeDraft.trim() });
      setAccount(next);
      setPairingCodeDraft('');
      setMessage('Device pairing approved.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve pairing');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!window.agenticApi) return;
    if (!confirm('Revoke this device? It will lose relay and cloud access.')) return;
    setError(null);
    setMessage(null);
    try {
      const next = await window.agenticApi.revokePairedDevice({ deviceId });
      setAccount(next);
      setMessage('Device revoked.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke device');
    }
  };

  const connectionIcon =
    status?.connectionState === 'relay_connected'
      ? Cloud
      : status?.connectionState === 'local_snapshot'
        ? HardDrive
        : CloudOff;

  const ConnectionIcon = connectionIcon;

  const viewerUrl =
    status?.device.deviceId && (status.preferences.relayUrl || relayUrlDraft.trim())
      ? buildRelayViewerUrl({
          origin:
            window.location.hostname === 'localhost'
              ? 'http://localhost:5173'
              : window.location.origin,
          relayUrl: status.preferences.relayUrl ?? relayUrlDraft.trim(),
          deviceId: status.device.deviceId
        })
      : null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--glass-text-muted)] leading-relaxed">
        Agentic encrypts workspace catalog, notes, boards, and session metadata before any
        cloud upload. Terminal output and repository files stay on this device by default.
      </p>

      <div className="glass-chip rounded-xl p-4 space-y-3">
        <p className="text-xs font-medium text-[var(--glass-text)]">Account</p>
        {account?.session ? (
          <div className="space-y-2">
            <p className="text-xs text-[var(--glass-text)]">{account.session.email}</p>
            <p className="text-[11px] text-[var(--glass-text-muted)]">{account.message}</p>
            <p className="text-[11px] text-[var(--glass-text-muted)]">
              {account.deviceSlotsUsed}/{account.deviceSlotsLimit} devices ·{' '}
              {account.canUseRelay ? 'relay enabled' : 'relay restricted'}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-lg glass-chip text-[11px] text-[var(--glass-text)]"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-[var(--glass-text-muted)]">
              Dev sign-in registers this device and enables relay under your plan limits.
            </p>
            <input
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="you@example.com"
              className="w-full text-xs bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-[var(--glass-text)] outline-none"
            />
            <button
              type="button"
              onClick={handleSignIn}
              disabled={loading}
              className="px-3 py-2 rounded-xl glass-chip text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)] disabled:opacity-40"
            >
              Sign in (dev)
            </button>
          </div>
        )}
      </div>

      {account?.session && (
        <div className="glass-chip rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-[var(--glass-text)]">Paired devices</p>
          <div className="space-y-2">
            {account.devices
              .filter((device: PairedDevice) => !device.revoked)
              .map((device: PairedDevice) => (
                <div
                  key={device.deviceId}
                  className="flex items-center justify-between text-[11px] text-[var(--glass-text-muted)]"
                >
                  <span>
                    {device.deviceName}
                    {device.deviceId === account.currentDeviceId ? ' (this device)' : ''}
                  </span>
                  {device.deviceId !== account.currentDeviceId && (
                    <button
                      type="button"
                      onClick={() => handleRevokeDevice(device.deviceId)}
                      className="text-amber-300 hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
          </div>
          <div className="flex gap-2">
            <input
              value={pairingCodeDraft}
              onChange={(e) => setPairingCodeDraft(e.target.value.toUpperCase())}
              placeholder="Pairing code"
              className="flex-1 text-xs bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-[var(--glass-text)] outline-none font-mono tracking-widest"
            />
            <button
              type="button"
              onClick={handleApprovePairing}
              disabled={loading || !pairingCodeDraft.trim()}
              className="px-3 py-2 rounded-xl glass-chip text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)] disabled:opacity-40"
            >
              Approve
            </button>
          </div>
        </div>
      )}

      <div className="glass-chip rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--glass-text)]">Cloud status</span>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg glass-chip text-[11px] text-[var(--glass-text)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {status && (
          <div className="flex items-start gap-2.5">
            <ConnectionIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="text-[var(--glass-text)]">{status.message}</p>
              <p className="text-[var(--glass-text-muted)]">
                Device {status.device.deviceName} · {status.device.deviceId.slice(0, 12)}…
              </p>
              <p className="text-[var(--glass-text-muted)]">
                Last snapshot: {formatWhen(status.lastSyncedAt)} · {status.snapshotCount} saved
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="glass-chip rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--glass-text)]">Local-only mode</p>
            <p className="text-[11px] text-[var(--glass-text-muted)] mt-0.5">
              Do not upload progress or allow remote viewing.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleLocalOnly}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition ${
              status?.preferences.localOnlyMode
                ? 'glass-chip-active text-emerald-200'
                : 'glass-chip text-[var(--glass-text)]'
            }`}
          >
            {status?.preferences.localOnlyMode ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="glass-chip rounded-xl p-4 space-y-3">
        <p className="text-xs font-medium text-[var(--glass-text)]">Live relay</p>
        <p className="text-[11px] text-[var(--glass-text-muted)]">
          Stream terminal output to authorized viewers. Run{' '}
          <code className="font-mono">pnpm relay:dev</code> for local development.
        </p>
        <input
          value={relayUrlDraft}
          onChange={(e) => setRelayUrlDraft(e.target.value)}
          placeholder="ws://localhost:3848"
          className="w-full text-xs bg-[var(--glass-hover)] border border-[var(--glass-border)] rounded-lg px-3 py-2 text-[var(--glass-text)] outline-none font-mono"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConnectRelay}
            disabled={loading || status?.preferences.localOnlyMode}
            className="flex-1 px-3 py-2 rounded-xl glass-chip text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)] disabled:opacity-40"
          >
            Connect relay
          </button>
          <button
            type="button"
            onClick={handleDisconnectRelay}
            disabled={loading || status?.relay?.connectionState !== 'connected'}
            className="flex-1 px-3 py-2 rounded-xl glass-chip text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)] disabled:opacity-40"
          >
            Disconnect
          </button>
        </div>
        {status?.relay && (
          <p className="text-[11px] text-[var(--glass-text-muted)]">
            Relay: {status.relay.connectionState} · {status.relay.viewerCount} viewer(s)
          </p>
        )}
        {viewerUrl && (
          <div className="flex gap-2">
            <a
              href={viewerUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center px-3 py-2 rounded-xl glass-chip text-xs text-primary hover:underline"
            >
              Open web viewer
            </a>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(viewerUrl);
                setMessage('Viewer link copied.');
              }}
              className="px-3 py-2 rounded-xl glass-chip text-xs text-[var(--glass-text)]"
            >
              Copy link
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleCreateSnapshot}
          disabled={loading || status?.preferences.localOnlyMode}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl glass-chip text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)] disabled:opacity-40"
        >
          <Shield className="w-3.5 h-3.5 text-primary" />
          Save encrypted snapshot
        </button>
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading || (status?.snapshotCount ?? 0) === 0}
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl glass-chip text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)] disabled:opacity-40"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
          Restore latest
        </button>
      </div>

      <div className="glass-chip rounded-xl p-4 space-y-2">
        <p className="text-xs font-medium text-[var(--glass-text)]">Recovery key</p>
        <p className="text-[11px] text-[var(--glass-text-muted)]">
          Save this key to decrypt snapshots on a new device. Agentic cannot recover it for you.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleShowRecoveryKey}
            className="px-3 py-1.5 rounded-lg glass-chip text-[11px] text-[var(--glass-text)]"
          >
            Show key
          </button>
          {recoveryKey && (
            <button
              type="button"
              onClick={handleCopyRecoveryKey}
              className="px-3 py-1.5 rounded-lg glass-chip text-[11px] text-[var(--glass-text)] inline-flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          )}
        </div>
        {recoveryKey && (
          <code className="block text-[10px] text-[var(--glass-text-muted)] font-mono break-all bg-[var(--glass-hover)] rounded-lg p-2">
            {recoveryKey}
          </code>
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

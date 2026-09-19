import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Cloud, Monitor, Plug, Unplug } from 'lucide-react';
import {
  RelayViewerClient,
  buildRelayViewerUrl,
  createViewerId,
  parseRelayViewerSearch
} from '../../lib/relay-viewer-client.js';

export const RelayViewerPage: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const clientRef = useRef<RelayViewerClient | null>(null);
  const viewerIdRef = useRef(createViewerId());

  const initial = parseRelayViewerSearch(window.location.search);

  const [relayUrl, setRelayUrl] = useState(initial.relayUrl);
  const [deviceId, setDeviceId] = useState(initial.deviceId);
  const [sessionId, setSessionId] = useState(initial.sessionId ?? '');
  const [statusMessage, setStatusMessage] = useState('Enter host device ID and connect.');
  const [hostOnline, setHostOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [lastAck, setLastAck] = useState<string | null>(null);
  const [canType, setCanType] = useState(false);

  const connect = useCallback(async () => {
    if (!deviceId.trim()) {
      setStatusMessage('Device ID is required.');
      return;
    }

    const client = clientRef.current ?? new RelayViewerClient();
    clientRef.current = client;

    try {
      const state = await client.connect({
        relayUrl: relayUrl.trim(),
        deviceId: deviceId.trim(),
        viewerId: viewerIdRef.current,
        viewerName: 'Web viewer'
      });
      setConnected(state.connectionState === 'connected');
      setStatusMessage(state.message);
      setHostOnline(state.hostOnline);
    } catch (error) {
      setConnected(false);
      setStatusMessage(error instanceof Error ? error.message : 'Connection failed.');
    }
  }, [deviceId, relayUrl]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    setConnected(false);
    setCanType(false);
    setStatusMessage('Disconnected.');
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      fontFamily: '"SF Mono", "JetBrains Mono", Menlo, Monaco, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      disableStdin: true,
      theme: {
        background: '#0c0a09',
        foreground: '#e8e4df',
        cursor: '#f59e0b'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('Agentic remote viewer');
    term.writeln('Connect to a host device to stream terminal output.\r\n');

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // layout not ready
      }
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    const client = clientRef.current;
    const term = xtermRef.current;
    if (!client || !term || !connected) return;

    const activeSessionId = sessionId.trim();

    const unsubChunk = client.onTerminalChunk((chunk) => {
      if (activeSessionId && chunk.sessionId !== activeSessionId) return;
      if (!activeSessionId && !sessionId) {
        setSessionId(chunk.sessionId);
      }
      term.write(chunk.data);
    });

    const unsubStatus = client.onAgentStatus((status) => {
      if (activeSessionId && status.sessionId !== activeSessionId) return;
      setCanType(true);
      setStatusMessage(`Session ${status.sessionId.slice(0, 12)}… · ${status.status}`);
    });

    const unsubPresence = client.onPresence((presence) => {
      setHostOnline(presence.hostOnline);
      setStatusMessage(
        presence.hostOnline
          ? `Host online · ${presence.viewerCount} viewer(s)`
          : 'Host offline.'
      );
    });

    const unsubAck = client.onCommandAck((ack) => {
      setLastAck(ack.success ? 'Input delivered.' : ack.message ?? 'Command failed.');
    });

    const dataDisposable = term.onData((data) => {
      const targetSession = sessionId.trim() || activeSessionId;
      if (!targetSession || !canType) return;
      if (data === '\x03') {
        client.sendInterrupt(targetSession);
        return;
      }
      client.sendInput(targetSession, data);
    });

    return () => {
      unsubChunk();
      unsubStatus();
      unsubPresence();
      unsubAck();
      dataDisposable.dispose();
    };
  }, [connected, sessionId, canType]);

  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.disableStdin = !canType;
    }
  }, [canType]);

  useEffect(() => {
    if (initial.deviceId && initial.relayUrl) {
      void connect();
    }
    // Auto-connect once when opened via shared link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewerLink =
    deviceId.trim() && relayUrl.trim()
      ? buildRelayViewerUrl({
          origin: window.location.origin,
          relayUrl: relayUrl.trim(),
          deviceId: deviceId.trim(),
          sessionId: sessionId.trim() || undefined
        })
      : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0c0a09] text-[var(--glass-text)]">
      <header className="shrink-0 border-b border-[var(--glass-border)] px-4 py-3 flex items-center gap-3">
        <Monitor className="w-4 h-4 text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold">Agentic Remote Viewer</h1>
          <p className="text-[11px] text-[var(--glass-text-muted)] truncate">{statusMessage}</p>
        </div>
        <span
          className={`text-[10px] px-2 py-1 rounded-full ${
            connected && hostOnline
              ? 'bg-emerald-500/15 text-emerald-300'
              : connected
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-zinc-500/15 text-[var(--glass-text-muted)]'
          }`}
        >
          {connected ? (hostOnline ? 'Live' : 'Waiting for host') : 'Offline'}
        </span>
      </header>

      <div className="shrink-0 px-4 py-3 border-b border-[var(--glass-border-subtle)] grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          value={relayUrl}
          onChange={(e) => setRelayUrl(e.target.value)}
          placeholder="Relay URL"
          className="text-xs bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-lg px-3 py-2 font-mono outline-none"
        />
        <input
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="Host device ID"
          className="text-xs bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-lg px-3 py-2 font-mono outline-none"
        />
        <input
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          placeholder="Session ID (optional)"
          className="text-xs bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-lg px-3 py-2 font-mono outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={connect}
            disabled={connected}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg glass-chip text-xs disabled:opacity-40"
          >
            <Plug className="w-3.5 h-3.5" />
            Connect
          </button>
          <button
            type="button"
            onClick={disconnect}
            disabled={!connected}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg glass-chip text-xs disabled:opacity-40"
          >
            <Unplug className="w-3.5 h-3.5" />
            Disconnect
          </button>
        </div>
      </div>

      <div ref={terminalRef} className="flex-1 min-h-0 p-2" />

      <footer className="shrink-0 border-t border-[var(--glass-border)] px-4 py-2 text-[11px] text-[var(--glass-text-muted)] flex items-center gap-3">
        <Cloud className="w-3.5 h-3.5" />
        <span>
          {canType
            ? 'You have input control. Ctrl+C sends interrupt.'
            : 'Waiting for agent status before input is enabled.'}
        </span>
        {lastAck && <span className="text-[var(--glass-text-muted)]">· {lastAck}</span>}
        {viewerLink && (
          <a href={viewerLink} className="ml-auto text-primary hover:underline truncate max-w-[40%]">
            Share viewer link
          </a>
        )}
      </footer>
    </div>
  );
};

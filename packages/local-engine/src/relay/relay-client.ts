import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import {
  RelayAgentStatus,
  RelayCommandAck,
  RelayHostHello,
  RelayMessage,
  RelayPresence,
  RelayRemoteCommand,
  RelayStatus,
  RelayTerminalChunk
} from '@agentic/shared-contracts';

export class RelayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private state: RelayStatus = {
    connectionState: 'offline',
    viewerCount: 0,
    message: 'Relay not connected.'
  };
  private seqBySession = new Map<string, number>();
  private deviceId = '';
  private relayUrl?: string;

  getState(): RelayStatus {
    return this.state;
  }

  async connect(relayUrl: string, hello: RelayHostHello): Promise<RelayStatus> {
    if (this.ws) {
      this.disconnect();
    }

    this.deviceId = hello.deviceId;
    this.relayUrl = relayUrl;
    this.setState({
      connectionState: 'connecting',
      relayUrl,
      viewerCount: 0,
      message: 'Connecting to relay…'
    });

    const ws = new WebSocket(relayUrl);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => {
        ws.send(JSON.stringify(hello));
        resolve();
      });

      ws.once('error', (error) => {
        reject(error);
      });
    });

    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as RelayMessage;
        this.handleMessage(message);
      } catch {
        // ignore malformed relay frames
      }
    });

    ws.on('close', () => {
      if (this.state.connectionState === 'connected') {
        this.setState({
          connectionState: 'offline',
          relayUrl: this.relayUrl,
          viewerCount: 0,
          message: 'Disconnected from relay.'
        });
      }
      this.ws = null;
    });

    this.setState({
      connectionState: 'connected',
      relayUrl,
      viewerCount: 0,
      message: 'Connected to relay — waiting for viewers.'
    });

    return this.state;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.setState({
      connectionState: 'offline',
      relayUrl: this.relayUrl,
      viewerCount: 0,
      message: 'Disconnected from relay.'
    });
  }

  publishTerminalChunk(sessionId: string, data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const seq = (this.seqBySession.get(sessionId) ?? 0) + 1;
    this.seqBySession.set(sessionId, seq);

    const message: RelayTerminalChunk = {
      type: 'terminal_chunk',
      deviceId: this.deviceId,
      sessionId,
      seq,
      data,
      timestamp: Date.now()
    };
    this.send(message);
  }

  publishAgentStatus(
    sessionId: string,
    status: RelayAgentStatus['status'],
    sessionGeneration: number
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const message: RelayAgentStatus = {
      type: 'agent_status',
      deviceId: this.deviceId,
      sessionId,
      status,
      sessionGeneration,
      timestamp: Date.now()
    };
    this.send(message);
  }

  sendCommandAck(ack: RelayCommandAck): void {
    this.send(ack);
  }

  private handleMessage(message: RelayMessage): void {
    switch (message.type) {
      case 'presence':
        this.setState({
          ...this.state,
          viewerCount: message.viewerCount,
          message: message.hostOnline
            ? `${message.viewerCount} viewer(s) connected.`
            : 'Host offline.'
        });
        this.emit('presence', message);
        break;
      case 'remote_command':
        this.emit('remote_command', message as RelayRemoteCommand);
        break;
      case 'error':
        this.setState({
          ...this.state,
          connectionState: 'error',
          message: message.message
        });
        break;
      default:
        break;
    }
  }

  private send(message: RelayMessage | RelayCommandAck): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  private setState(next: RelayStatus): void {
    this.state = next;
    this.emit('state', next);
  }
}

import {
  RelayAgentStatus,
  RelayCommandAck,
  RelayMessage,
  RelayPresence,
  RelayRemoteCommand,
  RelayTerminalChunk
} from '@agentic/shared-contracts';

const COMMAND_TTL_MS = 30_000;

export type RelayViewerConnectionState = 'offline' | 'connecting' | 'connected' | 'error';

export interface RelayViewerConnectOptions {
  relayUrl: string;
  deviceId: string;
  viewerId: string;
  viewerName?: string;
}

export interface RelayViewerState {
  connectionState: RelayViewerConnectionState;
  message: string;
  hostOnline: boolean;
  viewerCount: number;
}

type TerminalChunkHandler = (chunk: RelayTerminalChunk) => void;
type PresenceHandler = (presence: RelayPresence) => void;
type AgentStatusHandler = (status: RelayAgentStatus) => void;
type CommandAckHandler = (ack: RelayCommandAck) => void;

function createCommandId(): string {
  return `cmd-${crypto.randomUUID()}`;
}

export class RelayViewerClient {
  private ws: WebSocket | null = null;
  private sessionGenerations = new Map<string, number>();
  private viewerId = '';
  private deviceId = '';
  private state: RelayViewerState = {
    connectionState: 'offline',
    message: 'Not connected.',
    hostOnline: false,
    viewerCount: 0
  };

  private terminalHandlers = new Set<TerminalChunkHandler>();
  private presenceHandlers = new Set<PresenceHandler>();
  private statusHandlers = new Set<AgentStatusHandler>();
  private ackHandlers = new Set<CommandAckHandler>();
  private stateHandlers = new Set<(state: RelayViewerState) => void>();

  getState(): RelayViewerState {
    return this.state;
  }

  getSessionGeneration(sessionId: string): number | undefined {
    return this.sessionGenerations.get(sessionId);
  }

  onStateChange(handler: (state: RelayViewerState) => void): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  onTerminalChunk(handler: TerminalChunkHandler): () => void {
    this.terminalHandlers.add(handler);
    return () => this.terminalHandlers.delete(handler);
  }

  onPresence(handler: PresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  onAgentStatus(handler: AgentStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  onCommandAck(handler: CommandAckHandler): () => void {
    this.ackHandlers.add(handler);
    return () => this.ackHandlers.delete(handler);
  }

  async connect(options: RelayViewerConnectOptions): Promise<RelayViewerState> {
    this.disconnect();

    this.viewerId = options.viewerId;
    this.deviceId = options.deviceId;
    this.setState({
      connectionState: 'connecting',
      message: 'Connecting to relay…',
      hostOnline: false,
      viewerCount: 0
    });

    const ws = new WebSocket(options.relayUrl);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener(
        'error',
        () => reject(new Error('Failed to connect to relay.')),
        { once: true }
      );
    });

    ws.send(
      JSON.stringify({
        type: 'viewer_hello',
        deviceId: options.deviceId,
        viewerId: options.viewerId,
        viewerName: options.viewerName,
        timestamp: Date.now()
      })
    );

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as RelayMessage;
        this.handleMessage(message);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      this.ws = null;
      this.setState({
        connectionState: 'offline',
        message: 'Disconnected from relay.',
        hostOnline: false,
        viewerCount: 0
      });
    };

    this.setState({
      connectionState: 'connected',
      message: 'Connected — waiting for host output.',
      hostOnline: false,
      viewerCount: 0
    });

    return this.state;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.setState({
      connectionState: 'offline',
      message: 'Disconnected.',
      hostOnline: false,
      viewerCount: 0
    });
  }

  sendInput(sessionId: string, input: string): RelayCommandAck | null {
    const sessionGeneration = this.sessionGenerations.get(sessionId);
    if (sessionGeneration === undefined) {
      return null;
    }

    const envelope = this.buildRemoteCommand(sessionId, sessionGeneration, {
      commandId: createCommandId(),
      type: 'send_input',
      sessionId,
      input
    });
    this.send(envelope);
    return null;
  }

  sendInterrupt(sessionId: string): void {
    const sessionGeneration = this.sessionGenerations.get(sessionId);
    if (sessionGeneration === undefined) return;

    const envelope = this.buildRemoteCommand(sessionId, sessionGeneration, {
      commandId: createCommandId(),
      type: 'interrupt',
      sessionId
    });
    this.send(envelope);
  }

  private buildRemoteCommand(
    sessionId: string,
    sessionGeneration: number,
    command: RelayRemoteCommand['command']
  ): RelayRemoteCommand {
    return {
      type: 'remote_command',
      deviceId: this.deviceId,
      senderDeviceId: this.viewerId,
      sessionGeneration,
      expiresAt: Date.now() + COMMAND_TTL_MS,
      timestamp: Date.now(),
      command
    };
  }

  private send(message: RelayRemoteCommand): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  private handleMessage(message: RelayMessage): void {
    switch (message.type) {
      case 'terminal_chunk':
        this.terminalHandlers.forEach((handler) => handler(message));
        break;
      case 'presence':
        this.setState({
          ...this.state,
          hostOnline: message.hostOnline,
          viewerCount: message.viewerCount,
          message: message.hostOnline
            ? `Host online · ${message.viewerCount} viewer(s)`
            : 'Host offline.'
        });
        this.presenceHandlers.forEach((handler) => handler(message));
        break;
      case 'agent_status':
        this.sessionGenerations.set(message.sessionId, message.sessionGeneration);
        this.statusHandlers.forEach((handler) => handler(message));
        break;
      case 'command_ack':
        this.ackHandlers.forEach((handler) => handler(message));
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

  private setState(next: RelayViewerState): void {
    this.state = next;
    this.stateHandlers.forEach((handler) => handler(next));
  }
}

export function buildRelayViewerUrl(options: {
  origin: string;
  relayUrl: string;
  deviceId: string;
  sessionId?: string;
}): string {
  const params = new URLSearchParams({
    relay: options.relayUrl,
    deviceId: options.deviceId
  });
  if (options.sessionId) {
    params.set('sessionId', options.sessionId);
  }
  return `${options.origin.replace(/\/$/, '')}/viewer?${params.toString()}`;
}

export function parseRelayViewerSearch(search: string): {
  relayUrl: string;
  deviceId: string;
  sessionId?: string;
} {
  const params = new URLSearchParams(search);
  const relayUrl = params.get('relay') ?? 'ws://localhost:3848';
  const deviceId = params.get('deviceId') ?? '';
  const sessionId = params.get('sessionId') ?? undefined;
  return { relayUrl, deviceId, sessionId };
}

export function createViewerId(): string {
  return `viewer-${crypto.randomUUID()}`;
}

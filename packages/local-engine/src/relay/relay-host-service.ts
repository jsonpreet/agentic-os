import { EventEmitter } from 'node:events';
import {
  AgentStatusChangedEvent,
  RelayCommandAck,
  RelayRemoteCommand,
  RelayStatus,
  TerminalOutputEvent
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';
import { PTYManager } from '../engine/pty-manager.js';
import { RelayClient } from './relay-client.js';

const MAX_TRACKED_COMMANDS = 1000;
const DEFAULT_COMMAND_TTL_MS = 30_000;

export class RelayHostService extends EventEmitter {
  private client = new RelayClient();
  private processedCommands = new Set<string>();
  private processedOrder: string[] = [];
  private activeControllerBySession = new Map<string, string>();
  private wired = false;

  constructor(
    private db: EngineDatabase,
    private ptyManager: PTYManager
  ) {
    super();
    this.client.on('remote_command', (command) => {
      void this.handleRemoteCommand(command);
    });
    this.client.on('state', (state) => {
      this.emit('state', state);
    });
  }

  getClient(): RelayClient {
    return this.client;
  }

  getStatus(): RelayStatus {
    return this.client.getState();
  }

  wireTerminalEvents(
    onTerminalOutput: (listener: (event: TerminalOutputEvent) => void) => void,
    onStatusChanged: (listener: (event: AgentStatusChangedEvent) => void) => void
  ): void {
    if (this.wired) return;
    this.wired = true;

    onTerminalOutput((event) => {
      if (this.client.getState().connectionState !== 'connected') return;
      this.client.publishTerminalChunk(event.sessionId, event.data);
    });

    onStatusChanged((event) => {
      if (this.client.getState().connectionState !== 'connected') return;
      const session = this.db.getAgentSession(event.sessionId);
      const generation = session?.updatedAt ?? event.timestamp;
      this.client.publishAgentStatus(event.sessionId, event.status, generation);
    });
  }

  async connect(relayUrl: string, device: {
    deviceId: string;
    deviceName: string;
    platform: string;
  }): Promise<RelayStatus> {
    return this.client.connect(relayUrl, {
      type: 'host_hello',
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      timestamp: Date.now()
    });
  }

  disconnect(): RelayStatus {
    this.client.disconnect();
    return this.client.getState();
  }

  private async handleRemoteCommand(message: RelayRemoteCommand): Promise<void> {
    const { command, senderDeviceId, sessionGeneration, expiresAt } = message;
    const ack = (success: boolean, detail?: string): RelayCommandAck => ({
      type: 'command_ack',
      commandId: command.commandId,
      success,
      message: detail,
      timestamp: Date.now()
    });

    if (expiresAt < Date.now()) {
      this.client.sendCommandAck(ack(false, 'Command expired.'));
      return;
    }

    if (this.processedCommands.has(command.commandId)) {
      this.client.sendCommandAck(ack(true, 'Duplicate command ignored.'));
      return;
    }
    this.rememberCommand(command.commandId);

    const session = this.db.getAgentSession(command.sessionId);
    if (!session) {
      this.client.sendCommandAck(ack(false, 'Session not found.'));
      return;
    }

    if (session.updatedAt !== sessionGeneration) {
      this.client.sendCommandAck(ack(false, 'Stale session generation.'));
      return;
    }

    const activeController = this.activeControllerBySession.get(command.sessionId);
    if (activeController && activeController !== senderDeviceId) {
      this.client.sendCommandAck(ack(false, 'Another viewer controls this terminal.'));
      return;
    }

    try {
      if (command.type === 'send_input') {
        this.activeControllerBySession.set(command.sessionId, senderDeviceId);
        this.ptyManager.sendInput(command.sessionId, command.input);
        this.client.sendCommandAck(ack(true, 'Input delivered.'));
        return;
      }

      if (command.type === 'interrupt') {
        this.ptyManager.interrupt(command.sessionId);
        this.client.sendCommandAck(ack(true, 'Interrupt sent.'));
        return;
      }

      this.client.sendCommandAck(ack(false, `Unsupported command: ${command.type}`));
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Command failed.';
      this.client.sendCommandAck(ack(false, detail));
    }
  }

  private rememberCommand(commandId: string): void {
    this.processedCommands.add(commandId);
    this.processedOrder.push(commandId);
    if (this.processedOrder.length > MAX_TRACKED_COMMANDS) {
      const oldest = this.processedOrder.shift();
      if (oldest) this.processedCommands.delete(oldest);
    }
  }
}

export { DEFAULT_COMMAND_TTL_MS };

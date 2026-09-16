import { EventEmitter } from 'node:events';
import pty, { IPty } from 'node-pty';
import fs from 'node:fs';
import { getShellEnvironment } from '../discovery/shell-env.js';
import { AgentStatus } from '@agentic/shared-contracts';

export interface SpawnOptions {
  sessionId: string;
  command: string;
  args?: string[];
  cwd: string;
  cols?: number;
  rows?: number;
}

export class PTYManager extends EventEmitter {
  private sessions = new Map<string, IPty>();
  private sessionStatuses = new Map<string, AgentStatus>();
  private outputBuffers = new Map<string, string>();

  async spawn(options: SpawnOptions): Promise<void> {
    const { sessionId, command, args = [], cwd, cols = 80, rows = 24 } = options;

    if (this.sessions.has(sessionId)) {
      throw new Error(`PTY session ${sessionId} already exists.`);
    }

    const env = await getShellEnvironment();
    const effectiveCwd = fs.existsSync(cwd) ? cwd : process.env.HOME || '/';

    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: effectiveCwd,
      env: {
        ...env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        AGENTIC_SESSION_ID: sessionId
      }
    });

    this.sessions.set(sessionId, ptyProcess);
    this.sessionStatuses.set(sessionId, 'working');
    this.outputBuffers.set(sessionId, '');

    ptyProcess.onData((data: string) => {
      // Keep buffer of recent output for inspection
      const buf = (this.outputBuffers.get(sessionId) || '') + data;
      this.outputBuffers.set(sessionId, buf.slice(-10000));

      this.emit('terminal_output', {
        sessionId,
        data,
        timestamp: Date.now()
      });

      // Simple heuristic for readiness/idle: typical shell or CLI prompts
      if (
        data.includes('> ') ||
        data.includes('$ ') ||
        data.includes('% ') ||
        data.includes('ready')
      ) {
        this.setStatus(sessionId, 'idle');
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.sessions.delete(sessionId);
      this.setStatus(sessionId, 'terminated');
      this.emit('session_exit', { sessionId, exitCode, signal });
    });
  }

  sendInput(sessionId: string, data: string): void {
    const ptyProcess = this.sessions.get(sessionId);
    if (!ptyProcess) {
      throw new Error(`Cannot send input: PTY session ${sessionId} not found.`);
    }
    this.setStatus(sessionId, 'working');
    ptyProcess.write(data);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const ptyProcess = this.sessions.get(sessionId);
    if (ptyProcess) {
      try {
        ptyProcess.resize(cols, rows);
      } catch {
        // ignore resize errors if process is closing
      }
    }
  }

  interrupt(sessionId: string): void {
    const ptyProcess = this.sessions.get(sessionId);
    if (ptyProcess) {
      // Send SIGINT (Ctrl+C)
      ptyProcess.write('\x03');
      this.setStatus(sessionId, 'idle');
    }
  }

  kill(sessionId: string): void {
    const ptyProcess = this.sessions.get(sessionId);
    if (ptyProcess) {
      ptyProcess.kill();
      this.sessions.delete(sessionId);
      this.setStatus(sessionId, 'terminated');
    }
  }

  getStatus(sessionId: string): AgentStatus {
    return this.sessionStatuses.get(sessionId) || 'idle';
  }

  setStatus(sessionId: string, status: AgentStatus): void {
    const prev = this.sessionStatuses.get(sessionId);
    if (prev !== status) {
      this.sessionStatuses.set(sessionId, status);
      this.emit('status_changed', { sessionId, status, timestamp: Date.now() });
    }
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

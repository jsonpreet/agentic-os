import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import { execa, type ResultPromise } from 'execa';
import {
  DevServerLogEntry,
  DevServerLogEvent,
  DevServerSession,
  DevServerStatus,
  DevServerStatusEvent
} from '@agentic/shared-contracts';

const MAX_LOG_LINES = 1000;
const LOCAL_URL_RE =
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+(?:\/[^\s]*)?/gi;

export function detectDevServerUrl(text: string): string | undefined {
  const matches = text.match(LOCAL_URL_RE);
  if (!matches || matches.length === 0) return undefined;
  const url = matches[matches.length - 1].replace(/[)\]},;]+$/, '');
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function portFromUrl(url: string): number | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return undefined;
  }
}

interface RunningDevServer {
  session: DevServerSession;
  process: ResultPromise;
  logs: DevServerLogEntry[];
}

export class DevServerService extends EventEmitter {
  private servers = new Map<string, RunningDevServer>();

  getSession(sessionId: string): DevServerSession | undefined {
    return this.servers.get(sessionId)?.session;
  }

  getSessions(desktopId: string): DevServerSession[] {
    return Array.from(this.servers.values())
      .map((entry) => entry.session)
      .filter((session) => session.desktopId === desktopId)
      .sort((a, b) => a.startedAt - b.startedAt);
  }

  getLogs(sessionId: string): DevServerLogEntry[] {
    return this.servers.get(sessionId)?.logs ?? [];
  }

  async startServer(params: {
    desktopId: string;
    name: string;
    command: string;
    cwd: string;
  }): Promise<DevServerSession> {
    const command = params.command.trim();
    if (!command) {
      throw new Error('Dev server command is required.');
    }

    const now = Date.now();
    const session: DevServerSession = {
      id: `devserver-${nanoid()}`,
      desktopId: params.desktopId,
      name: params.name.trim() || 'Dev Server',
      command,
      cwd: params.cwd,
      status: 'starting',
      startedAt: now,
      updatedAt: now
    };

    const child = execa(command, {
      cwd: params.cwd,
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        CI: '1'
      },
      reject: false
    });

    session.pid = child.pid;
    const entry: RunningDevServer = { session, process: child, logs: [] };
    this.servers.set(session.id, entry);
    this.emitStatus(session);

    const appendLog = (stream: 'stdout' | 'stderr', chunk: string) => {
      const lines = chunk.split(/\r?\n/).filter((line) => line.length > 0);
      for (const line of lines) {
        const logEntry: DevServerLogEntry = {
          sessionId: session.id,
          stream,
          data: line,
          timestamp: Date.now()
        };
        entry.logs.push(logEntry);
        if (entry.logs.length > MAX_LOG_LINES) {
          entry.logs.splice(0, entry.logs.length - MAX_LOG_LINES);
        }
        this.emit('dev_server_log', {
          type: 'dev_server_log',
          sessionId: session.id,
          stream,
          data: line,
          timestamp: logEntry.timestamp
        } satisfies DevServerLogEvent);

        const detected = detectDevServerUrl(line);
        if (detected && session.url !== detected) {
          session.url = detected;
          session.port = portFromUrl(detected);
          session.updatedAt = Date.now();
          if (session.status === 'starting') {
            session.status = 'running';
          }
          this.emitStatus(session);
        }
      }
    };

    child.stdout?.on('data', (data: Buffer) => appendLog('stdout', data.toString('utf8')));
    child.stderr?.on('data', (data: Buffer) => appendLog('stderr', data.toString('utf8')));

    child
      .then((result) => {
        const current = this.servers.get(session.id);
        if (!current) return;
        current.session.exitCode = result.exitCode ?? undefined;
        current.session.status = result.exitCode === 0 ? 'stopped' : 'failed';
        current.session.updatedAt = Date.now();
        this.emitStatus(current.session);
      })
      .catch(() => {
        const current = this.servers.get(session.id);
        if (!current) return;
        current.session.status = 'failed';
        current.session.updatedAt = Date.now();
        this.emitStatus(current.session);
      });

    setTimeout(() => {
      const current = this.servers.get(session.id);
      if (!current || current.session.status !== 'starting') return;
      current.session.status = 'running';
      current.session.updatedAt = Date.now();
      this.emitStatus(current.session);
    }, 1500);

    return session;
  }

  async stopServer(sessionId: string): Promise<boolean> {
    const entry = this.servers.get(sessionId);
    if (!entry) return false;

    try {
      entry.process.kill('SIGTERM');
    } catch {
      // process may already be gone
    }

    entry.session.status = 'stopped';
    entry.session.updatedAt = Date.now();
    this.emitStatus(entry.session);
    this.servers.delete(sessionId);
    return true;
  }

  private emitStatus(session: DevServerSession): void {
    this.emit('dev_server_status', {
      type: 'dev_server_status',
      sessionId: session.id,
      status: session.status,
      url: session.url,
      port: session.port,
      timestamp: Date.now()
    } satisfies DevServerStatusEvent);
  }
}

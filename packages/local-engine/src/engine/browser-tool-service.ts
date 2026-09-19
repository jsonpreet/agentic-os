import { EventEmitter } from 'node:events';
import { nanoid } from 'nanoid';
import {
  BrowserSession,
  BrowserSnapshot,
  BrowserCommandEvent,
  BrowserCommandResultEvent,
  BrowserToolName
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';

const TOOL_TIMEOUT_MS = 30_000;

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'about:blank';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('about:')) return trimmed;
  return `https://${trimmed}`;
}

export class BrowserToolService extends EventEmitter {
  private pending = new Map<
    string,
    {
      resolve: (snapshot: BrowserSnapshot) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(private db: EngineDatabase) {
    super();
  }

  getSessions(desktopId: string): BrowserSession[] {
    return this.db.getBrowserSessions(desktopId);
  }

  createSession(desktopId: string, url?: string): BrowserSession {
    const now = Date.now();
    const session: BrowserSession = {
      id: `browser-${nanoid()}`,
      desktopId,
      url: normalizeUrl(url || 'about:blank'),
      createdAt: now,
      updatedAt: now
    };
    this.db.saveBrowserSession(session);
    return session;
  }

  closeSession(sessionId: string): boolean {
    return this.db.deleteBrowserSession(sessionId);
  }

  updateSession(
    sessionId: string,
    updates: { url?: string; title?: string }
  ): BrowserSession {
    const session = this.db.getBrowserSession(sessionId);
    if (!session) throw new Error(`Browser session ${sessionId} not found.`);
    if (updates.url !== undefined) session.url = normalizeUrl(updates.url);
    if (updates.title !== undefined) session.title = updates.title;
    session.updatedAt = Date.now();
    this.db.saveBrowserSession(session);
    return session;
  }

  async navigate(sessionId: string, url: string): Promise<BrowserSnapshot> {
    const normalized = normalizeUrl(url);
    this.updateSession(sessionId, { url: normalized });
    return this.requestTool(sessionId, 'navigate', { url: normalized });
  }

  async snapshot(sessionId: string): Promise<BrowserSnapshot> {
    return this.requestTool(sessionId, 'snapshot', {});
  }

  submitResult(result: BrowserCommandResultEvent): void {
    const pending = this.pending.get(result.requestId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(result.requestId);

    if (result.success && result.snapshot) {
      if (result.snapshot.url) {
        try {
          this.updateSession(result.sessionId, {
            url: result.snapshot.url,
            title: result.snapshot.title
          });
        } catch {
          // session may have been closed
        }
      }
      pending.resolve(result.snapshot);
      return;
    }

    pending.reject(new Error(result.error || 'Browser tool failed'));
  }

  private requestTool(
    sessionId: string,
    tool: BrowserToolName,
    params: Record<string, string>
  ): Promise<BrowserSnapshot> {
    const session = this.db.getBrowserSession(sessionId);
    if (!session) {
      return Promise.reject(new Error(`Browser session ${sessionId} not found.`));
    }

    const requestId = nanoid();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Browser tool "${tool}" timed out`));
      }, TOOL_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, reject, timer });

      const event: BrowserCommandEvent = {
        requestId,
        sessionId,
        tool,
        params
      };
      this.emit('browser_command', event);
    });
  }
}

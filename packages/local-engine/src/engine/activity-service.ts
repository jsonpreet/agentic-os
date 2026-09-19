import { EventEmitter } from 'node:events';
import {
  ActivityCategory,
  ActivityEvent,
  ActivityEventQuery,
  ActivitySeverity,
  CreateActivityEventParams
} from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';

export class ActivityService extends EventEmitter {
  constructor(private db: EngineDatabase) {
    super();
  }

  listEvents(query?: ActivityEventQuery): ActivityEvent[] {
    return this.db.listActivityEvents(query);
  }

  recordEvent(params: CreateActivityEventParams): ActivityEvent {
    const event = this.db.recordActivityEvent(params);
    this.emit('activity_event', event);
    return event;
  }

  clearEvents(workspaceId?: string): boolean {
    return this.db.clearActivityEvents(workspaceId);
  }

  logAgent(
    title: string,
    message: string,
    meta?: Record<string, unknown>,
    severity: ActivitySeverity = 'info',
    workspaceId?: string | null,
    desktopId?: string | null
  ): ActivityEvent {
    return this.recordEvent({
      category: 'agent',
      severity,
      title,
      message,
      metadata: meta,
      workspaceId,
      desktopId
    });
  }

  logGit(
    title: string,
    message: string,
    meta?: Record<string, unknown>,
    severity: ActivitySeverity = 'info',
    workspaceId?: string | null
  ): ActivityEvent {
    return this.recordEvent({
      category: 'git',
      severity,
      title,
      message,
      metadata: meta,
      workspaceId
    });
  }

  logDevServer(
    title: string,
    message: string,
    meta?: Record<string, unknown>,
    severity: ActivitySeverity = 'info',
    desktopId?: string | null
  ): ActivityEvent {
    return this.recordEvent({
      category: 'dev_server',
      severity,
      title,
      message,
      metadata: meta,
      desktopId
    });
  }

  logBrowser(
    title: string,
    message: string,
    meta?: Record<string, unknown>,
    severity: ActivitySeverity = 'info',
    desktopId?: string | null
  ): ActivityEvent {
    return this.recordEvent({
      category: 'browser',
      severity,
      title,
      message,
      metadata: meta,
      desktopId
    });
  }

  logNetwork(
    title: string,
    message: string,
    meta?: Record<string, unknown>,
    severity: ActivitySeverity = 'info',
    workspaceId?: string | null,
    desktopId?: string | null
  ): ActivityEvent {
    return this.recordEvent({
      category: 'network',
      severity,
      title,
      message,
      metadata: meta,
      workspaceId,
      desktopId
    });
  }

  logDatabase(
    title: string,
    message: string,
    meta?: Record<string, unknown>,
    severity: ActivitySeverity = 'info',
    workspaceId?: string | null
  ): ActivityEvent {
    return this.recordEvent({
      category: 'database',
      severity,
      title,
      message,
      metadata: meta,
      workspaceId
    });
  }

  logSystem(
    title: string,
    message: string,
    meta?: Record<string, unknown>,
    severity: ActivitySeverity = 'info',
    workspaceId?: string | null
  ): ActivityEvent {
    return this.recordEvent({
      category: 'system',
      severity,
      title,
      message,
      metadata: meta,
      workspaceId
    });
  }
}

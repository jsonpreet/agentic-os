export type DevServerStatus = 'starting' | 'running' | 'stopped' | 'failed';

export interface DevServerSession {
  id: string;
  desktopId: string;
  name: string;
  command: string;
  cwd: string;
  status: DevServerStatus;
  pid?: number;
  url?: string;
  port?: number;
  startedAt: number;
  updatedAt: number;
  exitCode?: number;
}

export interface DevServerLogEntry {
  sessionId: string;
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}

export interface DevServerLogEvent {
  type: 'dev_server_log';
  sessionId: string;
  stream: 'stdout' | 'stderr';
  data: string;
  timestamp: number;
}

export interface DevServerStatusEvent {
  type: 'dev_server_status';
  sessionId: string;
  status: DevServerStatus;
  url?: string;
  port?: number;
  timestamp: number;
}

export interface StartDevServerParams {
  desktopId: string;
  name: string;
  command: string;
  cwd: string;
}

import { AgentInstruction, AgentSession } from './agent.js';
import { BrowserSession } from './browser.js';
import { KanbanTask } from './kanban.js';
import { WorkspaceNote } from './notes.js';
import { RelayStatus } from './relay.js';
import { Desktop, WindowLayout, Workspace } from './workspace.js';

export type SyncConnectionState = 'offline' | 'local_snapshot' | 'relay_connected';

export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
  platform: string;
  createdAt: number;
}

export interface SyncPreferences {
  localOnlyMode: boolean;
  autoSyncEnabled: boolean;
  relayUrl?: string;
}

export interface SyncStatus {
  device: DeviceIdentity;
  preferences: SyncPreferences;
  connectionState: SyncConnectionState;
  lastSyncedAt?: number;
  latestSnapshotVersion?: number;
  snapshotCount: number;
  message: string;
  relay?: RelayStatus;
}

export interface SyncSnapshotMeta {
  version: number;
  deviceId: string;
  createdAt: number;
  byteSize: number;
}

export interface SyncCatalogSnapshot {
  version: number;
  deviceId: string;
  createdAt: number;
  workspaces: Workspace[];
  desktops: Desktop[];
  agentSessions: AgentSession[];
  notes: WorkspaceNote[];
  kanbanTasks: KanbanTask[];
  windowLayouts: WindowLayout[];
  browserSessions: BrowserSession[];
  queuedInstructions: AgentInstruction[];
}

export interface EncryptedSyncBlob {
  version: number;
  algorithm: 'aes-256-gcm';
  deviceId: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  createdAt: number;
}

export interface CreateSyncSnapshotResult {
  meta: SyncSnapshotMeta;
}

export interface RestoreSyncSnapshotResult {
  restoredAt: number;
  workspaces: number;
  notes: number;
  kanbanTasks: number;
}

export interface UpdateSyncPreferencesParams {
  localOnlyMode?: boolean;
  autoSyncEnabled?: boolean;
  relayUrl?: string | null;
}

import { AppManifest } from '@agentic/shared-contracts';

export const SDK_VERSION = '0.1.0';

export const PERMISSIONS = {
  STORAGE: 'storage',
  NOTIFICATIONS: 'notifications',
  LAUNCH_AGENT_TASK: 'launch_agent_task',
  READ_FILES: 'read_files'
} as const;

export type AppPermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface CreateManifestInput {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  windowEntrypoint?: string;
  widgetEntrypoint?: string;
  permissions?: AppPermission[];
}

export function createManifest(input: CreateManifestInput): AppManifest {
  if (!input.windowEntrypoint && !input.widgetEntrypoint) {
    throw new Error('Extension manifest requires a window or widget entrypoint.');
  }

  return {
    id: input.id,
    name: input.name,
    version: input.version,
    sdkVersion: SDK_VERSION,
    description: input.description,
    icon: input.icon,
    windowEntrypoint: input.windowEntrypoint,
    widgetEntrypoint: input.widgetEntrypoint,
    permissions: input.permissions ?? []
  };
}

export * from './widget-client.js';

export function validateManifest(manifest: AppManifest, supportedSdkVersion = SDK_VERSION): void {
  if (!manifest.id || !manifest.name || !manifest.version || !manifest.sdkVersion) {
    throw new Error('Manifest is missing required fields.');
  }
  if (manifest.sdkVersion !== supportedSdkVersion) {
    throw new Error(
      `Manifest SDK ${manifest.sdkVersion} is incompatible with host SDK ${supportedSdkVersion}.`
    );
  }
  if (!manifest.windowEntrypoint && !manifest.widgetEntrypoint) {
    throw new Error('Manifest must declare a window or widget entrypoint.');
  }
  if (!Array.isArray(manifest.permissions)) {
    throw new Error('Manifest.permissions must be an array.');
  }
}

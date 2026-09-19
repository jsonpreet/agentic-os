export interface AppManifest {
  id: string;
  name: string;
  version: string;
  sdkVersion: string;
  icon?: string;
  description?: string;
  windowEntrypoint?: string;
  widgetEntrypoint?: string;
  permissions: string[];
}

export interface InstalledExtension {
  manifest: AppManifest;
  installPath: string;
  installedAt: number;
}

export interface InstallExtensionParams {
  sourcePath: string;
}

export interface ExtensionWidgetDescriptor {
  extensionId: string;
  name: string;
  widgetPath: string;
  widgetUrl?: string;
  permissions: string[];
  sdkVersion: string;
}

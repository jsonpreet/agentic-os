import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  AppManifest,
  ExtensionWidgetDescriptor,
  InstallExtensionParams,
  InstalledExtension
} from '@agentic/shared-contracts';

const DEFAULT_EXTENSIONS_DIR = path.join(os.homedir(), '.agentic', 'extensions');
const SUPPORTED_SDK_VERSION = '0.1.0';

export class ExtensionService {
  constructor(private extensionsDir: string = DEFAULT_EXTENSIONS_DIR) {}

  getWidgetDescriptors(httpBaseUrl?: string): ExtensionWidgetDescriptor[] {
    return this.listInstalled()
      .filter((extension) => extension.manifest.widgetEntrypoint)
      .map((extension) => {
        const entrypoint = extension.manifest.widgetEntrypoint!;
        const widgetPath = path.join(extension.installPath, entrypoint);
        const widgetUrl = httpBaseUrl
          ? `${httpBaseUrl}/extensions/${encodeURIComponent(extension.manifest.id)}/${entrypoint
              .split('/')
              .map((segment) => encodeURIComponent(segment))
              .join('/')}`
          : undefined;

        return {
          extensionId: extension.manifest.id,
          name: extension.manifest.name,
          widgetPath,
          widgetUrl,
          permissions: extension.manifest.permissions,
          sdkVersion: extension.manifest.sdkVersion
        };
      });
  }

  resolveExtensionFile(extensionId: string, relativePath: string): string | null {
    const installed = this.listInstalled().find((entry) => entry.manifest.id === extensionId);
    if (!installed) return null;

    const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolutePath = path.join(installed.installPath, normalized);
    const relative = path.relative(installed.installPath, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }
    if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
      return null;
    }
    return absolutePath;
  }

  listInstalled(): InstalledExtension[] {
    if (!fs.existsSync(this.extensionsDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.extensionsDir, { withFileTypes: true });
    const installed: InstalledExtension[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const installPath = path.join(this.extensionsDir, entry.name);
      const manifestPath = path.join(installPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest = this.parseManifest(fs.readFileSync(manifestPath, 'utf8'));
        const stat = fs.statSync(manifestPath);
        installed.push({
          manifest,
          installPath,
          installedAt: stat.mtimeMs
        });
      } catch {
        // Skip invalid manifests.
      }
    }

    return installed.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  }

  installFromPath(params: InstallExtensionParams): InstalledExtension {
    const sourcePath = path.resolve(params.sourcePath);
    const manifestPath = path.join(sourcePath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Extension manifest.json not found.');
    }

    const manifest = this.parseManifest(fs.readFileSync(manifestPath, 'utf8'));
    if (!fs.existsSync(this.extensionsDir)) {
      fs.mkdirSync(this.extensionsDir, { mode: 0o700, recursive: true });
    }

    const targetPath = path.join(this.extensionsDir, manifest.id);
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
    fs.cpSync(sourcePath, targetPath, { recursive: true });

    return {
      manifest,
      installPath: targetPath,
      installedAt: Date.now()
    };
  }

  parseManifest(raw: string): AppManifest {
    const manifest = JSON.parse(raw) as AppManifest;
    if (!manifest.id || !manifest.name || !manifest.version || !manifest.sdkVersion) {
      throw new Error('Extension manifest is missing required fields.');
    }
    if (!Array.isArray(manifest.permissions)) {
      throw new Error('Extension manifest.permissions must be an array.');
    }
    if (manifest.sdkVersion !== SUPPORTED_SDK_VERSION) {
      throw new Error(
        `Extension requires SDK ${manifest.sdkVersion}; host supports ${SUPPORTED_SDK_VERSION}.`
      );
    }
    if (!manifest.windowEntrypoint && !manifest.widgetEntrypoint) {
      throw new Error('Extension must declare a window or widget entrypoint.');
    }
    return manifest;
  }
}

export { SUPPORTED_SDK_VERSION };

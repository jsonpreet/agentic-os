import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { DiscoveredCLI, AgentProvider } from '@agentic/shared-contracts';
import { getSearchPaths, getShellEnvironment } from './shell-env.js';

interface SupportedCLIDefinition {
  provider: AgentProvider;
  name: string;
  command: string;
  versionArgs: string[];
  capabilities: {
    supportsPromptDelivery: boolean;
    supportsAttachments: boolean;
    supportsReadinessEvents: boolean;
    supportsResumption: boolean;
  };
}

const SUPPORTED_CLIS: SupportedCLIDefinition[] = [
  {
    provider: 'claude',
    name: 'Claude Code',
    command: 'claude',
    versionArgs: ['--version'],
    capabilities: {
      supportsPromptDelivery: true,
      supportsAttachments: true,
      supportsReadinessEvents: true,
      supportsResumption: true
    }
  },
  {
    provider: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini',
    versionArgs: ['--version'],
    capabilities: {
      supportsPromptDelivery: true,
      supportsAttachments: true,
      supportsReadinessEvents: true,
      supportsResumption: true
    }
  },
  {
    provider: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    versionArgs: ['--version'],
    capabilities: {
      supportsPromptDelivery: true,
      supportsAttachments: true,
      supportsReadinessEvents: false,
      supportsResumption: false
    }
  },
  {
    provider: 'cursor',
    name: 'Cursor CLI',
    command: 'cursor',
    versionArgs: ['--version'],
    capabilities: {
      supportsPromptDelivery: true,
      supportsAttachments: false,
      supportsReadinessEvents: false,
      supportsResumption: false
    }
  }
];

export class CLIDiscoveryService {
  private cache: DiscoveredCLI[] | null = null;

  async scan(manualPaths: Partial<Record<AgentProvider, string>> = {}): Promise<DiscoveredCLI[]> {
    const searchPaths = await getSearchPaths();
    const env = await getShellEnvironment();
    const results: DiscoveredCLI[] = [];

    for (const def of SUPPORTED_CLIS) {
      let executablePath: string | null = null;
      let version: string | null = null;
      let isAvailable = false;
      let isManual = false;

      const manualPath = manualPaths[def.provider];
      if (manualPath && fs.existsSync(manualPath)) {
        executablePath = manualPath;
        isManual = true;
      }

      // Check candidate search paths for executable binary
      if (!executablePath) {
      for (const dir of searchPaths) {
        const candidate = path.join(dir, def.command);
        try {
          if (fs.existsSync(candidate)) {
            const stat = fs.statSync(candidate);
            if (stat.isFile()) {
              executablePath = candidate;
              break;
            }
          }
        } catch {
          // ignore permission errors for specific directories
        }
      }
      }

      if (executablePath) {
        try {
          const { stdout } = await execa(executablePath, def.versionArgs, {
            env,
            timeout: 2000
          });
          version = stdout.trim().split('\n')[0] || 'Unknown';
          isAvailable = true;
        } catch {
          // Binary found but running version failed (e.g. wrapper script)
          version = 'Detected (version check timed out)';
          isAvailable = true;
        }
      }

      results.push({
        provider: def.provider,
        name: def.name,
        command: def.command,
        executablePath,
        version,
        isAvailable,
        isManual,
        capabilities: def.capabilities
      });
    }

    this.cache = results;
    return results;
  }

  getCached(): DiscoveredCLI[] | null {
    return this.cache;
  }

  setCache(results: DiscoveredCLI[]): void {
    this.cache = results;
  }
}

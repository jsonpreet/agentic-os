import { AgentProvider } from './agent.js';

export interface CLICapabilities {
  supportsPromptDelivery: boolean;
  supportsAttachments: boolean;
  supportsReadinessEvents: boolean;
  supportsResumption: boolean;
}

export interface DiscoveredCLI {
  provider: AgentProvider;
  name: string;
  command: string;
  executablePath: string | null;
  version: string | null;
  isAvailable: boolean;
  capabilities: CLICapabilities;
}

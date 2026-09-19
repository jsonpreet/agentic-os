import { PromptRouteResult } from '@agentic/shared-contracts';

export interface ExtensionHostContext {
  workspaceId: string;
  desktopId: string;
  repoPath?: string;
  onLaunchTask?: (result: PromptRouteResult) => void;
}

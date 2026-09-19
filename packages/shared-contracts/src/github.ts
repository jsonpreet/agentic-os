export interface GitHubCliInfo {
  isInstalled: boolean;
  executablePath?: string;
  version?: string;
}

export interface GitHubAuthStatus {
  isInstalled: boolean;
  isAuthenticated: boolean;
  username?: string;
  hostname?: string;
  protocol?: string;
  message: string;
}

export interface CreatePullRequestParams {
  workspaceId: string;
  repoPath: string;
  title: string;
  body?: string;
  base?: string;
  draft?: boolean;
}

export interface CreatePullRequestResult {
  success: boolean;
  url?: string;
  number?: number;
  message: string;
}

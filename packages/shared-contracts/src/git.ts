export type GitChangeKind =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'staged';

export interface GitChangedFile {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  kind: GitChangeKind;
}

export interface GitStatusResult {
  repoPath: string;
  branch: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
  changedFiles: GitChangedFile[];
  clean: boolean;
}

export interface GitDiffResult {
  path: string;
  diff: string;
  staged: boolean;
}

export interface GitCommitResult {
  commitHash: string;
  branch: string;
}

export interface GitPushResult {
  success: boolean;
  message: string;
}

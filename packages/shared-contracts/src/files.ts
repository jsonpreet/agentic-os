export type FileEntryKind = 'file' | 'directory';

export interface FileEntry {
  name: string;
  path: string;
  kind: FileEntryKind;
  size?: number;
  modifiedAt?: number;
}

export interface TextFileContent {
  kind: 'text';
  path: string;
  content: string;
  truncated: boolean;
}

export interface BinaryFilePreview {
  kind: 'binary';
  path: string;
  mimeType: string;
  dataBase64: string;
}

export type FilePreview = TextFileContent | BinaryFilePreview;

export interface ListDirectoryParams {
  workspaceId: string;
  dirPath: string;
}

export interface ReadTextFileParams {
  workspaceId: string;
  filePath: string;
}

export interface WriteTextFileParams {
  workspaceId: string;
  filePath: string;
  content: string;
}

export interface ReadFilePreviewParams {
  workspaceId: string;
  filePath: string;
}

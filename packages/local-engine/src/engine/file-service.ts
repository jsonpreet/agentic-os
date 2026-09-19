import fs from 'node:fs';
import path from 'node:path';
import { FileEntry, FilePreview } from '@agentic/shared-contracts';
import { EngineDatabase } from '../db/index.js';

const MAX_TEXT_BYTES = 512 * 1024;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico']);

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

export class FileService {
  constructor(private db: EngineDatabase) {}

  getAllowedRoots(workspaceId: string): string[] {
    const workspace = this.db.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found.`);
    }

    const roots = new Set<string>();
    for (const repo of workspace.repositories) {
      roots.add(path.resolve(repo));
    }

    const sessions = this.db.getAgentSessions(workspaceId);
    for (const session of sessions) {
      if (session.worktreePath) {
        roots.add(path.resolve(session.worktreePath));
      }
      if (session.repoPath) {
        roots.add(path.resolve(session.repoPath));
      }
    }

    return [...roots];
  }

  resolvePath(workspaceId: string, targetPath: string): string {
    const resolved = path.resolve(targetPath);
    const roots = this.getAllowedRoots(workspaceId);

    if (roots.length === 0) {
      throw new Error('No repository paths are configured for this workspace.');
    }

    for (const root of roots) {
      if (resolved === root || resolved.startsWith(root + path.sep)) {
        return resolved;
      }
    }

    throw new Error('Path is outside allowed workspace directories.');
  }

  listDirectory(workspaceId: string, dirPath: string): FileEntry[] {
    const resolved = this.resolvePath(workspaceId, dirPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${dirPath}`);
    }

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const entry of entries) {
      const entryPath = path.join(resolved, entry.name);
      let entryStat: fs.Stats;
      try {
        entryStat = fs.statSync(entryPath);
      } catch {
        continue;
      }

      result.push({
        name: entry.name,
        path: entryPath,
        kind: entry.isDirectory() ? 'directory' : 'file',
        size: entry.isFile() ? entryStat.size : undefined,
        modifiedAt: entryStat.mtimeMs
      });
    }

    result.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }

  readTextFile(workspaceId: string, filePath: string): FilePreview {
    const resolved = this.resolvePath(workspaceId, filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }

    const ext = path.extname(resolved).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      const buffer = fs.readFileSync(resolved);
      return {
        kind: 'binary',
        path: resolved,
        mimeType: MIME_BY_EXT[ext] || 'application/octet-stream',
        dataBase64: buffer.toString('base64')
      };
    }

    const truncated = stat.size > MAX_TEXT_BYTES;
    const buffer = truncated
      ? fs.readFileSync(resolved).subarray(0, MAX_TEXT_BYTES)
      : fs.readFileSync(resolved);

    return {
      kind: 'text',
      path: resolved,
      content: buffer.toString('utf8'),
      truncated
    };
  }

  writeTextFile(workspaceId: string, filePath: string, content: string): void {
    const resolved = this.resolvePath(workspaceId, filePath);
    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }

    fs.writeFileSync(resolved, content, 'utf8');
  }
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FileService } from '../src/engine/file-service.js';
import { EngineDatabase } from '../src/db/index.js';
import { LocalEngine } from '../src/engine/local-engine.js';

describe('FileService', () => {
  let tmpDir: string;
  let repoDir: string;
  let db: EngineDatabase;
  let engine: LocalEngine;
  let service: FileService;
  let workspaceId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-files-'));
    repoDir = path.join(tmpDir, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Hello');
    fs.mkdirSync(path.join(repoDir, 'src'));
    fs.writeFileSync(path.join(repoDir, 'src', 'index.ts'), 'export const x = 1;\n');

    engine = new LocalEngine({ dbPath: path.join(tmpDir, 'test.db') });
    db = engine.db;
    const ws = await engine.createWorkspace({ name: 'Files Test', repositories: [repoDir] });
    workspaceId = ws.id;
    service = engine.fileService;
  });

  afterEach(() => {
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists directory entries within workspace repo', () => {
    const entries = service.listDirectory(workspaceId, repoDir);
    expect(entries.map((e) => e.name)).toEqual(['src', 'README.md']);
    expect(entries[0].kind).toBe('directory');
  });

  it('reads text file content', () => {
    const filePath = path.join(repoDir, 'src', 'index.ts');
    const preview = service.readTextFile(workspaceId, filePath);
    expect(preview.kind).toBe('text');
    if (preview.kind === 'text') {
      expect(preview.content).toContain('export const x');
    }
  });

  it('writes text file content', () => {
    const filePath = path.join(repoDir, 'src', 'new.ts');
    service.writeTextFile(workspaceId, filePath, 'export const y = 2;\n');
    expect(fs.readFileSync(filePath, 'utf8')).toBe('export const y = 2;\n');
  });

  it('rejects paths outside workspace roots', () => {
    expect(() => service.listDirectory(workspaceId, '/etc')).toThrow(
      'outside allowed workspace'
    );
  });
});

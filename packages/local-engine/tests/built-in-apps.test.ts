import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EngineDatabase } from '../src/db/index.js';
import { HttpClientService } from '../src/engine/http-client-service.js';
import { DatabaseExplorerService } from '../src/engine/database-explorer-service.js';
import { DesignAssetsService } from '../src/engine/design-assets-service.js';

describe('Built-in Apps Services', () => {
  let tmpDir: string;
  let db: EngineDatabase;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-builtin-apps-'));
    db = new EngineDatabase(path.join(tmpDir, 'test.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('API Client & HTTP Requests Persistence', () => {
    it('persists, updates, and deletes saved HTTP requests in database', () => {
      const workspaceId = 'ws-api-1';
      const desktopId = 'desk-api-1';
      const now = Date.now();

      db.saveWorkspace({
        id: workspaceId,
        name: 'API Workspace',
        repositories: [],
        createdAt: now,
        updatedAt: now
      });
      db.saveDesktop({
        id: desktopId,
        workspaceId,
        name: 'API Desktop',
        type: 'build',
        order: 0,
        createdAt: now
      });

      db.saveHttpRequest({
        id: 'req-1',
        workspaceId,
        desktopId,
        name: 'Get User',
        method: 'GET',
        url: 'https://api.github.com/user',
        headers: [{ key: 'Accept', value: 'application/json' }],
        body: '',
        createdAt: 1000,
        updatedAt: 1000
      });

      const list = db.listHttpRequests(workspaceId, desktopId);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Get User');
      expect(list[0].method).toBe('GET');

      db.saveHttpRequest({
        ...list[0],
        name: 'Get Authenticated User',
        method: 'POST',
        body: '{"foo":"bar"}',
        updatedAt: 2000
      });

      const updated = db.getHttpRequest('req-1');
      expect(updated?.name).toBe('Get Authenticated User');
      expect(updated?.method).toBe('POST');
      expect(updated?.body).toBe('{"foo":"bar"}');

      const deleted = db.deleteHttpRequest('req-1');
      expect(deleted).toBe(true);
      expect(db.getHttpRequest('req-1')).toBeNull();
    });

    it('sends HTTP requests using HttpClientService', async () => {
      const client = new HttpClientService();

      // Spin up a quick local HTTP server
      const server = http.createServer((req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            res.writeHead(201, {
              'Content-Type': 'application/json',
              'X-Echo-Header': req.headers['x-custom'] as string || ''
            });
            res.end(JSON.stringify({ received: JSON.parse(body) }));
          });
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Hello Agentic');
        }
      });

      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      try {
        // Test GET
        const getRes = await client.sendRequest({
          method: 'GET',
          url: baseUrl
        });
        expect(getRes.ok).toBe(true);
        expect(getRes.status).toBe(200);
        expect(getRes.body).toBe('Hello Agentic');
        expect(getRes.durationMs).toBeGreaterThanOrEqual(0);

        // Test POST with headers and JSON body
        const postRes = await client.sendRequest({
          method: 'POST',
          url: baseUrl,
          headers: [{ key: 'X-Custom', value: 'agentic-value' }],
          body: JSON.stringify({ message: 'test' })
        });
        expect(postRes.ok).toBe(true);
        expect(postRes.status).toBe(201);
        const parsed = JSON.parse(postRes.body);
        expect(parsed.received.message).toBe('test');
        expect(postRes.headers.some((h) => h.key.toLowerCase() === 'x-echo-header' && h.value === 'agentic-value')).toBe(true);
      } finally {
        server.close();
      }
    });
  });

  describe('DatabaseExplorerService', () => {
    it('discovers databases, inspects schema, and executes read-only SQL queries', async () => {
      const explorer = new DatabaseExplorerService();
      const sqlitePath = path.join(tmpDir, 'sample.sqlite');

      // Create a test sqlite db with tables and data
      const testDb = new Database(sqlitePath);
      testDb.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT
        );
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL
        );
        INSERT INTO users (id, name, email) VALUES ('u1', 'Alice', 'alice@example.com');
        INSERT INTO users (id, name, email) VALUES ('u2', 'Bob', 'bob@example.com');
        INSERT INTO posts (user_id, title) VALUES ('u1', 'First Post');
      `);
      testDb.close();

      // 1. Discovery
      const dbs = await explorer.listDatabases([tmpDir]);
      expect(dbs).toContain(sqlitePath);

      // 2. Schema Inspection
      const inspect = await explorer.inspectDatabase(sqlitePath);
      expect(inspect.path).toBe(sqlitePath);
      expect(inspect.tables.map((t) => t.name).sort()).toEqual(['posts', 'users']);

      const usersTable = inspect.tables.find((t) => t.name === 'users');
      expect(usersTable).toBeDefined();
      expect(usersTable?.columns).toEqual(
        expect.arrayContaining([
          { name: 'id', type: 'TEXT', pk: true, notNull: false },
          { name: 'name', type: 'TEXT', pk: false, notNull: true },
          { name: 'email', type: 'TEXT', pk: false, notNull: false }
        ])
      );

      // 3. Query Execution
      const queryRes = await explorer.queryDatabase(sqlitePath, 'SELECT * FROM users ORDER BY name ASC');
      expect(queryRes.error).toBeUndefined();
      expect(queryRes.columns).toEqual(['id', 'name', 'email']);
      expect(queryRes.rows).toHaveLength(2);
      expect(queryRes.rows[0].name).toBe('Alice');
      expect(queryRes.rows[1].name).toBe('Bob');

      // Error handling on invalid SQL
      const badQueryRes = await explorer.queryDatabase(sqlitePath, 'SELECT * FROM nonexistent_table');
      expect(badQueryRes.error).toBeDefined();
    });
  });

  describe('DesignAssetsService', () => {
    it('scans workspace for images, SVGs, and extracted colors', async () => {
      const designService = new DesignAssetsService();

      // Create dummy asset files
      const imgPath = path.join(tmpDir, 'logo.png');
      fs.writeFileSync(imgPath, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG magic header

      const svgPath = path.join(tmpDir, 'icon.svg');
      const svgContent = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
      fs.writeFileSync(svgPath, svgContent);

      const cssPath = path.join(tmpDir, 'styles.css');
      const cssContent = `
        .hero { color: #3b82f6; background-color: #1e293b; }
        .button { background: #3b82f6; border-color: #10b981; }
      `;
      fs.writeFileSync(cssPath, cssContent);

      const overview = await designService.getOverview([tmpDir]);
      expect(overview.stats.images).toBeGreaterThanOrEqual(1);
      expect(overview.stats.svgs).toBeGreaterThanOrEqual(1);
      expect(overview.assets.some((a) => a.name === 'logo.png' && a.type === 'image')).toBe(true);
      expect(overview.assets.some((a) => a.name === 'icon.svg' && a.type === 'svg')).toBe(true);

      // Colors extracted
      expect(overview.colors.some((c) => c.hex.toLowerCase() === '#3b82f6')).toBe(true);
      expect(overview.colors.some((c) => c.hex.toLowerCase() === '#10b981')).toBe(true);

      // Read asset
      const assetData = await designService.readAsset(svgPath);
      expect(assetData.dataUrl).toContain('image/svg+xml');
      expect(assetData.text).toBe(svgContent);
    });
  });
});

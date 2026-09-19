import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  SqliteInspectResult,
  SqliteQueryResult,
  SqliteTableInfo,
  SqliteColumnInfo
} from '@agentic/shared-contracts';

export class DatabaseExplorerService {
  /**
   * Scans workspace directories and ~/.agentic/data/ for SQLite databases.
   */
  async listDatabases(repoPaths: string[]): Promise<string[]> {
    const results = new Set<string>();

    // Always include the local agentic.db
    const agenticDbPath = path.join(os.homedir(), '.agentic', 'data', 'agentic.db');
    if (fs.existsSync(agenticDbPath)) {
      results.add(agenticDbPath);
    }

    const sqliteExtensions = new Set(['.db', '.sqlite', '.sqlite3']);

    const scanDir = (dir: string, depth = 0) => {
      if (depth > 3 || !fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'target') {
            continue;
          }
          const fullPath = path.join(dir, entry.name);
          if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (sqliteExtensions.has(ext)) {
              results.add(fullPath);
            }
          } else if (entry.isDirectory()) {
            scanDir(fullPath, depth + 1);
          }
        }
      } catch {
        // ignore permission errors
      }
    };

    for (const repoPath of repoPaths) {
      scanDir(repoPath, 0);
    }

    return Array.from(results);
  }

  /**
   * Inspects a SQLite database file and returns table and column schema definitions.
   */
  async inspectDatabase(filePath: string): Promise<SqliteInspectResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Database file not found: ${filePath}`);
    }

    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    try {
      const tableRows = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC`
        )
        .all() as { name: string }[];

      const tables: SqliteTableInfo[] = [];

      for (const row of tableRows) {
        const tableName = row.name;
        // Escape table name for PRAGMA
        const safeName = tableName.replace(/"/g, '""');
        const colRows = db.prepare(`PRAGMA table_info("${safeName}")`).all() as any[];

        const columns: SqliteColumnInfo[] = colRows.map((c) => ({
          name: c.name,
          type: c.type || 'TEXT',
          pk: Boolean(c.pk),
          notNull: Boolean(c.notnull)
        }));

        tables.push({
          name: tableName,
          columns
        });
      }

      return {
        path: filePath,
        tables
      };
    } finally {
      db.close();
    }
  }

  /**
   * Executes a read-only SQL query on a SQLite database and returns tabulated results.
   */
  async queryDatabase(filePath: string, sql: string): Promise<SqliteQueryResult> {
    if (!fs.existsSync(filePath)) {
      return {
        columns: [],
        rows: [],
        truncated: false,
        error: `Database file not found: ${filePath}`
      };
    }

    const trimmedSql = sql.trim();
    if (!trimmedSql) {
      return {
        columns: [],
        rows: [],
        truncated: false
      };
    }

    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    try {
      const stmt = db.prepare(trimmedSql);

      // Check if it's a statement returning rows
      if (typeof stmt.all === 'function') {
        const rawRows = stmt.all() as Record<string, unknown>[];
        const truncated = rawRows.length > 100;
        const rows = rawRows.slice(0, 100);

        let columns: string[] = [];
        if (rows.length > 0) {
          columns = Object.keys(rows[0]);
        } else if (stmt.columns) {
          columns = stmt.columns().map((c) => c.name);
        }

        return {
          columns,
          rows,
          truncated
        };
      } else {
        return {
          columns: ['status'],
          rows: [{ status: 'Executed (no rows returned)' }],
          truncated: false
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        columns: [],
        rows: [],
        truncated: false,
        error: message
      };
    } finally {
      db.close();
    }
  }
}

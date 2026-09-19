export interface SqliteColumnInfo {
  name: string;
  type: string;
  pk: boolean;
  notNull: boolean;
}

export interface SqliteTableInfo {
  name: string;
  columns: SqliteColumnInfo[];
}

export interface SqliteInspectResult {
  path: string;
  tables: SqliteTableInfo[];
}

export interface SqliteQueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  truncated: boolean;
  error?: string;
}

export interface InspectSqliteParams {
  workspaceId: string;
  filePath: string;
}

export interface QuerySqliteParams {
  workspaceId: string;
  filePath: string;
  sql: string;
}

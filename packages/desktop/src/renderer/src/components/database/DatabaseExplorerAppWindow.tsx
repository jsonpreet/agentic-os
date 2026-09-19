import React, { useCallback, useEffect, useState } from 'react';
import {
  SqliteInspectResult,
  SqliteQueryResult,
  SqliteTableInfo
} from '@agentic/shared-contracts';
import {
  Database,
  Table,
  Play,
  Minus,
  X,
  RefreshCw,
  Key,
  AlertCircle,
  Loader2,
  FileCode
} from 'lucide-react';

interface DatabaseExplorerAppWindowProps {
  workspaceId: string;
  desktopId: string;
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export const DatabaseExplorerAppWindow: React.FC<DatabaseExplorerAppWindowProps> = ({
  workspaceId,
  isFocused,
  onFocus,
  onMinimize,
  onClose
}) => {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [inspectResult, setInspectResult] = useState<SqliteInspectResult | null>(null);
  const [selectedTable, setSelectedTable] = useState<SqliteTableInfo | null>(null);

  const [query, setQuery] = useState<string>('SELECT * FROM sqlite_master;');
  const [running, setRunning] = useState<boolean>(false);
  const [queryResult, setQueryResult] = useState<SqliteQueryResult | null>(null);
  const [loadingSchema, setLoadingSchema] = useState<boolean>(false);

  const loadDatabases = useCallback(async () => {
    if (!window.agenticApi) return;
    try {
      const list = await window.agenticApi.listWorkspaceDatabases(workspaceId);
      setDatabases(list);
      if (list.length > 0 && (!selectedDb || !list.includes(selectedDb))) {
        setSelectedDb(list[0]);
      }
    } catch {
      // ignore
    }
  }, [workspaceId, selectedDb]);

  useEffect(() => {
    loadDatabases();
  }, [loadDatabases]);

  const loadSchema = useCallback(async (dbPath: string) => {
    if (!window.agenticApi || !dbPath) return;
    setLoadingSchema(true);
    try {
      const res = await window.agenticApi.inspectSqliteDatabase({
        workspaceId,
        filePath: dbPath
      });
      setInspectResult(res);
      if (res.tables.length > 0) {
        setSelectedTable(res.tables[0]);
        setQuery(`SELECT * FROM "${res.tables[0].name}" LIMIT 50;`);
      } else {
        setSelectedTable(null);
        setQuery('SELECT 1;');
      }
    } catch (err: unknown) {
      setInspectResult(null);
    } finally {
      setLoadingSchema(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (selectedDb) {
      loadSchema(selectedDb);
    }
  }, [selectedDb, loadSchema]);

  const runQuery = async () => {
    if (!selectedDb || !query.trim() || running || !window.agenticApi) return;
    setRunning(true);
    try {
      const res = await window.agenticApi.querySqliteDatabase({
        workspaceId,
        filePath: selectedDb,
        sql: query
      });
      setQueryResult(res);
    } catch (err: unknown) {
      setQueryResult({
        columns: [],
        rows: [],
        truncated: false,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setRunning(false);
    }
  };

  const handleSelectTable = (table: SqliteTableInfo) => {
    setSelectedTable(table);
    setQuery(`SELECT * FROM "${table.name}" LIMIT 50;`);
  };

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-database-window
    >
      {/* Titlebar */}
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move shrink-0">
        <Database className="w-3.5 h-3.5 text-primary ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] flex-1">Database Explorer</span>

        {/* Database selector */}
        {databases.length > 0 && (
          <select
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
            className="px-2 py-0.5 rounded text-[11px] glass-chip border border-[var(--glass-border-subtle)] text-[var(--glass-text)] bg-transparent outline-none max-w-[200px] truncate mr-2"
          >
            {databases.map((db) => {
              const name = db.split('/').pop() || db;
              return (
                <option key={db} value={db} className="bg-neutral-900 text-white">
                  {name}
                </option>
              );
            })}
          </select>
        )}

        <button
          type="button"
          onClick={() => {
            loadDatabases();
            if (selectedDb) loadSchema(selectedDb);
          }}
          className="p-1 rounded-md hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)]"
          title="Refresh databases"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onMinimize}
          className="p-1 rounded-md hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)]"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)]"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar: Tables & Columns */}
        <aside className="w-60 border-r border-[var(--glass-border-subtle)] flex flex-col shrink-0">
          <div className="p-2 border-b border-[var(--glass-border-subtle)] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[var(--glass-text-muted)] uppercase tracking-wider">
              Tables ({inspectResult?.tables.length ?? 0})
            </span>
            {loadingSchema && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {inspectResult?.tables.length === 0 && !loadingSchema && (
              <p className="text-[11px] text-[var(--glass-text-muted)] px-2 py-3 text-center">
                No tables found.
              </p>
            )}

            {inspectResult?.tables.map((table) => {
              const isSelected = selectedTable?.name === table.name;
              return (
                <div key={table.name} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => handleSelectTable(table)}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                      isSelected
                        ? 'glass-chip-active text-[var(--glass-text)]'
                        : 'text-[var(--glass-text-muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--glass-text)]'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5 shrink-0 text-primary/80" />
                    <span className="truncate flex-1 text-left">{table.name}</span>
                    <span className="text-[10px] text-[var(--glass-text-muted)] opacity-60">
                      {table.columns.length}
                    </span>
                  </button>

                  {/* Expanded Columns under active table */}
                  {isSelected && (
                    <div className="pl-5 pr-1 py-1 space-y-1">
                      {table.columns.map((col) => (
                        <div
                          key={col.name}
                          className="flex items-center justify-between text-[11px] text-[var(--glass-text-muted)] py-0.5"
                        >
                          <div className="flex items-center gap-1 truncate">
                            {col.pk && <Key className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                            <span className="truncate font-mono">{col.name}</span>
                          </div>
                          <span className="text-[9px] font-mono opacity-70 bg-white/5 px-1 rounded">
                            {col.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Main: Query Editor & Tabular Results */}
        <section className="flex-1 flex flex-col min-w-0">
          {/* SQL Editor */}
          <div className="p-3 border-b border-[var(--glass-border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--glass-text-muted)] flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5" /> SQL Query
              </span>
              <button
                type="button"
                onClick={runQuery}
                disabled={running || !selectedDb}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition shadow-sm"
              >
                {running ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                Run (⌘↵)
              </button>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void runQuery();
                }
              }}
              rows={3}
              placeholder="SELECT * FROM table LIMIT 50;"
              className="w-full p-2.5 rounded-lg bg-[var(--glass-input-bg)] border border-[var(--glass-border-subtle)] font-mono text-xs text-[var(--glass-text)] placeholder-[var(--glass-text-muted)] outline-none resize-none focus:border-primary/50"
            />
          </div>

          {/* Results Table */}
          <div className="flex-1 flex flex-col min-h-0 bg-black/10">
            <div className="px-3 py-2 border-b border-[var(--glass-border-subtle)] flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-[var(--glass-text)]">Results</span>
              {queryResult && !queryResult.error && (
                <div className="flex items-center gap-2 text-[11px] text-[var(--glass-text-muted)]">
                  <span>{queryResult.rows.length} rows</span>
                  {queryResult.truncated && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400">
                      Limit 100
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {!queryResult && !running && (
                <div className="h-full flex flex-col items-center justify-center text-[var(--glass-text-muted)] gap-1">
                  <Database className="w-6 h-6 opacity-30" />
                  <p className="text-xs">Execute a query or pick a table to view rows.</p>
                </div>
              )}

              {running && (
                <div className="h-full flex flex-col items-center justify-center text-[var(--glass-text-muted)] gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs">Executing query…</p>
                </div>
              )}

              {queryResult?.error && (
                <div className="m-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-mono text-xs">{queryResult.error}</span>
                </div>
              )}

              {queryResult && !queryResult.error && queryResult.columns.length > 0 && (
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--glass-border-subtle)] bg-white/5 sticky top-0">
                        {queryResult.columns.map((col) => (
                          <th
                            key={col}
                            className="px-3 py-2 font-mono font-semibold text-[var(--glass-text)] whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border-subtle)] font-mono text-[11px]">
                      {queryResult.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-[var(--glass-hover)] transition-colors"
                        >
                          {queryResult.columns.map((col) => {
                            const val = row[col];
                            return (
                              <td
                                key={col}
                                className="px-3 py-1.5 whitespace-nowrap text-[var(--glass-text)] max-w-xs truncate"
                              >
                                {val === null ? (
                                  <span className="text-[var(--glass-text-muted)] italic">NULL</span>
                                ) : typeof val === 'object' ? (
                                  JSON.stringify(val)
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {queryResult && !queryResult.error && queryResult.columns.length === 0 && (
                <div className="h-full flex items-center justify-center text-[var(--glass-text-muted)] text-xs">
                  Query returned 0 columns and 0 rows.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SavedHttpRequest,
  HttpMethod,
  HttpHeader,
  HttpResponseResult
} from '@agentic/shared-contracts';
import {
  Send,
  Plus,
  Trash2,
  Minus,
  X,
  Check,
  Copy,
  Globe,
  Loader2,
  Clock,
  AlertCircle
} from 'lucide-react';

interface ApiClientAppWindowProps {
  workspaceId: string;
  desktopId: string;
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  POST: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  PUT: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  PATCH: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  DELETE: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  HEAD: 'text-slate-400 bg-slate-500/10 border-slate-500/30'
};

export const ApiClientAppWindow: React.FC<ApiClientAppWindowProps> = ({
  workspaceId,
  desktopId,
  isFocused,
  onFocus,
  onMinimize,
  onClose
}) => {
  const [requests, setRequests] = useState<SavedHttpRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Active request state
  const [name, setName] = useState('New Request');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<HttpHeader[]>([]);
  const [body, setBody] = useState('');

  // UI tabs & execution
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HttpResponseResult | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshRequests = useCallback(async () => {
    if (!window.agenticApi) return;
    try {
      const list = await window.agenticApi.listHttpRequests(workspaceId, desktopId);
      setRequests(list);
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch {
      // ignore
    }
  }, [workspaceId, desktopId, selectedId]);

  useEffect(() => {
    refreshRequests();
  }, [refreshRequests]);

  // Load selected request into editor
  useEffect(() => {
    if (!selectedId) {
      setName('New Request');
      setMethod('GET');
      setUrl('');
      setHeaders([]);
      setBody('');
      setResponse(null);
      return;
    }
    const item = requests.find((r) => r.id === selectedId);
    if (!item) return;
    setName(item.name);
    setMethod(item.method);
    setUrl(item.url);
    setHeaders(item.headers || []);
    setBody(item.body || '');
    setResponse(null);
  }, [selectedId, requests]);

  // Autosave when active request edits
  const scheduleSave = useCallback(
    (updated: { name?: string; method?: HttpMethod; url?: string; headers?: HttpHeader[]; body?: string }) => {
      if (!selectedId || !window.agenticApi) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveStatus('saving');

      saveTimerRef.current = setTimeout(async () => {
        try {
          const res = await window.agenticApi.updateHttpRequest({
            requestId: selectedId,
            name: updated.name ?? name,
            method: updated.method ?? method,
            url: updated.url ?? url,
            headers: updated.headers ?? headers,
            body: updated.body ?? body
          });
          setRequests((prev) => prev.map((item) => (item.id === selectedId ? res : item)));
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 1500);
        } catch {
          setSaveStatus('idle');
        }
      }, 500);
    },
    [selectedId, name, method, url, headers, body]
  );

  const handleCreateRequest = async () => {
    if (!window.agenticApi) return;
    try {
      const created = await window.agenticApi.createHttpRequest({
        workspaceId,
        desktopId,
        name: 'New Request',
        method: 'GET',
        url: 'https://httpbin.org/get',
        headers: [{ key: 'Accept', value: 'application/json' }],
        body: ''
      });
      setRequests((prev) => [created, ...prev]);
      setSelectedId(created.id);
    } catch {
      // ignore
    }
  };

  const handleDeleteRequest = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.agenticApi) return;
    try {
      await window.agenticApi.deleteHttpRequest(id);
      const remaining = requests.filter((r) => r.id !== id);
      setRequests(remaining);
      if (selectedId === id) {
        setSelectedId(remaining[0]?.id || null);
      }
    } catch {
      // ignore
    }
  };

  const handleSend = async () => {
    if (!url.trim() || loading || !window.agenticApi) return;
    setLoading(true);
    setResponse(null);

    // Save immediate state
    if (selectedId) {
      void window.agenticApi.updateHttpRequest({
        requestId: selectedId,
        name,
        method,
        url,
        headers,
        body
      });
    }

    try {
      const res = await window.agenticApi.sendHttpRequest({
        method,
        url,
        headers,
        body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined
      });
      setResponse(res);
    } catch (err: unknown) {
      setResponse({
        ok: false,
        headers: [],
        body: '',
        durationMs: 0,
        error: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddHeader = () => {
    const updated = [...headers, { key: '', value: '' }];
    setHeaders(updated);
    scheduleSave({ headers: updated });
  };

  const handleHeaderChange = (index: number, key: string, value: string) => {
    const updated = headers.map((h, i) => (i === index ? { key, value } : h));
    setHeaders(updated);
    scheduleSave({ headers: updated });
  };

  const handleRemoveHeader = (index: number) => {
    const updated = headers.filter((_, i) => i !== index);
    setHeaders(updated);
    scheduleSave({ headers: updated });
  };

  const handleCopyResponseBody = () => {
    if (!response?.body) return;
    navigator.clipboard.writeText(response.body);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(body);
      const formatted = JSON.stringify(parsed, null, 2);
      setBody(formatted);
      scheduleSave({ body: formatted });
    } catch {
      // invalid json, ignore
    }
  };

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-api-client-window
    >
      {/* Titlebar */}
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move shrink-0">
        <Globe className="w-3.5 h-3.5 text-primary ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] flex-1">API Client</span>
        {saveStatus === 'saving' && (
          <span className="text-[10px] text-[var(--glass-text-muted)] mr-1">Saving…</span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-[10px] text-emerald-400 mr-1">Saved</span>
        )}
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
        {/* Requests Sidebar */}
        <aside className="w-56 border-r border-[var(--glass-border-subtle)] flex flex-col shrink-0">
          <div className="p-2 border-b border-[var(--glass-border-subtle)]">
            <button
              type="button"
              onClick={handleCreateRequest}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg glass-chip text-xs text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New Request
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {requests.length === 0 && (
              <p className="text-[11px] text-[var(--glass-text-muted)] px-2 py-3 text-center">
                No saved requests.
              </p>
            )}
            {requests.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer transition ${
                  item.id === selectedId
                    ? 'glass-chip-active text-[var(--glass-text)]'
                    : 'text-[var(--glass-text-muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--glass-text)]'
                }`}
              >
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                    METHOD_COLORS[item.method] || 'text-neutral-400'
                  }`}
                >
                  {item.method}
                </span>
                <span className="flex-1 truncate font-medium">{item.name || 'Untitled'}</span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteRequest(item.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 rounded transition"
                  title="Delete request"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Request & Response Section */}
        <section className="flex-1 flex flex-col min-w-0">
          {/* Top Bar: Method, URL, Send */}
          <div className="p-3 border-b border-[var(--glass-border-subtle)] space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  scheduleSave({ name: e.target.value });
                }}
                placeholder="Request Name"
                className="bg-transparent text-sm font-semibold text-[var(--glass-text)] outline-none flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={method}
                onChange={(e) => {
                  const m = e.target.value as HttpMethod;
                  setMethod(m);
                  scheduleSave({ method: m });
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold glass-chip border border-[var(--glass-border-subtle)] text-[var(--glass-text)] bg-transparent outline-none cursor-pointer"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m} className="bg-neutral-900 text-white">
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  scheduleSave({ url: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSend();
                }}
                placeholder="https://api.example.com/v1/resource"
                className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--glass-input-bg)] border border-[var(--glass-border-subtle)] text-[var(--glass-text)] placeholder-[var(--glass-text-muted)] outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !url.trim()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send
              </button>
            </div>
          </div>

          {/* Request Configuration Tabs */}
          <div className="flex border-b border-[var(--glass-border-subtle)] px-3 text-xs gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('params')}
              className={`py-2 border-b-2 font-medium transition ${
                activeTab === 'params'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]'
              }`}
            >
              Headers ({headers.length})
            </button>
            {['POST', 'PUT', 'PATCH'].includes(method) && (
              <button
                type="button"
                onClick={() => setActiveTab('body')}
                className={`py-2 border-b-2 font-medium transition ${
                  activeTab === 'body'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]'
                }`}
              >
                Body (JSON)
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-3 min-h-[140px] max-h-[220px] border-b border-[var(--glass-border-subtle)]">
            {activeTab === 'params' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--glass-text-muted)]">
                    HTTP Headers
                  </span>
                  <button
                    type="button"
                    onClick={handleAddHeader}
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Header
                  </button>
                </div>
                {headers.length === 0 && (
                  <p className="text-[11px] text-[var(--glass-text-muted)] py-2">
                    No custom headers specified.
                  </p>
                )}
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Header Name"
                      value={h.key}
                      onChange={(e) => handleHeaderChange(i, e.target.value, h.value)}
                      className="w-1/3 px-2 py-1 rounded bg-[var(--glass-input-bg)] border border-[var(--glass-border-subtle)] text-xs text-[var(--glass-text)] outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={h.value}
                      onChange={(e) => handleHeaderChange(i, h.key, e.target.value)}
                      className="flex-1 px-2 py-1 rounded bg-[var(--glass-input-bg)] border border-[var(--glass-border-subtle)] text-xs text-[var(--glass-text)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveHeader(i)}
                      className="p-1 text-[var(--glass-text-muted)] hover:text-rose-400 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'body' && (
              <div className="h-full flex flex-col space-y-1.5">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={formatJson}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Format JSON
                  </button>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => {
                    setBody(e.target.value);
                    scheduleSave({ body: e.target.value });
                  }}
                  placeholder='{\n  "key": "value"\n}'
                  className="flex-1 w-full p-2.5 rounded-lg bg-[var(--glass-input-bg)] border border-[var(--glass-border-subtle)] font-mono text-xs text-[var(--glass-text)] placeholder-[var(--glass-text-muted)] outline-none resize-none"
                />
              </div>
            )}
          </div>

          {/* Response Viewer */}
          <div className="flex-1 flex flex-col min-h-0 bg-black/10">
            <div className="px-3 py-2 border-b border-[var(--glass-border-subtle)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[var(--glass-text)]">Response</span>
                {response && (
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        response.ok
                          ? 'text-emerald-400 bg-emerald-500/15'
                          : 'text-rose-400 bg-rose-500/15'
                      }`}
                    >
                      {response.status || (response.ok ? '200 OK' : 'ERR')} {response.statusText}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-[var(--glass-text-muted)]">
                      <Clock className="w-3 h-3" />
                      {response.durationMs}ms
                    </span>
                  </div>
                )}
              </div>
              {response?.body && (
                <button
                  type="button"
                  onClick={handleCopyResponseBody}
                  className="flex items-center gap-1 text-xs text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] px-2 py-0.5 rounded glass-chip"
                >
                  {copiedResponse ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copiedResponse ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto p-3 font-mono text-xs">
              {!response && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-[var(--glass-text-muted)] gap-1">
                  <Send className="w-6 h-6 opacity-30" />
                  <p className="text-xs">Enter a URL and click Send to test your endpoint.</p>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center text-[var(--glass-text-muted)] gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs">Sending HTTP request…</p>
                </div>
              )}

              {response?.error && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-mono text-xs">{response.error}</span>
                </div>
              )}

              {response && !response.error && (
                <pre className="whitespace-pre-wrap text-[var(--glass-text)]">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(response.body), null, 2);
                    } catch {
                      return response.body || '(Empty response body)';
                    }
                  })()}
                </pre>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

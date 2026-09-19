import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityCategory,
  ActivityEvent,
  ActivitySeverity
} from '@agentic/shared-contracts';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  Filter,
  GitBranch,
  Globe,
  Info,
  Minus,
  RefreshCw,
  Search,
  Server,
  Trash2,
  Wifi,
  X
} from 'lucide-react';

interface ActivityLogsAppWindowProps {
  workspaceId: string;
  desktopId: string;
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onFocusAgent?: (sessionId: string) => void;
}

const CATEGORY_ICONS: Record<ActivityCategory, React.ComponentType<{ className?: string }>> = {
  agent: Bot,
  git: GitBranch,
  dev_server: Server,
  browser: Globe,
  network: Wifi,
  database: Database,
  system: Cpu
};

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  agent: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  git: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  dev_server: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  browser: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  network: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  database: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  system: 'text-slate-400 bg-slate-500/10 border-slate-500/30'
};

const SEVERITY_CONFIG: Record<
  ActivitySeverity,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badge: string }
> = {
  info: {
    label: 'Info',
    icon: Info,
    color: 'text-sky-400',
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20'
  },
  success: {
    label: 'Success',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  },
  warn: {
    label: 'Warning',
    icon: AlertTriangle,
    color: 'text-amber-400',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  },
  error: {
    label: 'Error',
    icon: AlertCircle,
    color: 'text-rose-400',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  }
};

export const ActivityLogsAppWindow: React.FC<ActivityLogsAppWindowProps> = ({
  workspaceId,
  desktopId,
  isFocused,
  onFocus,
  onMinimize,
  onClose,
  onFocusAgent
}) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [liveStream, setLiveStream] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadEvents = useCallback(async () => {
    if (!window.agenticApi) return;
    setLoading(true);
    try {
      const list = await window.agenticApi.listActivityEvents({
        workspaceId,
        limit: 300
      });
      setEvents(list);
    } catch (err) {
      console.error('Failed to load activity events', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Real-time activity events
  useEffect(() => {
    if (!window.agenticApi || !liveStream) return;
    const unsub = window.agenticApi.onActivityEvent((newEvent) => {
      // Prepend or add new event
      setEvents((prev) => {
        // Prevent duplicate events
        if (prev.some((e) => e.id === newEvent.id)) return prev;
        return [newEvent, ...prev].slice(0, 500);
      });
    });
    return unsub;
  }, [liveStream]);

  const toggleExpand = (id: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopyJson = (event: ActivityEvent) => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopiedId(event.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleClear = async () => {
    if (!window.agenticApi) return;
    if (confirm('Are you sure you want to clear the activity log for this workspace?')) {
      await window.agenticApi.clearActivityEvents(workspaceId);
      setEvents([]);
    }
  };

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `agentic-activity-log-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedCategory !== 'all' && e.category !== selectedCategory) {
        return false;
      }
      if (selectedSeverity !== 'all' && e.severity !== selectedSeverity) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = e.title.toLowerCase().includes(query);
        const matchMsg = e.message.toLowerCase().includes(query);
        const matchMeta = e.metadata
          ? JSON.stringify(e.metadata).toLowerCase().includes(query)
          : false;
        if (!matchTitle && !matchMsg && !matchMeta) return false;
      }
      return true;
    });
  }, [events, selectedCategory, selectedSeverity, searchQuery]);

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const categories: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'agent', label: 'Agents' },
    { id: 'git', label: 'Git' },
    { id: 'dev_server', label: 'Dev Servers' },
    { id: 'browser', label: 'Browser' },
    { id: 'network', label: 'Network' },
    { id: 'database', label: 'Database' },
    { id: 'system', label: 'System' }
  ];

  return (
    <div
      onMouseDown={onFocus}
      className={`flex flex-col h-full w-full bg-[#0d0f12]/95 backdrop-blur-2xl text-slate-200 select-none overflow-hidden rounded-xl border transition-colors ${
        isFocused ? 'border-sky-500/40 shadow-2xl shadow-sky-950/20' : 'border-white/10'
      }`}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] border-b border-white/[0.08] drag-handle">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 mr-2">
            <button
              onClick={onClose}
              title="Close"
              className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 flex items-center justify-center group"
            >
              <X className="w-2 h-2 text-rose-950 opacity-0 group-hover:opacity-100" />
            </button>
            <button
              onClick={onMinimize}
              title="Minimize"
              className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 flex items-center justify-center group"
            >
              <Minus className="w-2 h-2 text-amber-950 opacity-0 group-hover:opacity-100" />
            </button>
            <div className="w-3 h-3 rounded-full bg-emerald-500/40 cursor-default" />
          </div>

          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-100 tracking-wide">
              Activity & Logs
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLiveStream(!liveStream)}
            title={liveStream ? 'Live stream active (click to pause)' : 'Paused (click to resume)'}
            className={`flex items-center gap-1.5 px-2 py-1 text-[11px] rounded font-medium border transition-colors ${
              liveStream
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${liveStream ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}
            />
            {liveStream ? 'Live' : 'Paused'}
          </button>

          <button
            onClick={loadEvents}
            disabled={loading}
            title="Refresh logs"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExport}
            disabled={events.length === 0}
            title="Export JSON"
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClear}
            disabled={events.length === 0}
            title="Clear all logs"
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Toolbar: Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-white/[0.06] bg-black/20 text-xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Severity Filter */}
        <div className="flex items-center gap-2">
          {/* Severity filter */}
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-md px-2 py-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-transparent text-[11px] text-slate-300 outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#181a1f] text-slate-200">All Levels</option>
              <option value="info" className="bg-[#181a1f] text-sky-400">Info</option>
              <option value="success" className="bg-[#181a1f] text-emerald-400">Success</option>
              <option value="warn" className="bg-[#181a1f] text-amber-400">Warning</option>
              <option value="error" className="bg-[#181a1f] text-rose-400">Error</option>
            </select>
          </div>

          {/* Search box */}
          <div className="relative flex items-center">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 pl-7 pr-6 py-1 bg-white/[0.04] border border-white/10 rounded-md text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 p-0.5 text-slate-400 hover:text-slate-200"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Events Feed */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto divide-y divide-white/[0.04] text-xs font-mono"
      >
        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
            <span>Loading activity events...</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 py-12">
            <Activity className="w-8 h-8 text-slate-600" />
            <span className="text-slate-400 font-medium">No activity events found</span>
            {(searchQuery || selectedCategory !== 'all' || selectedSeverity !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedSeverity('all');
                }}
                className="text-[11px] text-sky-400 hover:underline mt-1"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const isExpanded = expandedEventIds.has(evt.id);
            const CatIcon = CATEGORY_ICONS[evt.category] || Activity;
            const catBadge = CATEGORY_COLORS[evt.category] || 'text-slate-400 bg-slate-500/10';
            const sevCfg = SEVERITY_CONFIG[evt.severity] || SEVERITY_CONFIG.info;
            const SevIcon = sevCfg.icon;
            const hasMetadata = evt.metadata && Object.keys(evt.metadata).length > 0;
            const sessionId = evt.metadata?.sessionId as string | undefined;

            return (
              <div
                key={evt.id}
                className="group hover:bg-white/[0.02] transition-colors px-3 py-2 text-slate-300"
              >
                <div className="flex items-start gap-2.5">
                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0 pt-0.5 w-16">
                    <Clock className="w-2.5 h-2.5 opacity-60" />
                    <span>{formatTimestamp(evt.createdAt)}</span>
                  </div>

                  {/* Severity Icon */}
                  <div className="shrink-0 pt-0.5" title={sevCfg.label}>
                    <SevIcon className={`w-3.5 h-3.5 ${sevCfg.color}`} />
                  </div>

                  {/* Category Pill */}
                  <div
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${catBadge}`}
                  >
                    <CatIcon className="w-2.5 h-2.5" />
                    <span>{evt.category}</span>
                  </div>

                  {/* Title & Message */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 text-xs truncate">
                        {evt.title}
                      </span>
                      {sessionId && onFocusAgent && (
                        <button
                          onClick={() => onFocusAgent(sessionId)}
                          className="text-[10px] text-purple-400 hover:text-purple-300 underline font-sans"
                        >
                          View Agent
                        </button>
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px] font-sans break-words mt-0.5 select-text">
                      {evt.message}
                    </p>

                    {/* Metadata Drawer */}
                    {isExpanded && hasMetadata && (
                      <div className="mt-2 p-2 bg-black/40 rounded border border-white/[0.06] text-[11px] overflow-x-auto text-emerald-400/90 font-mono">
                        <pre className="select-text">{JSON.stringify(evt.metadata, null, 2)}</pre>
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopyJson(evt)}
                      title="Copy event JSON"
                      className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {hasMetadata && (
                      <button
                        onClick={() => toggleExpand(evt.id)}
                        title={isExpanded ? 'Collapse details' : 'Expand details'}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Status bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 border-t border-white/[0.06] bg-white/[0.02] text-[10px] text-slate-500">
        <div>
          Showing {filteredEvents.length} of {events.length} events
        </div>
        <div>
          Workspace: <span className="text-slate-400">{workspaceId || 'Global'}</span>
        </div>
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import {
  DesignOverview,
  DesignAssetItem,
  ColorToken
} from '@agentic/shared-contracts';
import {
  Palette,
  Image as ImageIcon,
  Type,
  RefreshCw,
  Minus,
  X,
  Copy,
  Check,
  Search,
  Code,
  FileCode,
  Loader2
} from 'lucide-react';

interface DesignAssetsAppWindowProps {
  workspaceId: string;
  desktopId: string;
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export const DesignAssetsAppWindow: React.FC<DesignAssetsAppWindowProps> = ({
  workspaceId,
  isFocused,
  onFocus,
  onMinimize,
  onClose
}) => {
  const [overview, setOverview] = useState<DesignOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'assets' | 'colors' | 'typography'>('assets');
  const [assetFilter, setAssetFilter] = useState<'all' | 'image' | 'svg' | 'font'>('all');
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Asset previews cache: path -> { dataUrl, text }
  const [assetData, setAssetData] = useState<Record<string, { dataUrl: string; text?: string }>>({});

  const loadOverview = useCallback(async () => {
    if (!window.agenticApi) return;
    setLoading(true);
    try {
      const data = await window.agenticApi.getDesignOverview(workspaceId);
      setOverview(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Load previews for visible assets
  const loadAssetPreview = useCallback(async (filePath: string) => {
    if (assetData[filePath] || !window.agenticApi) return;
    try {
      const data = await window.agenticApi.readAssetContent(filePath);
      setAssetData((prev) => ({ ...prev, [filePath]: data }));
    } catch {
      // ignore
    }
  }, [assetData]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const filteredAssets = (overview?.assets || []).filter((a) => {
    if (assetFilter !== 'all' && a.type !== assetFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.relativePath.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-design-window
    >
      {/* Titlebar */}
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move shrink-0">
        <Palette className="w-3.5 h-3.5 text-primary ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] flex-1">Design & Assets</span>

        {overview?.stats && (
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-[var(--glass-text-muted)] mr-2">
            <span>{overview.stats.images} images</span>
            <span>•</span>
            <span>{overview.stats.svgs} svgs</span>
            <span>•</span>
            <span>{overview.stats.colors} colors</span>
          </div>
        )}

        <button
          type="button"
          onClick={loadOverview}
          className="p-1 rounded-md hover:bg-[var(--glass-hover)] text-[var(--glass-text-muted)]"
          title="Refresh Assets"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
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

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--glass-border-subtle)] px-3 text-xs shrink-0">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('assets')}
            className={`py-2 border-b-2 font-medium flex items-center gap-1.5 transition ${
              activeTab === 'assets'
                ? 'border-primary text-primary'
                : 'border-transparent text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Assets ({overview?.assets.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('colors')}
            className={`py-2 border-b-2 font-medium flex items-center gap-1.5 transition ${
              activeTab === 'colors'
                ? 'border-primary text-primary'
                : 'border-transparent text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" /> Colors ({overview?.colors.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('typography')}
            className={`py-2 border-b-2 font-medium flex items-center gap-1.5 transition ${
              activeTab === 'typography'
                ? 'border-primary text-primary'
                : 'border-transparent text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]'
            }`}
          >
            <Type className="w-3.5 h-3.5" /> Typography
          </button>
        </div>

        {activeTab === 'assets' && (
          <div className="flex items-center gap-2 py-1">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--glass-input-bg)] border border-[var(--glass-border-subtle)]">
              <Search className="w-3 h-3 text-[var(--glass-text-muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets…"
                className="bg-transparent text-[11px] text-[var(--glass-text)] placeholder-[var(--glass-text-muted)] outline-none w-28"
              />
            </div>
            <div className="flex rounded-lg p-0.5 glass-chip">
              {(['all', 'image', 'svg', 'font'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setAssetFilter(filter)}
                  className={`px-2 py-0.5 rounded text-[10px] capitalize transition ${
                    assetFilter === filter
                      ? 'bg-primary text-white font-semibold'
                      : 'text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {loading && !overview && (
          <div className="h-full flex flex-col items-center justify-center text-[var(--glass-text-muted)] gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs">Scanning workspace design tokens and media…</p>
          </div>
        )}

        {/* Tab 1: Assets */}
        {activeTab === 'assets' && (
          <div className="space-y-4">
            {filteredAssets.length === 0 && !loading && (
              <div className="h-40 flex flex-col items-center justify-center text-[var(--glass-text-muted)] gap-1">
                <ImageIcon className="w-8 h-8 opacity-30" />
                <p className="text-xs">No assets found matching criteria.</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredAssets.map((asset) => {
                const preview = assetData[asset.path];
                // Trigger preview load
                if (!preview) {
                  void loadAssetPreview(asset.path);
                }

                return (
                  <div
                    key={asset.path}
                    className="p-2.5 rounded-xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] hover:border-primary/40 transition group flex flex-col justify-between space-y-2"
                  >
                    {/* Visual Preview Box */}
                    <div className="h-28 rounded-lg bg-black/20 flex items-center justify-center overflow-hidden p-2 relative">
                      {asset.type === 'image' && preview?.dataUrl && (
                        <img
                          src={preview.dataUrl}
                          alt={asset.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      )}
                      {asset.type === 'svg' && preview?.text && (
                        <div
                          className="max-h-full max-w-full flex items-center justify-center text-primary svg-preview"
                          dangerouslySetInnerHTML={{ __html: preview.text }}
                        />
                      )}
                      {asset.type === 'svg' && !preview?.text && preview?.dataUrl && (
                        <img
                          src={preview.dataUrl}
                          alt={asset.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      )}
                      {asset.type === 'font' && (
                        <div className="flex flex-col items-center justify-center text-[var(--glass-text)]">
                          <Type className="w-8 h-8 text-primary/70 mb-1" />
                          <span className="text-[10px] font-mono opacity-60">
                            {asset.ext.toUpperCase()}
                          </span>
                        </div>
                      )}
                      {!preview && (
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--glass-text-muted)]" />
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[var(--glass-text)] truncate" title={asset.name}>
                        {asset.name}
                      </div>
                      <div className="text-[10px] text-[var(--glass-text-muted)] truncate mt-0.5">
                        {asset.relativePath}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 pt-1 border-t border-[var(--glass-border-subtle)]">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(asset.relativePath, `path-${asset.path}`)}
                        className="flex-1 py-1 rounded text-[10px] text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition flex items-center justify-center gap-1"
                        title="Copy Relative Path"
                      >
                        {copiedKey === `path-${asset.path}` ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                        Path
                      </button>

                      {asset.type === 'svg' && preview?.text && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(preview.text!, `svg-${asset.path}`)}
                            className="py-1 px-1.5 rounded text-[10px] text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] hover:bg-[var(--glass-hover)] transition flex items-center gap-1"
                            title="Copy Raw SVG"
                          >
                            {copiedKey === `svg-${asset.path}` ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Code className="w-2.5 h-2.5" />
                            )}
                            SVG
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Colors */}
        {activeTab === 'colors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--glass-text-muted)]">
                Extracted color palette from stylesheets and source code across the workspace.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {(overview?.colors || []).map((token) => {
                const isCopied = copiedKey === `hex-${token.hex}`;
                return (
                  <div
                    key={token.hex}
                    onClick={() => copyToClipboard(token.hex, `hex-${token.hex}`)}
                    className="p-2.5 rounded-xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] hover:border-primary/50 cursor-pointer transition flex flex-col space-y-2 group"
                  >
                    <div
                      className="h-16 w-full rounded-lg shadow-inner border border-white/10"
                      style={{ backgroundColor: token.hex }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[var(--glass-text)] uppercase">
                        {token.hex}
                      </span>
                      <span className="text-[10px] text-[var(--glass-text-muted)] opacity-70">
                        {token.count}x
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--glass-text-muted)] pt-0.5 border-t border-[var(--glass-border-subtle)]">
                      <span>{isCopied ? 'Copied!' : 'Click to copy'}</span>
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Typography */}
        {activeTab === 'typography' && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--glass-text-muted)]">
              Workspace typography scale and font preview.
            </p>

            <div className="space-y-3">
              {[
                { label: 'Display / Hero', size: '36px', weight: '700', sample: 'Agentic Operating System' },
                { label: 'Heading 1', size: '28px', weight: '700', sample: 'Autonomous Agent Orchestration' },
                { label: 'Heading 2', size: '20px', weight: '600', sample: 'Multi-desktop glass workspace' },
                { label: 'Heading 3', size: '16px', weight: '600', sample: 'Reactive streaming execution' },
                { label: 'Body Regular', size: '14px', weight: '400', sample: 'The quick brown fox jumps over the lazy dog.' },
                { label: 'Body Small / Caption', size: '12px', weight: '400', sample: 'Designed with macOS liquid glass aesthetic and micro-interactions.' },
                { label: 'Monospace Code', size: '12px', weight: '500', sample: 'const engine = new LocalEngine({ relayUrl });', mono: true }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="w-44 shrink-0">
                    <div className="text-xs font-medium text-[var(--glass-text)]">{item.label}</div>
                    <div className="text-[10px] text-[var(--glass-text-muted)] font-mono mt-0.5">
                      {item.size} • {item.weight}
                    </div>
                  </div>
                  <div
                    className={`flex-1 text-[var(--glass-text)] truncate ${
                      item.mono ? 'font-mono' : ''
                    }`}
                    style={{ fontSize: item.size, fontWeight: item.weight }}
                  >
                    {item.sample}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { AgentProvider, AgentSession, DiscoveredCLI } from '@agentic/shared-contracts';
import {
  X,
  RefreshCw,
  Terminal,
  CheckCircle2,
  XCircle,
  Info,
  Pencil,
  Image,
  Upload,
  Palette,
  Mic,
  GitPullRequest,
  Cloud,
  BarChart3,
  Boxes
} from 'lucide-react';
import { SpeechSettingsPanel } from './SpeechSettingsPanel.js';
import { GitHubSettingsPanel } from './GitHubSettingsPanel.js';
import { CloudSettingsPanel } from './CloudSettingsPanel.js';
import { UsageSettingsPanel } from './UsageSettingsPanel.js';
import { ExtensionsSettingsPanel } from './ExtensionsSettingsPanel.js';
import {
  BUILTIN_WALLPAPERS,
  WallpaperSelection,
  getBuiltinWallpaper
} from '../../lib/wallpaper.js';
import { saveCustomWallpaper } from '../../lib/wallpaper-store.js';
import { ThemeSettingsPanel } from './ThemeSettingsPanel.js';
import { UiThemePreference } from '../../lib/ui-theme.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  discoveredCLIs: DiscoveredCLI[];
  onRescanCLIs: () => Promise<void>;
  onSetManualCLIPath: (provider: AgentProvider, executablePath: string | null) => Promise<void>;
  wallpaper: WallpaperSelection;
  onWallpaperChange: (selection: WallpaperSelection) => void;
  activeDesktopName?: string;
  initialTab?: SettingsTab;
  agentSessions: AgentSession[];
  onAgentVoiceChange: (sessionId: string, voiceId: string | null) => Promise<void>;
  themePreference: UiThemePreference;
  onThemePreferenceChange: (preference: UiThemePreference) => void;
}

export type SettingsTab =
  | 'appearance'
  | 'cli'
  | 'speech'
  | 'github'
  | 'cloud'
  | 'usage'
  | 'extensions';

const SETTINGS_NAV: Array<{
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'appearance', label: 'Appearance', icon: Image },
  { id: 'speech', label: 'Speech', icon: Mic },
  { id: 'cloud', label: 'Cloud', icon: Cloud },
  { id: 'github', label: 'GitHub', icon: GitPullRequest },
  { id: 'cli', label: 'CLIs', icon: Terminal },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'extensions', label: 'Apps', icon: Boxes }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  discoveredCLIs,
  onRescanCLIs,
  onSetManualCLIPath,
  wallpaper,
  onWallpaperChange,
  activeDesktopName,
  initialTab = 'appearance',
  agentSessions,
  onAgentVoiceChange,
  themePreference,
  onThemePreferenceChange
}) => {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [isScanning, setIsScanning] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AgentProvider | null>(null);
  const [manualPathDraft, setManualPathDraft] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      await onRescanCLIs();
    } finally {
      setIsScanning(false);
    }
  };

  const startEditing = (cli: DiscoveredCLI) => {
    setEditingProvider(cli.provider);
    setManualPathDraft(cli.executablePath || '');
  };

  const handleSaveManualPath = async (provider: AgentProvider) => {
    await onSetManualCLIPath(provider, manualPathDraft.trim() || null);
    setEditingProvider(null);
    setManualPathDraft('');
  };

  const handleClearManualPath = async (provider: AgentProvider) => {
    await onSetManualCLIPath(provider, null);
    setEditingProvider(null);
    setManualPathDraft('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      alert('Please choose an image or video file.');
      return;
    }

    setIsUploading(true);
    try {
      const saved = await saveCustomWallpaper(file);
      onWallpaperChange({
        kind: 'custom',
        storeId: saved.storeId,
        mediaType: saved.mediaType,
        name: saved.name
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save wallpaper';
      alert(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const customLabel =
    wallpaper.kind === 'custom' ? wallpaper.name : null;

  const wallpaperCaption =
    wallpaper.kind === 'custom'
      ? customLabel
      : getBuiltinWallpaper(wallpaper.id)?.description;

  return (
    <div
      className="fixed inset-0 glass-scrim z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-modal rounded-2xl w-full max-w-3xl h-[min(640px,85vh)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--glass-border)] shrink-0">
          <div className="flex items-center space-x-2.5">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-[15px] font-semibold text-[var(--glass-text)]">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] glass-chip transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <nav className="w-[168px] shrink-0 border-r border-[var(--glass-border)] p-2 overflow-y-auto bg-[var(--glass-sidebar-bg)]">
            {SETTINGS_NAV.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition mb-0.5 ${
                    active
                      ? 'glass-chip-active ui-modal-tab-active'
                      : 'ui-modal-tab hover:bg-[var(--glass-hover)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              );
            })}
          </nav>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="overflow-y-auto flex-1 min-h-0 px-5 py-4">
          {tab === 'cloud' ? (
            <CloudSettingsPanel />
          ) : tab === 'usage' ? (
            <UsageSettingsPanel />
          ) : tab === 'extensions' ? (
            <ExtensionsSettingsPanel />
          ) : tab === 'github' ? (
            <GitHubSettingsPanel />
          ) : tab === 'speech' ? (
            <SpeechSettingsPanel
              agentSessions={agentSessions}
              onAgentVoiceChange={onAgentVoiceChange}
            />
          ) : tab === 'appearance' ? (
            <div className="space-y-6">
              <section className="space-y-3">
                <div>
                  <h3 className="text-[13px] font-semibold text-[var(--glass-text)]">Appearance</h3>
                  <p className="text-[11px] text-[var(--glass-text-muted)] mt-0.5">
                    Menus, dock, and panels. Wallpaper is separate.
                  </p>
                </div>
                <ThemeSettingsPanel
                  preference={themePreference}
                  onChange={onThemePreferenceChange}
                />
              </section>

              <section className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-[13px] font-semibold text-[var(--glass-text)]">Wallpaper</h3>
                    <p className="text-[11px] text-[var(--glass-text-muted)] mt-0.5">
                      Applies to{' '}
                      <span className="text-[var(--glass-text)] font-medium">
                        {activeDesktopName ?? 'this desktop'}
                      </span>
                      {wallpaperCaption ? ` · ${wallpaperCaption}` : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {BUILTIN_WALLPAPERS.map((wp) => {
                    const isSelected =
                      wallpaper.kind === 'builtin' && wallpaper.id === wp.id;
                    return (
                      <button
                        key={wp.id}
                        onClick={() => onWallpaperChange({ kind: 'builtin', id: wp.id })}
                        title={wp.description}
                        className={`group relative aspect-[16/10] rounded-xl overflow-hidden border-2 transition ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/25'
                            : 'border-transparent hover:border-[var(--glass-border)]'
                        }`}
                      >
                        <div className={`absolute inset-0 ${wp.previewClass} ${wp.id === 'aurora' ? 'wallpaper-animated' : ''}`} />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                          <span className="text-[10px] font-medium text-white">{wp.name}</span>
                        </div>
                        {wp.mediaType === 'video' && (
                          <span className="absolute top-1.5 right-1.5 text-[9px] bg-black/50 text-white px-1 rounded">
                            Video
                          </span>
                        )}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={`relative aspect-[16/10] rounded-xl overflow-hidden border-2 border-dashed transition flex flex-col items-center justify-center gap-1.5 ${
                      wallpaper.kind === 'custom'
                        ? 'border-primary bg-[var(--glass-selected)]'
                        : 'border-[var(--glass-border)] bg-[var(--glass-card-bg)] hover:border-[var(--glass-text-muted)]'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-[var(--glass-icon)]" />
                    <span className="text-[10px] font-medium text-[var(--glass-text)] px-2 text-center truncate max-w-full">
                      {isUploading ? 'Saving…' : wallpaper.kind === 'custom' ? customLabel : 'Custom'}
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start space-x-2 text-xs text-[var(--glass-text-muted)] glass-chip p-3 rounded-xl leading-relaxed">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  Agentic Desktop inspects your interactive login shell environment and standard
                  macOS paths. If a CLI is not auto-detected, add its executable path manually
                  below.
                </div>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {discoveredCLIs.map((cli) => (
                  <div
                    key={cli.provider}
                    className="glass-input-recess p-3 rounded-xl text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-[var(--glass-text)]">{cli.name}</span>
                          <span className="font-mono text-[10px] text-[var(--glass-text-muted)] glass-chip px-1.5 py-0.5 rounded">
                            {cli.command}
                          </span>
                          {cli.isManual && (
                            <span className="text-[10px] text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded">
                              Manual
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--glass-text-muted)] font-mono truncate max-w-sm">
                          {cli.executablePath || 'Not found in PATH'}
                        </div>
                        {cli.version && (
                          <div className="text-[10px] text-[var(--glass-text-muted)]">Version: {cli.version}</div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => startEditing(cli)}
                          title="Set manual path"
                          className="p-1.5 rounded-lg text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] glass-chip transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {cli.isAvailable ? (
                          <span className="flex items-center space-x-1 text-emerald-400 font-medium text-[11px] bg-emerald-400/10 px-2 py-1 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Ready</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1 text-[var(--glass-text-muted)] font-medium text-[11px] glass-chip px-2 py-1 rounded-lg">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Not Installed</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {editingProvider === cli.provider && (
                      <div className="flex items-center space-x-2 pt-1 border-t border-[var(--glass-border-subtle)]">
                        <input
                          type="text"
                          value={manualPathDraft}
                          onChange={(e) => setManualPathDraft(e.target.value)}
                          placeholder="/usr/local/bin/claude"
                          className="flex-1 min-w-0 glass-input-recess text-xs text-[var(--glass-text)] px-2 py-1.5 rounded-lg focus:outline-none font-mono"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveManualPath(cli.provider)}
                          className="px-2.5 py-1.5 text-[11px] glass-send-btn text-white rounded-lg transition"
                        >
                          Save
                        </button>
                        {cli.isManual && (
                          <button
                            onClick={() => handleClearManualPath(cli.provider)}
                            className="px-2.5 py-1.5 text-[11px] text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] rounded-lg glass-chip transition"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--glass-border)] shrink-0">
          {tab === 'cli' ? (
            <button
              onClick={handleRescan}
              disabled={isScanning}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg glass-chip text-xs text-[var(--glass-text)] transition font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Rescan Environment'}</span>
            </button>
          ) : (
            <span />
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg glass-send-btn text-xs font-medium text-white transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

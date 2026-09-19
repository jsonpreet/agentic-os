import React, { useEffect, useState } from 'react';
import {
  AgentSession,
  SpeechModelStatus,
  SpeechSettings,
  SpeechSourceId,
  VoiceOption,
  DEFAULT_SPEECH_SETTINGS,
  catalogSpeechModels,
  mergeSpeechModelStatus
} from '@agentic/shared-contracts';
import { Volume2, Mic, Play, Plug, Loader2, Download, Check, HardDrive, Cloud } from 'lucide-react';
import { getSpeechSettings, saveSpeechSettings } from '../../lib/speech/settings.js';
import { getWebSpeechVoices, speechQueue } from '../../lib/speech/tts-queue.js';
import { isWebSpeechSTTAvailable } from '../../lib/speech/web-stt.js';
import { OPENAI_TTS_VOICES, testSpeechApiConnection } from '../../lib/speech/speech-api.js';
import {
  applySttSource,
  applyTtsSource,
  sttProviderForLocalModel,
  sttSource,
  ttsProviderForLocalModel,
  ttsSource
} from '../../lib/speech/speech-source.js';

interface SpeechSettingsPanelProps {
  agentSessions: AgentSession[];
  onAgentVoiceChange: (sessionId: string, voiceId: string | null) => Promise<void>;
}

function formatBytes(received?: number, total?: number): string {
  if (!received) return '';
  const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return total ? `${mb(received)} / ${mb(total)}` : mb(received);
}

export const SpeechSettingsPanel: React.FC<SpeechSettingsPanelProps> = ({
  agentSessions,
  onAgentVoiceChange
}) => {
  const [settings, setSettings] = useState<SpeechSettings>(getSpeechSettings());
  const [macVoices, setMacVoices] = useState<VoiceOption[]>([]);
  const [webVoices, setWebVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [apiTestState, setApiTestState] = useState<'idle' | 'testing'>('idle');
  const [apiTestResult, setApiTestResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  const [models, setModels] = useState<SpeechModelStatus[]>(() => catalogSpeechModels());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const sttMode = sttSource(settings.sttProvider);
  const ttsMode = ttsSource(settings.ttsProvider);
  const showLocal = sttMode === 'local' || ttsMode === 'local';
  const showApi = sttMode === 'api' || ttsMode === 'api';

  const refreshModels = async () => {
    if (!window.agenticApi?.listSpeechModels) return;
    try {
      const next = await window.agenticApi.listSpeechModels();
      if (next.length > 0) setModels(mergeSpeechModelStatus(next));
    } catch {
      // Keep the local catalog so the list never goes empty.
    }
  };

  useEffect(() => {
    if (window.agenticApi) {
      window.agenticApi.getMacOSVoices().then(setMacVoices);
    }
    const loadVoices = () => setWebVoices(getWebSpeechVoices());
    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    refreshModels();
  }, []);

  useEffect(() => {
    if (!downloadingId) return;
    const timer = window.setInterval(() => {
      refreshModels();
    }, 400);
    return () => window.clearInterval(timer);
  }, [downloadingId]);

  const update = (patch: Partial<SpeechSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSpeechSettings(next);
  };

  const voiceOptions: VoiceOption[] =
    settings.ttsProvider === 'macos-say'
      ? macVoices
      : settings.ttsProvider === 'api'
        ? OPENAI_TTS_VOICES.map((id) => ({ id, name: id }))
        : webVoices.map((v) => ({ id: v.voiceURI, name: v.name, language: v.lang }));

  const previewVoice = async () => {
    speechQueue.stop();
    await speechQueue.enqueue(
      'Agentic Desktop speech preview.',
      settings.ttsProvider === 'api' ? settings.speechApiTtsVoice : settings.defaultVoice
    );
  };

  const testApiConnection = async () => {
    setApiTestState('testing');
    setApiTestResult(null);
    const result = await testSpeechApiConnection(settings);
    setApiTestResult(result);
    setApiTestState('idle');
  };

  const selectLocalModel = (model: SpeechModelStatus) => {
    if (model.status !== 'ready') return;
    if (model.kind === 'stt') {
      update({
        localSttModelId: model.id,
        sttProvider: sttProviderForLocalModel(model.id)
      });
      return;
    }
    update({
      localTtsModelId: model.id,
      ttsProvider: ttsProviderForLocalModel(model.id)
    });
  };

  const downloadModel = async (modelId: string) => {
    if (!window.agenticApi?.downloadSpeechModel) return;
    setDownloadingId(modelId);
    try {
      await window.agenticApi.downloadSpeechModel(modelId);
      await refreshModels();
    } catch (error) {
      await refreshModels();
      alert(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const activeAgents = agentSessions.filter((s) => s.status !== 'terminated');
  const sttModels = models.filter((model) => model.kind === 'stt');
  const ttsModels = models.filter((model) => model.kind === 'tts');

  const renderModelRow = (model: SpeechModelStatus, selectedId: string) => {
    const selected = model.id === selectedId;
    const downloading = model.status === 'downloading' || downloadingId === model.id;
    const progress =
      model.bytesTotal && model.bytesReceived
        ? Math.min(100, Math.round((model.bytesReceived / model.bytesTotal) * 100))
        : 0;

    return (
      <div
        key={model.id}
        className={`rounded-xl px-3 py-2.5 border ${
          selected ? 'border-primary bg-[var(--glass-selected)]' : 'border-[var(--glass-border-subtle)]'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--glass-text)]">{model.name}</p>
            <p className="text-[11px] text-[var(--glass-text-muted)] mt-0.5">{model.description}</p>
            <p className="text-[10px] text-[var(--glass-text-muted)] mt-1">{model.sizeLabel}</p>
            {downloading && (
              <p className="text-[10px] text-[var(--glass-text-muted)] mt-1">
                Downloading {progress}% {formatBytes(model.bytesReceived, model.bytesTotal)}
              </p>
            )}
            {model.status === 'error' && (
              <p className="text-[10px] text-red-500 mt-1">{model.error}</p>
            )}
          </div>
          <div className="shrink-0">
            {model.status === 'unavailable' ? (
              <span className="text-[10px] text-[var(--glass-text-muted)]">Unavailable</span>
            ) : model.status === 'ready' ? (
              <button
                type="button"
                onClick={() => selectLocalModel(model)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg glass-chip text-[11px] text-[var(--glass-text)]"
              >
                {selected ? <Check className="w-3 h-3" /> : null}
                {selected ? 'Selected' : 'Select'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => downloadModel(model.id)}
                disabled={downloading}
                className="flex items-center gap-1 px-2 py-1 rounded-lg glass-chip text-[11px] text-[var(--glass-text)] disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                {downloading ? 'Downloading' : 'Download'}
              </button>
            )}
          </div>
        </div>
        {downloading && (
          <div className="mt-2 h-1 rounded-full bg-[var(--glass-hover)] overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--glass-text-muted)] leading-relaxed">
        Choose local on-device speech or an online API. Local models can be downloaded here; API
        credentials are only shown when you pick Online API.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="glass-chip rounded-xl p-3 space-y-2">
          <span className="text-xs font-medium text-[var(--glass-text)] flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" /> Speech-to-text
          </span>
          <select
            value={sttMode}
            onChange={(e) => update(applySttSource(settings, e.target.value as SpeechSourceId))}
            className="w-full glass-input-recess rounded-lg px-2 py-1.5 text-xs text-[var(--glass-text)]"
          >
            <option value="local">Local</option>
            <option value="api">Online API</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>

        <label className="glass-chip rounded-xl p-3 space-y-2">
          <span className="text-xs font-medium text-[var(--glass-text)] flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" /> Text-to-speech
          </span>
          <select
            value={ttsMode}
            onChange={(e) => update(applyTtsSource(settings, e.target.value as SpeechSourceId))}
            className="w-full glass-input-recess rounded-lg px-2 py-1.5 text-xs text-[var(--glass-text)]"
          >
            <option value="local">Local</option>
            <option value="api">Online API</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
      </div>

      {showLocal && (
        <section className="glass-chip rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-[var(--glass-icon)]" />
            <div>
              <p className="text-xs font-medium text-[var(--glass-text)]">Local</p>
              <p className="text-[11px] text-[var(--glass-text-muted)]">
                Built-in engines plus whisper.cpp and Piper models that can run locally.
              </p>
            </div>
          </div>

          {sttMode === 'local' && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[var(--glass-text-muted)] uppercase tracking-wider">
                STT model
              </p>
              {!isWebSpeechSTTAvailable() && (
                <p className="text-[11px] text-amber-500">
                  Web Speech is unavailable here. Download Whisper Tiny for local files, or use
                  Online API.
                </p>
              )}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {sttModels.map((model) => renderModelRow(model, settings.localSttModelId))}
              </div>
            </div>
          )}

          {ttsMode === 'local' && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[var(--glass-text-muted)] uppercase tracking-wider">
                TTS model
              </p>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {ttsModels.map((model) => renderModelRow(model, settings.localTtsModelId))}
              </div>
            </div>
          )}
        </section>
      )}

      {showApi && (
        <section className="glass-chip rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-3.5 h-3.5 text-[var(--glass-icon)]" />
            <div>
              <p className="text-xs font-medium text-[var(--glass-text)]">Online API</p>
              <p className="text-[11px] text-[var(--glass-text-muted)]">
                OpenAI-compatible Whisper STT and TTS. Test the connection before using it.
              </p>
            </div>
          </div>
          <label className="block space-y-1">
            <span className="text-[11px] text-[var(--glass-text-muted)]">Base URL</span>
            <input
              type="url"
              value={settings.speechApiBaseUrl}
              onChange={(e) => update({ speechApiBaseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full glass-input-recess rounded-lg px-2 py-1.5 text-xs text-[var(--glass-text)] font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-[var(--glass-text-muted)]">API key</span>
            <input
              type="password"
              value={settings.speechApiKey}
              onChange={(e) => update({ speechApiKey: e.target.value })}
              placeholder="sk-…"
              autoComplete="off"
              className="w-full glass-input-recess rounded-lg px-2 py-1.5 text-xs text-[var(--glass-text)] font-mono"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-[var(--glass-text-muted)]">STT model</span>
              <input
                value={settings.speechApiSttModel}
                onChange={(e) => update({ speechApiSttModel: e.target.value })}
                className="w-full glass-input-recess rounded-lg px-2 py-1.5 text-xs text-[var(--glass-text)] font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] text-[var(--glass-text-muted)]">TTS model</span>
              <input
                value={settings.speechApiTtsModel}
                onChange={(e) => update({ speechApiTtsModel: e.target.value })}
                className="w-full glass-input-recess rounded-lg px-2 py-1.5 text-xs text-[var(--glass-text)] font-mono"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[11px] text-[var(--glass-text-muted)]">API TTS voice</span>
            <select
              value={settings.speechApiTtsVoice}
              onChange={(e) => update({ speechApiTtsVoice: e.target.value })}
              className="w-full glass-input-recess rounded-lg px-2 py-1.5 text-xs text-[var(--glass-text)]"
            >
              {OPENAI_TTS_VOICES.map((voice) => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={testApiConnection}
              disabled={apiTestState === 'testing'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-chip text-[11px] text-[var(--glass-text)] disabled:opacity-50"
            >
              {apiTestState === 'testing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plug className="w-3.5 h-3.5" />
              )}
              {apiTestState === 'testing' ? 'Testing…' : 'Test connection'}
            </button>
            {apiTestResult && (
              <span className={`text-[11px] ${apiTestResult.ok ? 'text-emerald-500' : 'text-red-500'}`}>
                {apiTestResult.message}
              </span>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-2 text-[var(--glass-text)]">
          <input
            type="checkbox"
            checked={settings.ttsEnabled}
            onChange={(e) => update({ ttsEnabled: e.target.checked })}
            className="rounded"
          />
          Speak addressed agent replies
        </label>
        <label className="flex items-center gap-2 text-[var(--glass-text)]">
          <input
            type="checkbox"
            checked={settings.ttsMuted}
            onChange={(e) => update({ ttsMuted: e.target.checked })}
            className="rounded"
          />
          Mute speech
        </label>
      </div>

      {ttsMode !== 'disabled' && (
        <div className="glass-chip rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--glass-text)]">Default voice</span>
            <button
              onClick={previewVoice}
              className="flex items-center gap-1 px-2 py-1 rounded-lg glass-chip text-[11px] text-[var(--glass-text)]"
            >
              <Play className="w-3 h-3" /> Preview
            </button>
          </div>
          <select
            value={
              settings.ttsProvider === 'api'
                ? settings.speechApiTtsVoice
                : settings.defaultVoice || ''
            }
            onChange={(e) =>
              settings.ttsProvider === 'api'
                ? update({ speechApiTtsVoice: e.target.value })
                : update({ defaultVoice: e.target.value || undefined })
            }
            className="w-full glass-input-recess rounded-lg px-2 py-1.5 text-xs text-[var(--glass-text)]"
          >
            {settings.ttsProvider !== 'api' && <option value="">System default</option>}
            {voiceOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.language ? ` (${v.language})` : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[var(--glass-text-muted)] shrink-0">Rate</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={settings.speechRate}
              onChange={(e) => update({ speechRate: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-[11px] text-[var(--glass-text-muted)] w-8">
              {settings.speechRate.toFixed(1)}×
            </span>
          </div>
        </div>
      )}

      {activeAgents.length > 0 && ttsMode !== 'disabled' && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[var(--glass-text-muted)] uppercase tracking-wider">
            Per-agent voices
          </div>
          {activeAgents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-2 glass-input-recess rounded-xl px-3 py-2"
            >
              <span className="text-xs text-[var(--glass-text)] w-20 truncate font-medium">
                {agent.name}
              </span>
              <select
                value={agent.voice || ''}
                onChange={(e) => onAgentVoiceChange(agent.id, e.target.value || null)}
                className="flex-1 glass-chip rounded-lg px-2 py-1 text-[11px] text-[var(--glass-text)]"
              >
                <option value="">Default</option>
                {voiceOptions.map((v) => (
                  <option key={`${agent.id}-${v.id}`} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => update(DEFAULT_SPEECH_SETTINGS)}
        className="text-[11px] text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] transition"
      >
        Reset speech settings
      </button>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { BrowserSession } from '@agentic/shared-contracts';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Minus,
  RefreshCw,
  X
} from 'lucide-react';
import {
  createIframeExecutor,
  registerBrowserExecutor,
  unregisterBrowserExecutor
} from '../../lib/browser-executor.js';

interface BrowserAppWindowProps {
  session: BrowserSession;
  isFocused: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onUrlChange: (sessionId: string, url: string, title?: string) => void;
}

function normalizeInputUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'about:blank';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('about:')) return trimmed;
  return `https://${trimmed}`;
}

export const BrowserAppWindow: React.FC<BrowserAppWindowProps> = ({
  session,
  isFocused,
  onFocus,
  onMinimize,
  onClose,
  onUrlChange
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [addressBar, setAddressBar] = useState(session.url);
  const [isLoading, setIsLoading] = useState(false);
  const historyRef = useRef<string[]>([session.url]);
  const historyIndexRef = useRef(0);

  const navigateLocal = (url: string, pushHistory = true) => {
    const normalized = normalizeInputUrl(url);
    setAddressBar(normalized);
    if (iframeRef.current) {
      iframeRef.current.src = normalized;
    }
    if (pushHistory) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(normalized);
      historyIndexRef.current = historyRef.current.length - 1;
    }
    onUrlChange(session.id, normalized);
  };

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const executor = createIframeExecutor(
      iframe,
      () => addressBar,
      (url) => setAddressBar(url)
    );
    registerBrowserExecutor(session.id, executor);

    const onLoad = () => {
      setIsLoading(false);
      const href = iframe.contentWindow?.location.href || addressBar;
      setAddressBar(href);
      const title = iframe.contentDocument?.title;
      onUrlChange(session.id, href, title);
    };

    iframe.addEventListener('load', onLoad);
    iframe.src = session.url;

    return () => {
      iframe.removeEventListener('load', onLoad);
      unregisterBrowserExecutor(session.id);
    };
  }, [session.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    navigateLocal(addressBar);
  };

  const handleBack = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const url = historyRef.current[historyIndexRef.current];
    setIsLoading(true);
    navigateLocal(url, false);
  };

  const handleForward = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const url = historyRef.current[historyIndexRef.current];
    setIsLoading(true);
    navigateLocal(url, false);
  };

  const handleReload = () => {
    setIsLoading(true);
    iframeRef.current?.contentWindow?.location.reload();
  };

  return (
    <div
      onClick={onFocus}
      className={`w-full h-full flex flex-col rounded-xl overflow-hidden transition-all duration-200 ${
        isFocused ? 'glass-widget glass-widget-focused' : 'glass-widget'
      }`}
      data-browser-window
    >
      <div className="h-10 glass-titlebar px-2 flex items-center gap-1.5 cursor-move">
        <Globe className="w-4 h-4 text-primary shrink-0 ml-1" />
        <span className="text-xs font-medium text-[var(--glass-text)] shrink-0">Browser</span>

        <div className="flex items-center gap-0.5 titlebar-no-drag">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleBack();
            }}
            className="p-1 rounded glass-chip text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]"
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleForward();
            }}
            className="p-1 rounded glass-chip text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]"
            title="Forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleReload();
            }}
            className={`p-1 rounded glass-chip text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] ${isLoading ? 'animate-spin' : ''}`}
            title="Reload"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-w-0 titlebar-no-drag">
          <input
            type="text"
            value={addressBar}
            onChange={(e) => setAddressBar(e.target.value)}
            className="w-full glass-input-recess rounded-lg px-2.5 py-1 text-xs text-[var(--glass-text)] font-mono focus:outline-none"
            placeholder="https://"
            onClick={(e) => e.stopPropagation()}
          />
        </form>

        <div className="flex items-center gap-0.5 titlebar-no-drag">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            className="p-1 text-[var(--glass-text-muted)] hover:text-[var(--glass-text)] glass-chip rounded"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 text-[var(--glass-text-muted)] hover:text-red-400 glass-chip rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-[var(--glass-input-bg)]">
        <iframe
          ref={iframeRef}
          title={`Browser ${session.id}`}
          className="absolute inset-0 w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        />
      </div>
    </div>
  );
};

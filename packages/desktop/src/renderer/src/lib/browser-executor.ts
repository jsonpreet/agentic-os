import {
  BrowserCommandEvent,
  BrowserCommandResultEvent,
  BrowserSnapshot
} from '@agentic/shared-contracts';

export type BrowserFrameExecutor = {
  navigate: (url: string) => Promise<BrowserSnapshot>;
  snapshot: () => Promise<BrowserSnapshot>;
  click: (selector: string) => Promise<BrowserSnapshot>;
  type: (selector: string, text: string) => Promise<BrowserSnapshot>;
};

const executors = new Map<string, BrowserFrameExecutor>();

export function registerBrowserExecutor(sessionId: string, executor: BrowserFrameExecutor): void {
  executors.set(sessionId, executor);
}

export function unregisterBrowserExecutor(sessionId: string): void {
  executors.delete(sessionId);
}

function readSnapshotFromDocument(doc: Document, url: string): BrowserSnapshot {
  const title = doc.title || url;
  const links = Array.from(doc.querySelectorAll('a[href]'))
    .slice(0, 20)
    .map((a) => ({
      text: (a.textContent || '').trim().slice(0, 80),
      href: (a as HTMLAnchorElement).href
    }))
    .filter((l) => l.text || l.href);

  const bodyText = (doc.body?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 4000);

  return {
    url,
    title,
    textContent: bodyText || undefined,
    links: links.length > 0 ? links : undefined
  };
}

export function createIframeExecutor(
  iframe: HTMLIFrameElement,
  getUrl: () => string,
  setUrl: (url: string) => void
): BrowserFrameExecutor {
  const waitForLoad = (): Promise<void> =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Page load timed out')), 20_000);
      const onLoad = () => {
        clearTimeout(timeout);
        iframe.removeEventListener('load', onLoad);
        resolve();
      };
      iframe.addEventListener('load', onLoad);
    });

  const snapshot = async (): Promise<BrowserSnapshot> => {
    const url = iframe.contentWindow?.location.href || getUrl();
    try {
      const doc = iframe.contentDocument;
      if (!doc) {
        return {
          url,
          title: url,
          error: 'Cannot read page content (cross-origin). URL navigation still works.'
        };
      }
      return readSnapshotFromDocument(doc, url);
    } catch {
      return {
        url,
        title: url,
        error: 'Cannot read page content (cross-origin). URL navigation still works.'
      };
    }
  };

  return {
    async navigate(url: string) {
      setUrl(url);
      iframe.src = url;
      try {
        await waitForLoad();
      } catch {
        // about:blank or blocked loads may not fire load reliably
      }
      return snapshot();
    },
    snapshot,
    async click(selector: string) {
      const doc = iframe.contentDocument;
      if (!doc) {
        return {
          url: getUrl(),
          title: getUrl(),
          error: 'Cannot click on cross-origin page'
        };
      }
      const el = doc.querySelector(selector);
      if (!el || !(el instanceof HTMLElement)) {
        throw new Error(`Element not found: ${selector}`);
      }
      el.click();
      return snapshot();
    },
    async type(selector: string, text: string) {
      const doc = iframe.contentDocument;
      if (!doc) {
        return {
          url: getUrl(),
          title: getUrl(),
          error: 'Cannot type on cross-origin page'
        };
      }
      const el = doc.querySelector(selector);
      if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        throw new Error(`Input element not found: ${selector}`);
      }
      el.focus();
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return snapshot();
    }
  };
}

export async function handleBrowserCommand(event: BrowserCommandEvent): Promise<void> {
  const executor = executors.get(event.sessionId);
  if (!executor) {
    await window.agenticApi?.submitBrowserCommandResult({
      requestId: event.requestId,
      sessionId: event.sessionId,
      success: false,
      error: 'Browser window is not open'
    });
    return;
  }

  try {
    let snapshot: BrowserSnapshot;
    switch (event.tool) {
      case 'navigate':
        snapshot = await executor.navigate(event.params.url);
        break;
      case 'snapshot':
        snapshot = await executor.snapshot();
        break;
      case 'click':
        snapshot = await executor.click(event.params.selector);
        break;
      case 'type':
        snapshot = await executor.type(event.params.selector, event.params.text);
        break;
      default:
        throw new Error(`Unknown browser tool: ${event.tool}`);
    }

    await window.agenticApi?.submitBrowserCommandResult({
      requestId: event.requestId,
      sessionId: event.sessionId,
      success: true,
      snapshot
    });
  } catch (err) {
    await window.agenticApi?.submitBrowserCommandResult({
      requestId: event.requestId,
      sessionId: event.sessionId,
      success: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

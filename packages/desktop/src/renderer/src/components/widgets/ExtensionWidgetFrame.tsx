import React, { useEffect, useRef } from 'react';
import { ExtensionSdkRequest, ExtensionWidgetDescriptor } from '@agentic/shared-contracts';
import {
  createSdkInitMessage,
  handleExtensionSdkRequest
} from '../../lib/extension-sdk-host.js';
import { ExtensionHostContext } from '../../lib/extension-host-context.js';

interface ExtensionWidgetFrameProps {
  descriptor: ExtensionWidgetDescriptor & { src: string };
  host: ExtensionHostContext;
}

export const ExtensionWidgetFrame: React.FC<ExtensionWidgetFrameProps> = ({ descriptor, host }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'agentic-sdk-ready') {
        iframeRef.current?.contentWindow?.postMessage(createSdkInitMessage(descriptor), {
          targetOrigin: '*'
        });
        return;
      }

      if (data.type === 'agentic-sdk-request') {
        void handleExtensionSdkRequest(
          descriptor,
          data as ExtensionSdkRequest,
          event.source,
          host
        );
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [descriptor, host]);

  return (
    <section className="glass-widget rounded-2xl overflow-hidden pointer-events-auto">
      <div className="px-3 py-2 border-b border-[var(--glass-border-subtle)] text-[11px] font-medium text-[var(--glass-text)]">
        {descriptor.name}
      </div>
      <iframe
        ref={iframeRef}
        title={descriptor.name}
        src={descriptor.src}
        sandbox="allow-scripts"
        className="w-full h-44 bg-[var(--glass-hover)] border-0"
      />
    </section>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import { ExtensionWidgetDescriptor } from '@agentic/shared-contracts';
import { resolveExtensionWidgetSrc } from '../../lib/extension-widget-url.js';
import { ExtensionWidgetFrame } from './ExtensionWidgetFrame.js';
import { ExtensionHostContext } from '../../lib/extension-host-context.js';

interface ExtensionWidgetsProps {
  host: ExtensionHostContext;
}

export const ExtensionWidgets: React.FC<ExtensionWidgetsProps> = ({ host }) => {
  const [widgets, setWidgets] = useState<Array<ExtensionWidgetDescriptor & { src: string }>>([]);

  const refresh = useCallback(async () => {
    if (!window.agenticApi) return;
    const descriptors = await window.agenticApi.getExtensionWidgets();
    const resolved = (
      await Promise.all(
        descriptors.map(async (descriptor) => {
          const src = await resolveExtensionWidgetSrc(descriptor);
          return src ? { ...descriptor, src } : null;
        })
      )
    ).filter((entry): entry is ExtensionWidgetDescriptor & { src: string } => entry !== null);
    setWidgets(resolved);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('agentic:extensions-changed', onChange);
    return () => window.removeEventListener('agentic:extensions-changed', onChange);
  }, [refresh]);

  if (widgets.length === 0) return null;

  return (
    <div className="absolute top-9 right-20 z-20 flex flex-col gap-3 max-w-sm pointer-events-none">
      {widgets.map((widget) => (
        <ExtensionWidgetFrame key={widget.extensionId} descriptor={widget} host={host} />
      ))}
    </div>
  );
};

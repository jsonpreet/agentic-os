import { ExtensionWidgetDescriptor } from '@agentic/shared-contracts';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isTauriRuntime } from './is-tauri.js';

export async function resolveExtensionWidgetSrc(
  descriptor: ExtensionWidgetDescriptor
): Promise<string | null> {
  if (descriptor.widgetUrl) {
    return descriptor.widgetUrl.startsWith('http')
      ? descriptor.widgetUrl
      : `/agentic${descriptor.widgetUrl}`;
  }

  if (isTauriRuntime()) {
    return convertFileSrc(descriptor.widgetPath);
  }

  const entrypoint = descriptor.widgetPath.split('/').pop();
  if (!entrypoint) return null;
  return `/agentic/extensions/${encodeURIComponent(descriptor.extensionId)}/${encodeURIComponent(entrypoint)}`;
}

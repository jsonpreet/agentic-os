import { describe, expect, it } from 'vitest';
import { createManifest, validateManifest } from '../src/index.js';

describe('app-sdk manifest', () => {
  it('creates a widget manifest with SDK version', () => {
    const manifest = createManifest({
      id: 'com.agentic.hello',
      name: 'Hello Widget',
      version: '0.1.0',
      widgetEntrypoint: 'widget.html',
      permissions: ['storage', 'notifications']
    });

    expect(manifest.sdkVersion).toBe('0.1.0');
    expect(manifest.widgetEntrypoint).toBe('widget.html');
    validateManifest(manifest);
  });
});

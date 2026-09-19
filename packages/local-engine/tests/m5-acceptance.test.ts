import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalEngine } from '../src/engine/local-engine.js';
import { ExtensionService } from '../src/extensions/extension-service.js';

/**
 * Milestone 5 acceptance (engine):
 * notifications inbox + extension install + usage overview
 */
describe('Milestone 5 acceptance (engine)', () => {
  let tmpDir: string;
  let engine: LocalEngine;
  let extensionsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-m5-'));
    extensionsDir = path.join(tmpDir, 'extensions');
    engine = new LocalEngine({
      dbPath: path.join(tmpDir, 'test.db'),
      autoConnectRelay: false
    });
    engine.extensionService = new ExtensionService(extensionsDir);
  });

  afterEach(() => {
    engine.db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('records notifications and exposes provider usage overview', async () => {
    const notification = engine.notificationService.record({
      type: 'usage_threshold',
      title: 'Usage threshold',
      body: 'Provider usage is not connected yet.',
      genericPushBody: 'Usage update available.',
      dedupeKey: 'usage:codex'
    });

    expect(notification).not.toBeNull();
    expect(engine.getUnreadNotificationCount()).toBe(1);

    const usage = await engine.getUsageOverview();
    expect(usage.providers.length).toBeGreaterThan(0);
    expect(usage.providers.some((provider) => provider.provider === 'claude')).toBe(true);
  });

  it('installs the example extension manifest into the app library', () => {
    const source = path.join(tmpDir, 'example-extension');
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, 'manifest.json'),
      JSON.stringify({
        id: 'com.agentic.hello-widget',
        name: 'Hello Widget',
        version: '0.1.0',
        sdkVersion: '0.1.0',
        widgetEntrypoint: 'widget.html',
        permissions: ['storage', 'notifications']
      })
    );
    fs.writeFileSync(path.join(source, 'widget.html'), '<html><body>Hello</body></html>');

    const installed = engine.installExtension({ sourcePath: source });
    expect(installed.manifest.id).toBe('com.agentic.hello-widget');

    const listed = engine.listInstalledExtensions();
    expect(listed).toHaveLength(1);
    expect(listed[0].manifest.widgetEntrypoint).toBe('widget.html');
  });
});

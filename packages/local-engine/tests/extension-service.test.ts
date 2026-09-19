import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExtensionService } from '../src/extensions/extension-service.js';

describe('ExtensionService', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let service: ExtensionService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-ext-'));
    extensionsDir = path.join(tmpDir, 'extensions');
    service = new ExtensionService(extensionsDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('installs a valid extension manifest from a source folder', () => {
    const source = path.join(tmpDir, 'hello-extension');
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, 'manifest.json'),
      JSON.stringify({
        id: 'com.agentic.hello',
        name: 'Hello',
        version: '0.1.0',
        sdkVersion: '0.1.0',
        widgetEntrypoint: 'widget.html',
        permissions: ['storage']
      })
    );
    fs.writeFileSync(path.join(source, 'widget.html'), '<html></html>');

    const installed = service.installFromPath({ sourcePath: source });
    expect(installed.manifest.name).toBe('Hello');
    expect(fs.existsSync(path.join(extensionsDir, 'com.agentic.hello', 'widget.html'))).toBe(
      true
    );

    const listed = service.listInstalled();
    expect(listed).toHaveLength(1);
  });

  it('serves extension files safely by extension id', () => {
    const source = path.join(tmpDir, 'hello-extension');
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(source, 'manifest.json'),
      JSON.stringify({
        id: 'com.agentic.hello',
        name: 'Hello',
        version: '0.1.0',
        sdkVersion: '0.1.0',
        widgetEntrypoint: 'widget.html',
        permissions: []
      })
    );
    fs.writeFileSync(path.join(source, 'widget.html'), '<html></html>');
    service.installFromPath({ sourcePath: source });

    const resolved = service.resolveExtensionFile('com.agentic.hello', 'widget.html');
    expect(resolved).toContain('widget.html');
    expect(service.resolveExtensionFile('com.agentic.hello', '../secret.txt')).toBeNull();
  });

  it('rejects incompatible SDK versions', () => {
    expect(() =>
      service.parseManifest(
        JSON.stringify({
          id: 'bad',
          name: 'Bad',
          version: '1.0.0',
          sdkVersion: '9.9.9',
          widgetEntrypoint: 'widget.html',
          permissions: []
        })
      )
    ).toThrow(/SDK/);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  getWidgetLayout,
  saveWidgetLayout
} from '../src/renderer/src/lib/widget-store.js';

/**
 * Milestone 5 acceptance (renderer):
 * desktop widget layout persistence
 */
describe('Milestone 5 acceptance (renderer)', () => {
  const storage: Record<string, string> = {};

  beforeEach(() => {
    Object.assign(storage, {});
    globalThis.localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        for (const key of Object.keys(storage)) delete storage[key];
      },
      length: 0,
      key: () => null
    };
  });

  it('persists per-desktop widget layout and quick note', () => {
    saveWidgetLayout('desktop-build', {
      enabled: ['running-agents', 'quick-note'],
      quickNote: 'Ship M5 widgets'
    });

    const layout = getWidgetLayout('desktop-build');
    expect(layout.enabled).toEqual(['running-agents', 'quick-note']);
    expect(layout.quickNote).toBe('Ship M5 widgets');
  });
});

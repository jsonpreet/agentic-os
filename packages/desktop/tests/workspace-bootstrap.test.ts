import { describe, expect, it, vi, beforeEach } from 'vitest';
import { bootstrapWorkspace } from '../src/renderer/src/lib/workspace-bootstrap.js';

describe('bootstrapWorkspace', () => {
  beforeEach(() => {
    (globalThis as { agenticApi?: unknown }).agenticApi = {
      getDesktops: vi.fn(),
      createDesktop: vi.fn()
    };
    (globalThis as { window: typeof globalThis }).window = globalThis as Window & typeof globalThis;
  });

  it('returns existing desktops and preferred active desktop', async () => {
    const desktops = [
      { id: 'd1', workspaceId: 'w1', name: 'Build', type: 'build', order: 0, createdAt: 1 },
      { id: 'd2', workspaceId: 'w1', name: 'Design', type: 'design', order: 1, createdAt: 2 }
    ];
    vi.mocked(window.agenticApi!.getDesktops).mockResolvedValue(desktops);

    const result = await bootstrapWorkspace('w1', {
      id: 'w1',
      name: 'Test',
      icon: 'folder',
      repositories: [],
      activeDesktopId: 'd2',
      createdAt: 1,
      updatedAt: 1
    });

    expect(result).toEqual({ desktops, activeDesktopId: 'd2' });
    expect(window.agenticApi!.createDesktop).not.toHaveBeenCalled();
  });

  it('creates a desktop when workspace has none', async () => {
    vi.mocked(window.agenticApi!.getDesktops).mockResolvedValue([]);
    vi.mocked(window.agenticApi!.createDesktop).mockResolvedValue({
      id: 'd-new',
      workspaceId: 'w1',
      name: 'Main',
      type: 'custom',
      order: 0,
      createdAt: 1
    });

    const result = await bootstrapWorkspace('w1', null);
    expect(result?.activeDesktopId).toBe('d-new');
    expect(window.agenticApi!.createDesktop).toHaveBeenCalledWith({
      workspaceId: 'w1',
      name: 'Main'
    });
  });
});

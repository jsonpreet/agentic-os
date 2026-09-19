import { Desktop, Workspace } from '@agentic/shared-contracts';

export interface WorkspaceBootstrapResult {
  desktops: Desktop[];
  activeDesktopId: string;
}

/**
 * Load desktops for a workspace and guarantee at least one exists.
 */
export async function bootstrapWorkspace(
  workspaceId: string,
  workspace?: Workspace | null
): Promise<WorkspaceBootstrapResult | null> {
  if (!window.agenticApi) return null;

  let desktops = await window.agenticApi.getDesktops(workspaceId);

  if (desktops.length === 0) {
    const created = await window.agenticApi.createDesktop({
      workspaceId,
      name: 'Main'
    });
    desktops = [created];
  }

  const preferredId = workspace?.activeDesktopId;
  const activeDesktopId =
    preferredId && desktops.some((d) => d.id === preferredId)
      ? preferredId
      : desktops[0].id;

  return { desktops, activeDesktopId };
}

import type { Workspace } from '../types/workspace';

/**
 * Whether a workspace is currently active (as opposed to archived). The single
 * definition of the active-status check, so the home tiles, the home panel, and
 * the table all agree on what "active" means instead of each re-testing the
 * `'Active'` string literal.
 */
export function isActiveWorkspace(workspace: Pick<Workspace, 'status'>): boolean {
    return workspace.status === 'Active';
}

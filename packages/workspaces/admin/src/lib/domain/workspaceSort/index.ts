import type { Workspace } from '../types/workspace';

/** How the workspace cards are ordered. */
export type WorkspaceSort = 'edited' | 'name' | 'created';

/** Every sort, in the order the menu offers them. */
export const WORKSPACE_SORTS: readonly WorkspaceSort[] = [
    'edited',
    'name',
    'created'
];

/** The default: busy workspaces first. */
export const DEFAULT_WORKSPACE_SORT: WorkspaceSort = 'edited';

/** A timestamp as a number, with an unknown one sorting last. */
function time(iso: string | null): number {
    const parsed = iso ? Date.parse(iso) : Number.NaN;
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * The workspaces in `sort` order, as a new array: most recently edited first,
 * by name (locale-aware, case-insensitive), or newest first. Ties — and an
 * older server that sends no timestamps — fall back to the name, so the order
 * is stable rather than whatever the response happened to be.
 */
export function sortWorkspaces(
    workspaces: readonly Workspace[],
    sort: WorkspaceSort,
    locale?: string
): Workspace[] {
    const byName = (a: Workspace, b: Workspace) =>
        a.name.localeCompare(b.name, locale, { sensitivity: 'base' });
    const newest =
        (field: 'lastEditedAt' | 'createdAt') => (a: Workspace, b: Workspace) =>
            time(b[field]) - time(a[field]) || byName(a, b);
    const compare =
        sort === 'name'
            ? byName
            : newest(sort === 'edited' ? 'lastEditedAt' : 'createdAt');
    return [...workspaces].sort(compare);
}

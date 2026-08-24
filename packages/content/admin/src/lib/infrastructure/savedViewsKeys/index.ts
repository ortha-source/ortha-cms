/**
 * Query keys for the saved-views cache. Workspace-scoped like `contentKeys`:
 * two workspaces never share a cache entry, so switching workspaces can't
 * surface the other's views from cache (the request, and its `X-Workspace-Id`
 * header, never fires on a cache hit).
 */

/** Root key — every saved-views cache entry lives under it. */
export const savedViewsRootKey = ['saved-views'] as const;

/** The views for one workspace + scope. */
export function savedViewsKey(workspaceId: string, scope: string) {
    return [...savedViewsRootKey, workspaceId, scope] as const;
}

/** The scope key for a content type's records list. */
export function contentScope(typeName: string): string {
    return `content:${typeName}`;
}

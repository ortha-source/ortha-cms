/** Narrowing for a segment list — the picker's search box. */
export type SegmentsListParams = {
    /** Case-insensitive substring matched against a segment's label and key. */
    q?: string;
};

/**
 * Query keys for the segmentation caches.
 *
 * Three roots, not one, and the split is load-bearing. The **catalogue**
 * (segment types and their segments) is installation-wide and changes when an
 * administrator edits an axis. The **access** side (rules, assignments, grants)
 * is workspace-scoped and changes far more often. Rooting them together would
 * make every rule edit re-fetch the whole catalogue — and, worse, make a
 * catalogue invalidation quietly drop a workspace's rules from cache, so the
 * page that was showing them flickers back to a spinner for no reason a reader
 * could see.
 *
 * The workspace is not in the key path by accident either: it reaches the
 * server only as `apiClient`'s ambient `X-Workspace-Id` header, so it *must* be
 * part of the key or workspace A would read workspace B's rules out of cache.
 */
export const segmentsKeys = {
    /** Root covering the installation-wide catalogue. */
    catalogue: ['segments', 'catalogue'] as const,
    /** Every segment type. */
    types: () => ['segments', 'catalogue', 'types'] as const,
    /** One type's segments, for the given search. */
    segments: (typeKey: string, params: SegmentsListParams = {}) =>
        ['segments', 'catalogue', 'segments', typeKey, params] as const,

    /** Root covering one workspace's access declarations. */
    access: (workspaceId: string) =>
        ['segments', 'access', workspaceId] as const,
    /** One workspace's rule library. */
    rules: (workspaceId: string) =>
        ['segments', 'access', workspaceId, 'rules'] as const,
    /** One workspace's rule assignments. */
    assignments: (workspaceId: string) =>
        ['segments', 'access', workspaceId, 'assignments'] as const,
    /** One segment's grants, as seen from this workspace. */
    grants: (workspaceId: string, segmentId: string) =>
        ['segments', 'access', workspaceId, 'grants', segmentId] as const
};

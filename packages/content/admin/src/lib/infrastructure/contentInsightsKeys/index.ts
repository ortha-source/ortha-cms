/**
 * Query keys for the content Insights caches.
 *
 * Every key carries the **workspace id**, for the same reason the entry keys do:
 * the workspace only reaches the server as an ambient `X-Workspace-Id` header,
 * which is never sent on a cache hit. Without the id in the key, switching
 * workspaces would show the previous workspace's numbers from cache and never
 * refetch — a silent, entirely believable wrong answer.
 *
 * The range-dependent keys carry `days` too, so changing the page's range is an
 * ordinary cache miss rather than a manual invalidation.
 */
export const contentInsightsKeys = {
    /** Root — invalidate this to refresh every content Insights widget. */
    all: (workspaceId: string) => ['content-insights', workspaceId] as const,
    totals: (workspaceId: string, days: number) =>
        ['content-insights', workspaceId, 'totals', days] as const,
    stale: (workspaceId: string) =>
        ['content-insights', workspaceId, 'stale'] as const,
    pipeline: (workspaceId: string) =>
        ['content-insights', workspaceId, 'pipeline'] as const,
    velocity: (workspaceId: string, days: number) =>
        ['content-insights', workspaceId, 'velocity', days] as const,
    punchcard: (workspaceId: string, days: number) =>
        ['content-insights', workspaceId, 'punchcard', days] as const
};

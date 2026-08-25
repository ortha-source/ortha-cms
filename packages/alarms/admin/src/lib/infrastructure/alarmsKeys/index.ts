/** Params the findings list is keyed and requested by. */
export type FindingsListParams = {
    state?: 'open' | 'muted' | 'resolved';
    ruleId?: string;
    severity?: 'info' | 'warn' | 'error';
    page?: number;
    pageSize?: number;
};

/**
 * Query keys for the alarms caches.
 *
 * Every key is prefixed with the workspace id. Findings are workspace-scoped
 * server-side through the `X-Workspace-Id` header, which the shared `apiClient`
 * attaches — so without the id in the key, switching workspaces would serve the
 * previous one's findings out of cache until they went stale.
 */
export const alarmsKeys = {
    /** Root — what a mutation invalidates when it cannot place the change. */
    all: (workspaceId: string) => ['alarms', workspaceId] as const,
    rules: (workspaceId: string) => ['alarms', workspaceId, 'rules'] as const,
    findings: (workspaceId: string, params: FindingsListParams) =>
        ['alarms', workspaceId, 'findings', params] as const,
    /**
     * Findings for a batch of entries. The ids are sorted into the key so two
     * renders of the same page hit the same cache entry regardless of row
     * order.
     */
    byEntry: (workspaceId: string, entryIds: readonly string[]) =>
        ['alarms', workspaceId, 'by-entry', [...entryIds].sort()] as const,
    summary: (workspaceId: string) =>
        ['alarms', workspaceId, 'summary'] as const
};

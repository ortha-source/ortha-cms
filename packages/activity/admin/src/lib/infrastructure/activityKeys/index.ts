/** Parameters accepted by `GET /api/activity` — the log's search and paging. */
export type ActivityListParams = {
    /** Case-insensitive actor-email substring; omit for no filter. */
    actorEmail?: string;
    /** Query-builder filter tree as a JSON string; omit for no structured filter. */
    filter?: string;
    /** 1-based page number; the server defaults to 1. */
    page?: number;
    /** Rows per page; the server defaults to its own page size. */
    pageSize?: number;
    /**
     * Sort column; the server defaults to `at`.
     *
     * **No UI control sets this today.** The server whitelists `at`/`kind` and
     * the field is carried so a future sortable header has somewhere to write,
     * but the Activity table has no sortable column and `users-admin`'s per-user
     * tab sends no sort either — so every list is the server's default
     * newest-first. Don't read a `sort` in this type as evidence that a control
     * exists (`♿ A11Y-activity-admin-08` records that the absent `aria-sort` is
     * correct precisely because nothing is sortable).
     */
    sort?: 'at' | 'kind';
    /** Sort direction; the server defaults to `desc`. Also unset by any UI. */
    order?: 'asc' | 'desc';
};

/**
 * Query keys for the activity cache. The list endpoint lives under
 * `activityKeys.list(params)`; the root `activityKeys.all` covers every query
 * (audit events are append-only, so there are no mutations to invalidate here,
 * but new writes elsewhere can be reflected by invalidating the root).
 */
export const activityKeys = {
    /** Root key covering every activity query. */
    all: ['activity'] as const,
    /** One list page for the given params. */
    list: (params: ActivityListParams) => ['activity', 'list', params] as const
};

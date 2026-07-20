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
    /** Sort column; the server defaults to `at`. */
    sort?: 'at' | 'kind';
    /** Sort direction; the server defaults to `desc`. */
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

/** Parameters accepted by `GET /api/users` — the list query's filter/paging. */
export type MembersListParams = {
    /** Case-insensitive name/email substring; omit for no filter. */
    search?: string;
    /** Query-builder filter tree as a JSON string; omit for no structured filter. */
    filter?: string;
    /** 1-based page number; the server defaults to 1. */
    page?: number;
    /** Rows per page; the server defaults to its own page size. */
    pageSize?: number;
};

/**
 * Query keys for the members cache. The list endpoint lives under
 * `membersKeys.list(params)`; mutations invalidate `membersKeys.all` to
 * refresh every cached page (an added/changed/removed row may land anywhere).
 */
export const membersKeys = {
    /** Root key covering every members query. */
    all: ['members'] as const,
    /** One list page for the given params. */
    list: (params: MembersListParams) => ['members', 'list', params] as const
};

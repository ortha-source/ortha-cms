/** Parameters accepted by `GET /api/api-tokens` — paging (+ optional filter). */
export type ApiTokensListParams = {
    /** Restrict to one workspace's tokens; omit for all. */
    workspaceId?: string;
    /** 1-based page number; the server defaults to 1. */
    page?: number;
    /** Rows per page; the server defaults to its own page size. */
    pageSize?: number;
};

/**
 * Query keys for the API-tokens cache. The list lives under
 * `apiTokensKeys.list(params)`; create/revoke invalidate `apiTokensKeys.all` to
 * refresh every cached page (a new or revoked row may land anywhere).
 */
export const apiTokensKeys = {
    /** Root key covering every API-tokens query. */
    all: ['api-tokens'] as const,
    /** One list page for the given params. */
    list: (params: ApiTokensListParams) =>
        ['api-tokens', 'list', params] as const
};

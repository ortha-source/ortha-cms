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
 *
 * **Sessions deliberately sit under their own root**, not under
 * `['members','detail',id,…]`. TanStack matches by prefix, so nesting them
 * would make every member mutation — a rename, a role change — invalidate
 * every cached session list too, which no member mutation can affect. Keeping
 * the root separate is what makes the broad `all` invalidation safe.
 */
export const membersKeys = {
    /** Root key covering the member list and detail queries. */
    all: ['members'] as const,
    /** One list page for the given params. */
    list: (params: MembersListParams) => ['members', 'list', params] as const,
    /** One member's full detail record (the user detail page). */
    detail: (id: string) => ['members', 'detail', id] as const,
    /**
     * One member's live sessions (the detail page's Sessions tab). Rooted at
     * `member-sessions` so `membersKeys.all` cannot reach it — see the note
     * above.
     */
    sessions: (id: string) => ['member-sessions', id] as const
};

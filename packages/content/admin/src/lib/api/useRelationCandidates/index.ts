import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    treeToJsonFilter,
    type FilterGroup
} from '@ortha-cms/query-builder-admin';
import type { ContentField, EntryRecord } from '../../types/contentType';
import { relationLabel } from '../../utils/relationLabel';

/**
 * The list endpoint's hard `MAX_PAGE_SIZE` (`@Max(100)`, which **rejects** an
 * over-cap `pageSize` with a 400 rather than clamping). Each candidate page
 * request stays at or under it; the infinite list grows **past** it by fetching
 * further pages (real offset pagination), so a target type with more than a
 * page of entries is fully scrollable — not artificially capped.
 */
export const RELATION_CANDIDATES_MAX_PAGE_SIZE = 100;

/** Rows fetched per candidate page (kept at or under the server's cap). */
export const RELATION_CANDIDATES_PAGE_SIZE = 25;

/** One assignable related record, ready for the picker (title pre-derived). */
export type RelationCandidate = {
    id: string;
    /** Display title (first text/select field, else id). */
    title: string;
    /** Publish status — present only for publishable target types. */
    status?: 'draft' | 'published';
    /** The record's field values, keyed by field name. */
    values: Record<string, unknown>;
};

/** Params narrowing the candidate list — the picker's search + query builder. */
export type RelationCandidatesParams = {
    /** Free-text search across the record's string values. */
    search?: string;
    /** The composed query-builder tree, or null when no rules are set. */
    filter?: FilterGroup | null;
    /**
     * Slot-contributed list params (e.g. locale scoping from the entry-params
     * slot), forwarded to the request verbatim and keyed into the cache.
     */
    extra?: Record<string, string>;
};

/** The paginated candidate envelope: the loaded matches, the full count, more-flag. */
export type RelationCandidatesResult = {
    items: RelationCandidate[];
    /** Total matches across the whole (filtered) set, not just what's loaded. */
    total: number;
    /** Whether more matches exist beyond the loaded pages (drives lazy load). */
    hasMore: boolean;
    /** Whether the first page is still loading (no data yet). */
    isPending: boolean;
    /** Whether the candidate query failed. */
    isError: boolean;
    /** Whether a further page is currently loading (drives the load-more spinner). */
    isFetchingNextPage: boolean;
    /** Fetch the next page of matches (lazy infinite scroll). */
    fetchNextPage: () => void;
};

/** The list endpoint's envelope for the target type's entries. */
type EntriesEnvelope = {
    items: EntryRecord[];
    total: number;
};

/**
 * Fetch one page of the target type's entries as relation candidates from
 * `GET /api/content/:type` — the same server pipeline the records table uses, so
 * the picker's free-text `search` and the query-builder `filter` are applied
 * **server-side**. Pages are real, offset-based (`page`/`pageSize`); the dialog
 * pulls further pages as the user scrolls.
 */
async function fetchRelationCandidatesPage(
    targetName: string,
    search: string,
    filter: string | null,
    page: number,
    extra: Record<string, string>
): Promise<EntriesEnvelope> {
    try {
        const { data } = await apiClient.get<EntriesEnvelope>(
            `/content/${targetName}`,
            {
                params: {
                    ...extra,
                    ...(search ? { search } : {}),
                    ...(filter ? { filter } : {}),
                    page,
                    // Never exceed the server's hard cap — an over-cap pageSize is
                    // a 400, not a clamp.
                    pageSize: Math.min(
                        RELATION_CANDIDATES_PAGE_SIZE,
                        RELATION_CANDIDATES_MAX_PAGE_SIZE
                    )
                }
            }
        );
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Query key for a relation type's candidate list, **scoped to the workspace**
 * (candidates are workspace entries, so two workspaces never share the cache).
 * The serialized filter — not the tree object — keys the entry so an unchanged
 * filter is a cache hit.
 */
export const relationCandidatesKey = (
    workspaceId: string,
    targetName: string,
    params: {
        search: string;
        filter: string | null;
        extra?: Record<string, string>;
    }
) => ['relation-candidates', workspaceId, targetName, params] as const;

/**
 * The assignable records for a relation's target type, served by
 * `GET /api/content/:type`. `schemaFields` derives each row's title (mirroring
 * the server's `entryTitle`); the picker's search and query-builder `filter` run
 * **server-side**, and the list grows by **real pagination** (`fetchNextPage`,
 * lazy infinite scroll) — there is no artificial window cap, so a type with more
 * than one page of entries is fully reachable. Returns the stable
 * `{ items, total, hasMore, … }` envelope the dialog renders. Disabled (via
 * `enabled`) until the picker opens.
 */
export function useRelationCandidates(
    targetName: string,
    schemaFields: readonly ContentField[],
    params: RelationCandidatesParams,
    enabled = true
): RelationCandidatesResult {
    const { search = '', filter = null, extra = {} } = params;
    const workspace = useCurrentWorkspace();
    // Serialize the query-builder tree to the `?filter=` wire JSON the server
    // parses (null when the tree has no complete rules).
    const filterJson = filter ? treeToJsonFilter(filter) : null;

    const query = useInfiniteQuery({
        queryKey: relationCandidatesKey(workspace.id, targetName, {
            search,
            filter: filterJson,
            ...(Object.keys(extra).length ? { extra } : {})
        }),
        enabled: enabled && !!targetName,
        placeholderData: keepPreviousData,
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            fetchRelationCandidatesPage(
                targetName,
                search,
                filterJson,
                pageParam,
                extra
            ),
        // Another page exists while fewer rows are loaded than the total match
        // count; the next page is the following offset.
        getNextPageParam: (last, pages) => {
            const loaded = pages.reduce((n, p) => n + p.items.length, 0);
            return loaded < last.total ? pages.length + 1 : undefined;
        }
    });

    const rows = query.data?.pages.flatMap((page) => page.items) ?? [];
    const items: RelationCandidate[] = rows.map((record) => ({
        id: record.id,
        title: relationLabel(record.values, schemaFields, record.id),
        status: record.status,
        values: record.values
    }));
    const total = query.data?.pages[0]?.total ?? 0;

    return {
        items,
        total,
        hasMore: query.hasNextPage,
        isPending: enabled && query.isPending,
        isError: query.isError,
        isFetchingNextPage: query.isFetchingNextPage,
        fetchNextPage: query.fetchNextPage
    };
}

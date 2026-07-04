import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    treeToJsonFilter,
    type FilterGroup
} from '@ortha-cms/query-builder-admin';
import type { ContentField, EntryRecord } from '../../types/contentType';
import { relationLabel } from '../../utils/relationLabel';

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
     * How many of the matched rows to return — the picker grows this as the
     * user scrolls (lazy infinite scroll) rather than paging.
     */
    limit: number;
};

/** The windowed envelope: the first `limit` matches, the full count, and more-flag. */
export type RelationCandidatesResult = {
    items: RelationCandidate[];
    /** Total matches across the whole (filtered) set, not just the window. */
    total: number;
    /** Whether more matches exist beyond the current window (drives lazy load). */
    hasMore: boolean;
    /** Whether the first page is still loading (no data yet). */
    isPending: boolean;
    /** Whether the candidate query failed. */
    isError: boolean;
};

/** The list endpoint's envelope for the target type's entries. */
type EntriesEnvelope = {
    items: EntryRecord[];
    total: number;
};

/**
 * Fetch the target type's entries as relation candidates from
 * `GET /api/content/:type` — the same server pipeline the records table uses, so
 * the picker's free-text `search` and the query-builder `filter` are applied
 * **server-side**. The lazy-scroll window is a `pageSize` grown by the dialog;
 * `page` stays 1 so each step re-reads the wider window (kept populated across
 * steps by `keepPreviousData`).
 */
async function fetchRelationCandidates(
    targetName: string,
    search: string,
    filter: string | null,
    limit: number
): Promise<EntriesEnvelope> {
    try {
        const { data } = await apiClient.get<EntriesEnvelope>(
            `/content/${targetName}`,
            {
                params: {
                    ...(search ? { search } : {}),
                    ...(filter ? { filter } : {}),
                    page: 1,
                    pageSize: limit
                }
            }
        );
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Query key for a relation type's candidate window, **scoped to the workspace**
 * (candidates are workspace entries, so two workspaces never share the cache).
 * The serialized filter — not the tree object — keys the entry so an unchanged
 * filter is a cache hit.
 */
export const relationCandidatesKey = (
    workspaceId: string,
    targetName: string,
    params: { search: string; filter: string | null; limit: number }
) => ['relation-candidates', workspaceId, targetName, params] as const;

/**
 * The largest candidate window the picker will grow to — the list endpoint's
 * `MAX_PAGE_SIZE`. Past this the user narrows with search / the query-builder
 * filter instead of scrolling.
 */
const RELATION_CANDIDATE_WINDOW_MAX = 100;

/**
 * The assignable records for a relation's target type, served by
 * `GET /api/content/:type`. `schemaFields` derives each row's title (mirroring
 * the server's `entryTitle`); the picker's search and query-builder `filter` run
 * **server-side**, and the window grows via `limit` (lazy infinite scroll).
 * Returns the stable `{ items, total, hasMore, … }` envelope the dialog renders.
 * Disabled (via `enabled`) until the picker opens.
 */
export function useRelationCandidates(
    targetName: string,
    schemaFields: readonly ContentField[],
    params: RelationCandidatesParams,
    enabled = true
): RelationCandidatesResult {
    const { search = '', filter = null, limit } = params;
    const workspace = useCurrentWorkspace();
    // Serialize the query-builder tree to the `?filter=` wire JSON the server
    // parses (null when the tree has no complete rules).
    const filterJson = filter ? treeToJsonFilter(filter) : null;
    // The list endpoint caps `pageSize` at MAX_PAGE_SIZE (100) and 400s a larger
    // one, so cap the grown window there. The picker browses up to 100 matches;
    // beyond that the user narrows with search / the query-builder filter (both
    // server-side), rather than scrolling an unbounded list.
    const effectiveLimit = Math.min(limit, RELATION_CANDIDATE_WINDOW_MAX);

    const query = useQuery({
        queryKey: relationCandidatesKey(workspace.id, targetName, {
            search,
            filter: filterJson,
            limit: effectiveLimit
        }),
        enabled: enabled && !!targetName,
        placeholderData: keepPreviousData,
        queryFn: () =>
            fetchRelationCandidates(
                targetName,
                search,
                filterJson,
                effectiveLimit
            )
    });

    const rows = query.data?.items ?? [];
    const items: RelationCandidate[] = rows.map((record) => ({
        id: record.id,
        title: relationLabel(record.values, schemaFields, record.id),
        status: record.status,
        values: record.values
    }));
    const total = query.data?.total ?? 0;

    return {
        items,
        total,
        // Stop growing the window at the cap — otherwise `hasMore` would stay
        // true with the list pinned at 100, spinning forever on scroll.
        hasMore:
            total > items.length &&
            items.length < RELATION_CANDIDATE_WINDOW_MAX,
        isPending: enabled && query.isPending,
        isError: query.isError
    };
}

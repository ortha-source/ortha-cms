import { useMemo } from 'react';
import type { FilterField, FilterGroup } from '@ortha-cms/query-builder-admin';
import type { ContentField } from '../../types/contentType';
import { matchesFilterTree } from '../../utils/evalFilterTree';
import { relationLabel } from '../../utils/relationLabel';
import { MOCK_CANDIDATES } from './mockCandidates';

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
};

/** Case-insensitive substring match across a record's string values + title. */
function matchesSearch(candidate: RelationCandidate, search: string): boolean {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    if (candidate.title.toLowerCase().includes(needle)) return true;
    return Object.values(candidate.values).some(
        (value) =>
            typeof value === 'string' && value.toLowerCase().includes(needle)
    );
}

/**
 * The assignable records for a relation's target type. **Mocked** (see
 * `mockCandidates.ts`) — there is no relation read API yet — but it applies the
 * picker's free-text search and the **query-builder filter** client-side
 * (`matchesFilterTree`) and paginates, so the experience matches a real
 * server-backed list. `schemaFields` derives each row's title; `filterFields`
 * are passed through to the evaluator. Returns a stable `{ items, total, … }`
 * envelope so this hook can later be replaced by a call to `GET /content/:type`
 * without touching the dialog.
 */
export function useRelationCandidates(
    targetName: string,
    schemaFields: readonly ContentField[],
    filterFields: readonly FilterField[],
    params: RelationCandidatesParams
): RelationCandidatesResult {
    const { search = '', filter = null, limit } = params;

    return useMemo(() => {
        const seed = MOCK_CANDIDATES[targetName] ?? [];
        const all: RelationCandidate[] = seed.map((record) => ({
            id: record.id,
            title: relationLabel(record.values, schemaFields, record.id),
            status: record.status,
            values: record.values
        }));

        const filtered = all.filter(
            (candidate) =>
                matchesSearch(candidate, search) &&
                matchesFilterTree(candidate, filter, filterFields)
        );

        return {
            items: filtered.slice(0, limit),
            total: filtered.length,
            hasMore: filtered.length > limit
        };
    }, [targetName, schemaFields, filterFields, search, filter, limit]);
}

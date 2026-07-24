import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '../useDebouncedValue';

/** Debounce window for the search box, so a keystroke burst issues one URL write. */
const SEARCH_DEBOUNCE_MS = 300;

/** Reads a 1-based positive int from a query param, falling back to a default. */
function readInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

/** Options for {@link useTableUrlState}. */
export type TableUrlStateOptions = {
    /** The query-param name holding the page's text search (e.g. `'search'`). */
    searchKey: string;
    /** Page size to assume until the server echoes one back. */
    defaultPageSize: number;
};

/** The URL-driven list state {@link useTableUrlState} owns. */
export type TableUrlState = {
    /** Committed search value (URL source of truth). */
    searchParam: string;
    /** Raw `?filter=` JSON string, or `''`. */
    filterParam: string;
    /** 1-based current page. */
    page: number;
    /** Current page size. */
    pageSize: number;
    /** Live (debounced-into-URL) search-box value. */
    searchInput: string;
    /**
     * Whether the box holds a value the list hasn't caught up with yet — the
     * 300ms debounce window plus the URL round-trip.
     *
     * A list's `isFetching` alone is a poor "searching" cue: it only turns true
     * *after* the debounce commits, and on a fast connection the request itself
     * is a few milliseconds, so nothing visible ever happens. OR-ing this in is
     * what makes the spinner appear on the keystroke, which is when the user is
     * actually waiting.
     */
    searchPending: boolean;
    /** Update the search box; the committed value lands in the URL after a debounce. */
    setSearchInput: (value: string) => void;
    /**
     * Merge a query patch into the URL, dropping empty values; resets `page`
     * unless `resetPage` is `false` (a narrowed result set has fewer pages).
     */
    updateParams: (
        patch: Record<string, string | undefined>,
        resetPage?: boolean
    ) => void;
};

/**
 * The URL-as-source-of-truth plumbing shared by admin list pages (Members,
 * Activity): it reads search/filter/page/pageSize off the query string,
 * debounces the search box into the URL, and exposes a single `updateParams`
 * reducer for every other control. The page keeps only its data fetch, the
 * query-builder glue, and the page-clamp — so the bug-prone URL mechanics live
 * in one tested place instead of being copy-pasted per page.
 */
export function useTableUrlState({
    searchKey,
    defaultPageSize
}: TableUrlStateOptions): TableUrlState {
    const [searchParams, setSearchParams] = useSearchParams();

    const searchParam = searchParams.get(searchKey) ?? '';
    const filterParam = searchParams.get('filter') ?? '';
    const page = readInt(searchParams.get('page'), 1);
    const pageSize = readInt(searchParams.get('pageSize'), defaultPageSize);

    const [searchInput, setSearchInput] = useState(searchParam);
    const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

    const updateParams = useCallback(
        (patch: Record<string, string | undefined>, resetPage = true) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    for (const [key, value] of Object.entries(patch)) {
                        if (value) next.set(key, value);
                        else next.delete(key);
                    }
                    if (resetPage) next.delete('page');
                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    // Sync the debounced search into the URL. Settles in one extra pass: once
    // the URL reflects the debounced value the guard is false, so no loop.
    useEffect(() => {
        if (debouncedSearch !== searchParam) {
            updateParams({ [searchKey]: debouncedSearch || undefined });
        }
    }, [debouncedSearch, searchParam, searchKey, updateParams]);

    return {
        searchParam,
        searchPending: searchInput !== searchParam,
        filterParam,
        page,
        pageSize,
        searchInput,
        setSearchInput,
        updateParams
    };
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ContentTypeDetail, EntryRecord } from '../../types/contentType';
import { mockEntries } from '../../utils/mockEntries';
import { applyFilterTree } from '../../utils/applyFilterTree';

/** List params for a collection's records, mirroring the Members list shape. */
export type ContentEntriesParams = {
    /** Free-text search across the row's textual values. */
    search?: string;
    /** Query-builder wire JSON (`?filter=` payload). */
    filter?: string;
    /** 1-based page. */
    page: number;
    /** Rows per page. */
    pageSize: number;
};

/** The paginated envelope, matching the admin list-page convention. */
export type ContentEntriesResult = {
    items: EntryRecord[];
    total: number;
    page: number;
    pageSize: number;
};

/** Query key for a collection's records list. */
export const contentEntriesKey = (
    name: string,
    params: ContentEntriesParams
) => ['content-entries', name, params] as const;

/** True when any of a record's values (or status) contains the search text. */
function matchesSearch(record: EntryRecord, search: string): boolean {
    const needle = search.toLowerCase();
    if (record.status.includes(needle)) return true;
    return Object.values(record.values).some((value) => {
        if (value == null) return false;
        const text = Array.isArray(value)
            ? value.join(' ')
            : typeof value === 'object'
              ? JSON.stringify(value)
              : String(value);
        return text.toLowerCase().includes(needle);
    });
}

/**
 * Loads a collection's records: search → filter → paginate, returning the
 * standard `{ items, total, page, pageSize }` envelope. **This is the only mock
 * boundary** — it fabricates rows from the schema via {@link mockEntries} and
 * filters them client-side. When `GET /api/content/:typeName` lands, replace the
 * body with an `apiClient` call (params already match) and delete the mock utils;
 * every caller stays unchanged.
 */
export function useContentEntries(
    schema: ContentTypeDetail | undefined,
    params: ContentEntriesParams,
    enabled = true
) {
    return useQuery({
        queryKey: contentEntriesKey(schema?.name ?? '', params),
        enabled: enabled && !!schema,
        placeholderData: keepPreviousData,
        queryFn: (): ContentEntriesResult => {
            // Guarded by `enabled: !!schema`, so this is always defined here.
            const all = mockEntries(schema as ContentTypeDetail);
            const searched = params.search
                ? all.filter((row) =>
                      matchesSearch(row, params.search as string)
                  )
                : all;
            const filtered = applyFilterTree(searched, params.filter ?? '');
            const start = (params.page - 1) * params.pageSize;
            return {
                items: filtered.slice(start, start + params.pageSize),
                total: filtered.length,
                page: params.page,
                pageSize: params.pageSize
            };
        }
    });
}

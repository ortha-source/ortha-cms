import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
    ContentField,
    ContentTypeDetail,
    EntryRecord
} from '../../types/contentType';
import { mockEntries } from '../../utils/mockEntries';
import { applyFilterTree } from '../../utils/applyFilterTree';

/** List params for a collection's records, mirroring the Members list shape. */
export type ContentEntriesParams = {
    /** Free-text search across the row's textual values. */
    search?: string;
    /** Query-builder wire JSON (`?filter=` payload). */
    filter?: string;
    /** Sort: a column id (ascending) or `-`-prefixed (descending). */
    sort?: string;
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

/** The comparable value for a record under a given sort column. */
function sortValue(
    record: EntryRecord,
    columnId: string,
    field: ContentField | undefined
): string | number {
    if (columnId === 'status') return record.status;
    if (columnId === 'updatedAt') return Date.parse(record.updatedAt);

    const value = record.values[columnId];
    if (value == null) return '';
    switch (field?.type) {
        case 'number':
        case 'money':
            return typeof value === 'number' ? value : Number(value);
        case 'boolean':
            return value ? 1 : 0;
        case 'date':
        case 'datetime':
            return Date.parse(String(value));
        case 'multiselect':
        case 'relation':
            return Array.isArray(value) ? value.join(', ') : String(value);
        case 'json':
            return JSON.stringify(value);
        default:
            return String(value);
    }
}

/**
 * Sort a copy of `rows` by a sort spec — a column id (ascending) or `-`-prefixed
 * (descending). Type-aware (numbers/dates compare numerically, strings via
 * `localeCompare`); empty values sort last regardless of direction. An empty
 * spec leaves the order untouched.
 */
function applySort(
    rows: EntryRecord[],
    sort: string | undefined,
    schema: ContentTypeDetail
): EntryRecord[] {
    if (!sort) return rows;
    const desc = sort.startsWith('-');
    const columnId = desc ? sort.slice(1) : sort;
    if (!columnId) return rows;

    const field = schema.fields.find((f) => f.name === columnId);
    const factor = desc ? -1 : 1;
    const isEmpty = (v: string | number) => v === '' || v == null;

    return [...rows].sort((a, b) => {
        const av = sortValue(a, columnId, field);
        const bv = sortValue(b, columnId, field);
        // Empty values always sink to the bottom, both directions.
        if (isEmpty(av) !== isEmpty(bv)) return isEmpty(av) ? 1 : -1;
        const cmp =
            typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
        return cmp * factor;
    });
}

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
            const sorted = applySort(
                filtered,
                params.sort,
                schema as ContentTypeDetail
            );
            const start = (params.page - 1) * params.pageSize;
            return {
                items: sorted.slice(start, start + params.pageSize),
                total: sorted.length,
                page: params.page,
                pageSize: params.pageSize
            };
        }
    });
}

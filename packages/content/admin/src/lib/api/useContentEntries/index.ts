import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { ContentTypeDetail, EntryRecord } from '../../types/contentType';

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
export const contentEntriesKey = (name: string, params: ContentEntriesParams) =>
    ['content-entries', name, params] as const;

/**
 * Loads one page of a collection's records from `GET /api/content/:name`. The
 * server runs search → filter → sort → paginate against the type's generated
 * table; the query params line up 1:1 with {@link ContentEntriesParams}. 404s
 * for an unknown/ungranted type surface as the normalized {@link ApiError}.
 */
async function fetchContentEntries(
    name: string,
    params: ContentEntriesParams
): Promise<ContentEntriesResult> {
    try {
        const { data } = await apiClient.get<ContentEntriesResult>(
            `/content/${name}`,
            {
                params: {
                    ...(params.search ? { search: params.search } : {}),
                    ...(params.filter ? { filter: params.filter } : {}),
                    ...(params.sort ? { sort: params.sort } : {}),
                    page: params.page,
                    pageSize: params.pageSize
                }
            }
        );
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Loads a collection's records page. The schema gates the request (the query is
 * disabled until it resolves) and supplies the type name; everything else
 * (search/filter/sort/paginate) happens server-side. `keepPreviousData` keeps
 * the table populated across paging and sorting.
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
        // Guarded by `enabled: !!schema`, so the name is always defined here.
        queryFn: () =>
            fetchContentEntries((schema as ContentTypeDetail).name, params)
    });
}

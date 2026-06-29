import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { EntryRecord } from '../../types/contentType';

/** Query key for one entry's read-one fetch. */
export const contentEntryKey = (name: string, id: string) =>
    ['content-entry', name, id] as const;

/** Key prefix matching every read-one query for a type (for invalidation). */
export const contentEntryPrefix = (name: string) =>
    ['content-entry', name] as const;

/**
 * Loads one entry from `GET /api/content/:name/:id`. 404s (unknown or
 * soft-deleted) surface as the normalized {@link ApiError}.
 */
async function fetchContentEntry(
    name: string,
    id: string
): Promise<EntryRecord> {
    try {
        const { data } = await apiClient.get<EntryRecord>(
            `/content/${name}/${id}`
        );
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Reads one entry for the editor's edit mode. `initialData` (seeded from the
 * records-list cache when the row was opened from the table) keeps the form
 * instant on the common path while a fresh copy refetches in the background;
 * a deep link / reload with no cache simply fetches. Disabled when there's no id.
 */
export function useContentEntry(
    name: string,
    id: string | undefined,
    options: { initialData?: EntryRecord; enabled?: boolean } = {}
) {
    return useQuery({
        queryKey: contentEntryKey(name, id ?? ''),
        queryFn: () => fetchContentEntry(name, id as string),
        enabled: (options.enabled ?? true) && !!id,
        initialData: options.initialData
    });
}

import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { ContentType } from '../../types/wizard';

/** Query key for the content-types list. */
export const contentTypesKey = ['content-types'] as const;

/** Loads the content-type catalogue from `GET /api/content-types`. */
async function fetchContentTypes(): Promise<ContentType[]> {
    try {
        const { data } = await apiClient.get<ContentType[]>('/content-types');
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Loads every content type so the content step can split them into collections
 * and pages. Returns the standard TanStack Query result; callers read `data`,
 * `isPending`, and `isError`.
 */
export function useContentTypes() {
    return useQuery({
        queryKey: contentTypesKey,
        queryFn: fetchContentTypes,
        staleTime: 60_000
    });
}

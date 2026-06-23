import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError, STALE_TIME } from '@ortha-cms/utils-admin';
import type { ContentTypeDetail } from '../../types/contentType';

/** Query key for one content type's full field schema. */
export const contentSchemaKey = (name: string) =>
    ['content-schema', name] as const;

/**
 * Loads the full field schema for one content type from the registry's source
 * of truth, `GET /api/content-schema/:name` (the per-type detail of the
 * `useContentTypes` list). 404s for an unknown/ungranted type surface as the
 * normalized {@link ApiError}. Pass `enabled = false` to defer until the caller
 * has resolved the type.
 */
async function fetchContentSchema(name: string): Promise<ContentTypeDetail> {
    try {
        const { data } = await apiClient.get<ContentTypeDetail>(
            `/content-schema/${name}`
        );
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Loads one content type's full field schema for the records table (columns,
 * filter fields, cell rendering). Returns the standard TanStack Query result.
 */
export function useContentSchema(name: string, enabled = true) {
    return useQuery({
        queryKey: contentSchemaKey(name),
        queryFn: () => fetchContentSchema(name),
        staleTime: STALE_TIME.Standard,
        enabled
    });
}

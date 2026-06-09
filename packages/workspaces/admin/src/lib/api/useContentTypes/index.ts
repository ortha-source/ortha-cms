import { useQuery } from '@tanstack/react-query';
import type { ContentType } from '../../types/wizard';
import { listContentTypes } from '../contentTypesClient';

/** Query key for the content-types list. */
export const contentTypesKey = ['content-types'] as const;

/**
 * Loads every content type so the content step can split them into collections
 * and pages. Returns the standard TanStack Query result; callers read `data`,
 * `isPending`, and `isError`.
 *
 * TODO(content-types-server): back this with `GET /api/content-types`
 * (see {@link listContentTypes}).
 */
export function useContentTypes() {
    return useQuery<ContentType[]>({
        queryKey: contentTypesKey,
        queryFn: listContentTypes,
        staleTime: 60_000
    });
}

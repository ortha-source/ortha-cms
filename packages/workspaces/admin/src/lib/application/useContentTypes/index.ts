import { useQuery } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';

/** Query key for the content-types list. */
export const contentTypesKey = ['content-types'] as const;

/**
 * Loads every content type (via the gateway) so the content step can split them
 * into collections and pages. Returns the standard TanStack Query result;
 * callers read `data`, `isPending`, and `isError`.
 */
export function useContentTypes() {
    return useQuery({
        queryKey: contentTypesKey,
        queryFn: () => httpWorkspaceGateway.listContentTypes(),
        staleTime: 60_000
    });
}

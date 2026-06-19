import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type {
    ContentType,
    ContentTypeSummaryResponse
} from '../../types/contentType';

/** Query key for the content-type schema list. */
export const contentTypesKey = ['content-schema'] as const;

/** Maps one wire summary to the admin model (fields pass through untouched). */
function toContentType(summary: ContentTypeSummaryResponse): ContentType {
    return {
        name: summary.name,
        kind: summary.kind,
        label: summary.label,
        description: summary.description,
        path: summary.path
    };
}

/**
 * Loads every code-defined content type from the registry's source of truth,
 * `GET /api/content-schema` (not the workspace wizard's `/api/content-types`
 * mock). The list is global — content types are code-defined, not per-workspace.
 */
async function fetchContentTypes(): Promise<ContentType[]> {
    try {
        const { data } =
            await apiClient.get<ContentTypeSummaryResponse[]>(
                '/content-schema'
            );
        return data.map(toContentType);
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Loads the content-type catalogue for the Content Library sidebar and search
 * palette. Pass `enabled = false` to defer the request until the caller has
 * confirmed read permission. Returns the standard TanStack Query result.
 */
export function useContentTypes(enabled = true) {
    return useQuery({
        queryKey: contentTypesKey,
        queryFn: fetchContentTypes,
        staleTime: 60_000,
        enabled
    });
}

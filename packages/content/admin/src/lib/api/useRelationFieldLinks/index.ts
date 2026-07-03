import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { RelationFieldView } from '../../types/contentType';

/** Links fetched per infinite-scroll page. */
export const RELATION_LINKS_PAGE_SIZE = 20;

/**
 * Query key for one relation field's paginated links, **scoped to the
 * workspace** so two workspaces never share the cache entry.
 */
export const relationFieldLinksKey = (
    workspaceId: string,
    name: string,
    id: string,
    field: string
) => ['content-relation-field', workspaceId, name, id, field] as const;

/** Key prefix matching every relation-field query for a type in a workspace. */
export const relationFieldLinksPrefix = (workspaceId: string, name: string) =>
    ['content-relation-field', workspaceId, name] as const;

/** One page of a relation field's links. */
async function fetchRelationPage(
    name: string,
    id: string,
    field: string,
    page: number
): Promise<RelationFieldView> {
    try {
        const { data } = await apiClient.get<RelationFieldView>(
            `/content/${name}/${id}/relations/${field}`,
            { params: { page, pageSize: RELATION_LINKS_PAGE_SIZE } }
        );
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Infinite-scroll a many/inverse relation field's assigned links from
 * `GET /api/content/:name/:id/relations/:field` — a relation with thousands of
 * links is paged, never loaded whole. Returns the flattened `items` (ordered by
 * position), the `total`, and the standard `fetchNextPage`/`hasNextPage`.
 * Disabled until there's an entry id (create mode has none).
 */
export function useRelationFieldLinks(
    name: string,
    id: string | undefined,
    field: string,
    enabled = true
) {
    const workspace = useCurrentWorkspace();
    const query = useInfiniteQuery({
        queryKey: relationFieldLinksKey(workspace.id, name, id ?? '', field),
        enabled: enabled && !!id && !!field,
        initialPageParam: 1,
        queryFn: ({ pageParam }) =>
            fetchRelationPage(name, id as string, field, pageParam),
        getNextPageParam: (last, pages) => {
            const loaded = pages.reduce((n, p) => n + p.items.length, 0);
            return loaded < last.total ? pages.length + 1 : undefined;
        }
    });
    const items = query.data?.pages.flatMap((p) => p.items) ?? [];
    return {
        ...query,
        items,
        total: query.data?.pages[0]?.total ?? 0
    };
}

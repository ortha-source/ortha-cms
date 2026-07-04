import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type {
    EntryRelations,
    RelationFieldView
} from '../../types/contentType';

/**
 * Query key for one entry's relation links, **scoped to the workspace** so two
 * workspaces never share the cache entry (the request, and its `X-Workspace-Id`
 * header, never fires on a cache hit).
 */
export const entryRelationsKey = (
    workspaceId: string,
    name: string,
    id: string
) => ['content-entry-relations', workspaceId, name, id] as const;

/** Key prefix matching every relations query for a type in a workspace. */
export const entryRelationsPrefix = (workspaceId: string, name: string) =>
    ['content-entry-relations', workspaceId, name] as const;

/**
 * Loads one entry's relation links from `GET /api/content/:name/:id/relations` —
 * every relation field's **first page** + total, in a single request. 404s
 * (unknown or soft-deleted) surface as the normalized {@link ApiError}.
 */
async function fetchEntryRelations(
    name: string,
    id: string
): Promise<Record<string, RelationFieldView>> {
    try {
        const { data } = await apiClient.get<EntryRelations>(
            `/content/${name}/${id}/relations`
        );
        return data.relations;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Reads an entry's assigned relations for the editor — one request covering
 * **all** relation fields. The editor seeds each relation field's form value
 * from the returned ids and renders the links by title. Disabled until there's
 * an id (create mode has none; a single page resolves its id first).
 */
export function useEntryRelations(
    name: string,
    id: string | undefined,
    enabled = true
) {
    const workspace = useCurrentWorkspace();
    return useQuery({
        queryKey: entryRelationsKey(workspace.id, name, id ?? ''),
        queryFn: () => fetchEntryRelations(name, id as string),
        enabled: enabled && !!id
    });
}

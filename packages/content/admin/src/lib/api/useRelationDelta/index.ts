import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type {
    RelationDelta,
    RelationFieldView
} from '../../types/contentType';
import { contentEntriesPrefix } from '../useContentEntries';
import { entryRelationsKey } from '../useEntryRelations';
import { relationFieldLinksKey } from '../useRelationFieldLinks';

/** What a delta mutation submits: which field, and the link/unlink/reorder diff. */
export type RelationDeltaInput = {
    field: string;
    delta: RelationDelta;
};

/**
 * Apply an incremental link / unlink / reorder to one many/inverse relation
 * field of an existing entry (`POST /api/content/:name/:id/relations/:field`) —
 * the **immediate**, delta-based counterpart to editing a relation through the
 * entry save, so a relation with thousands of links is never sent whole. Returns
 * the field's refreshed first page. On success it invalidates that field's
 * infinite-scroll cache, the entry's relations aggregate (header counts), and
 * the type's records list (a relation cell may have changed).
 */
export function useRelationDelta(name: string, id: string) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    return useMutation<RelationFieldView, ApiError, RelationDeltaInput>({
        mutationFn: ({ field, delta }) =>
            apiClient
                .post<RelationFieldView>(
                    `/content/${name}/${id}/relations/${field}`,
                    delta
                )
                .then((response) => response.data)
                .catch((error) => {
                    throw toApiError(error);
                }),
        onSuccess: (_result, { field }) => {
            queryClient.invalidateQueries({
                queryKey: relationFieldLinksKey(workspace.id, name, id, field)
            });
            queryClient.invalidateQueries({
                queryKey: entryRelationsKey(workspace.id, name, id)
            });
            queryClient.invalidateQueries({
                queryKey: contentEntriesPrefix(workspace.id, name)
            });
        }
    });
}

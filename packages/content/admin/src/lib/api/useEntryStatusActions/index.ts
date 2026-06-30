import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { EntryRecord } from '../../types/contentType';
import { contentEntriesPrefix } from '../useContentEntries';
import { contentEntryPrefix } from '../useContentEntry';

/**
 * Single-entry lifecycle mutations shared by the records row menu and the editor
 * sidebar: publish / unpublish (publishable types), and remove / restore / purge
 * (soft-delete lifecycle). Each takes an entry id and invalidates the type's
 * records list on success. Publish can 422 (the stored row fails validation) —
 * callers surface `error.details.issues`.
 */
export function useEntryStatusActions(typeName: string) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    // Invalidate both the records list and any cached read-one for this type, so
    // the editor's view of a published/unpublished/restored entry stays fresh.
    const invalidate = () => {
        queryClient.invalidateQueries({
            queryKey: contentEntriesPrefix(workspace.id, typeName)
        });
        queryClient.invalidateQueries({
            queryKey: contentEntryPrefix(workspace.id, typeName)
        });
    };

    const publish = useMutation<EntryRecord, ApiError, string>({
        mutationFn: (id) =>
            apiClient
                .post<EntryRecord>(`/content/${typeName}/${id}/publish`)
                .then((response) => response.data)
                .catch((error) => {
                    throw toApiError(error);
                }),
        onSuccess: invalidate
    });

    const unpublish = useMutation<EntryRecord, ApiError, string>({
        mutationFn: (id) =>
            apiClient
                .post<EntryRecord>(`/content/${typeName}/${id}/unpublish`)
                .then((response) => response.data)
                .catch((error) => {
                    throw toApiError(error);
                }),
        onSuccess: invalidate
    });

    const remove = useMutation<void, ApiError, string>({
        mutationFn: (id) =>
            apiClient
                .delete(`/content/${typeName}/${id}`)
                .then(() => undefined)
                .catch((error) => {
                    throw toApiError(error);
                }),
        onSuccess: invalidate
    });

    const restore = useMutation<EntryRecord, ApiError, string>({
        mutationFn: (id) =>
            apiClient
                .post<EntryRecord>(`/content/${typeName}/${id}/restore`)
                .then((response) => response.data)
                .catch((error) => {
                    throw toApiError(error);
                }),
        onSuccess: invalidate
    });

    const purge = useMutation<void, ApiError, string>({
        mutationFn: (id) =>
            apiClient
                .delete(`/content/${typeName}/${id}/permanent`)
                .then(() => undefined)
                .catch((error) => {
                    throw toApiError(error);
                }),
        onSuccess: invalidate
    });

    return { publish, unpublish, remove, restore, purge };
}

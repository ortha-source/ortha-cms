import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type {
    BulkActionResult,
    BulkPublishPreview,
    BulkPublishResult
} from '../../types/contentType';
import { contentEntriesPrefix } from '../useContentEntries';

/**
 * Bulk actions over a selected set of entry ids, shared by the records selection
 * bar. `previewPublish` is a read (validates each id, writes nothing) and so
 * doesn't invalidate; the committing actions invalidate the type's records list
 * on success. Each mutation takes the `ids` array.
 */
export function useBulkEntryActions(typeName: string) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    const invalidate = () =>
        queryClient.invalidateQueries({
            queryKey: contentEntriesPrefix(workspace.id, typeName)
        });

    const post = <T>(suffix: string, ids: string[]) =>
        apiClient
            .post<T>(`/content/${typeName}/bulk/${suffix}`, { ids })
            .then((response) => response.data)
            .catch((error) => {
                throw toApiError(error);
            });

    const previewPublish = useMutation<BulkPublishPreview, ApiError, string[]>({
        mutationFn: (ids) =>
            post<BulkPublishPreview>('publish/preview', ids)
    });

    const publish = useMutation<BulkPublishResult, ApiError, string[]>({
        mutationFn: (ids) => post<BulkPublishResult>('publish', ids),
        onSuccess: invalidate
    });

    const unpublish = useMutation<BulkActionResult, ApiError, string[]>({
        mutationFn: (ids) => post<BulkActionResult>('unpublish', ids),
        onSuccess: invalidate
    });

    const remove = useMutation<BulkActionResult, ApiError, string[]>({
        mutationFn: (ids) => post<BulkActionResult>('delete', ids),
        onSuccess: invalidate
    });

    const restore = useMutation<BulkActionResult, ApiError, string[]>({
        mutationFn: (ids) => post<BulkActionResult>('restore', ids),
        onSuccess: invalidate
    });

    const purge = useMutation<BulkActionResult, ApiError, string[]>({
        mutationFn: (ids) => post<BulkActionResult>('purge', ids),
        onSuccess: invalidate
    });

    return { previewPublish, publish, unpublish, remove, restore, purge };
}

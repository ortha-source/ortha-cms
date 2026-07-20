import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type {
    BulkActionResult,
    BulkPublishPreview,
    BulkPublishResult
} from '../../domain/types/contentType';
import { contentEntriesPrefix } from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';

/**
 * Bulk actions over a selected set of entry ids, via the content gateway, shared
 * by the records selection bar. `previewPublish` is a read (validates each id,
 * writes nothing) and so doesn't invalidate; the committing actions invalidate the
 * type's records list on success. Each mutation takes the `ids` array.
 */
export function useBulkEntryActions(typeName: string) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    const invalidate = () =>
        queryClient.invalidateQueries({
            queryKey: contentEntriesPrefix(workspace.id, typeName)
        });

    const previewPublish = useMutation<BulkPublishPreview, ApiError, string[]>({
        mutationFn: (ids) =>
            httpContentGateway.bulkPreviewPublish(typeName, ids)
    });

    const publish = useMutation<BulkPublishResult, ApiError, string[]>({
        mutationFn: (ids) => httpContentGateway.bulkPublish(typeName, ids),
        onSuccess: invalidate
    });

    const unpublish = useMutation<BulkActionResult, ApiError, string[]>({
        mutationFn: (ids) => httpContentGateway.bulkUnpublish(typeName, ids),
        onSuccess: invalidate
    });

    const remove = useMutation<BulkActionResult, ApiError, string[]>({
        mutationFn: (ids) => httpContentGateway.bulkRemove(typeName, ids),
        onSuccess: invalidate
    });

    const restore = useMutation<BulkActionResult, ApiError, string[]>({
        mutationFn: (ids) => httpContentGateway.bulkRestore(typeName, ids),
        onSuccess: invalidate
    });

    const purge = useMutation<BulkActionResult, ApiError, string[]>({
        mutationFn: (ids) => httpContentGateway.bulkPurge(typeName, ids),
        onSuccess: invalidate
    });

    return { previewPublish, publish, unpublish, remove, restore, purge };
}

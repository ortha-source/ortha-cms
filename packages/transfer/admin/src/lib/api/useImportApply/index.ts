import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@orthacms/utils-admin';
import type { ConflictPolicy, ImportResult } from '@orthacms/transfer-domain';
import { importFormData } from '../useImportPreview';

/** One apply request. */
export interface ImportApplyRequest {
    typeName: string;
    file: File;
    policy: ConflictPolicy;
}

/**
 * Applies an import, then invalidates the content caches.
 *
 * The invalidation is broad on purpose. An import can create and update records
 * of *several* types in one run — that is the point of carrying relations — so
 * narrowing to the collection whose Import button was pressed would leave the
 * related types' lists showing pre-import data with no way for the reader to
 * know. This is the rare case where the blunt instrument is the correct one.
 */
export function useImportApply() {
    const queryClient = useQueryClient();
    return useMutation<ImportResult, unknown, ImportApplyRequest>({
        mutationFn: ({ typeName, file, policy }) =>
            apiClient
                .post<ImportResult>(
                    `/content/${typeName}/import`,
                    importFormData(file, policy)
                )
                .then((response) => response.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['content'] });
            queryClient.invalidateQueries({ queryKey: ['media'] });
        }
    });
}

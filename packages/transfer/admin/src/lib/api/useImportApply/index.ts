import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@orthacms/utils-admin';
import type { ImportResult } from '@orthacms/transfer-domain';
import { importFormData, type ImportOptions } from '../useImportPreview';

/** One apply request. */
export interface ImportApplyRequest extends ImportOptions {
    typeName: string;
    file: File;
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
        mutationFn: ({ typeName, file, ...options }) =>
            apiClient
                .post<ImportResult>(
                    `/content/${typeName}/import`,
                    importFormData(file, options)
                )
                .then((response) => response.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['content'] });
            queryClient.invalidateQueries({ queryKey: ['media'] });
        }
    });
}

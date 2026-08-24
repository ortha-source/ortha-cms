import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@orthacms/utils-admin';
import type { ConflictPolicy, ImportPreview } from '@orthacms/transfer-domain';

/** One dry-run request. */
export interface ImportPreviewRequest {
    typeName: string;
    file: File;
    policy: ConflictPolicy;
}

/** Builds the multipart body both import routes take. */
export function importFormData(file: File, policy: ConflictPolicy): FormData {
    const form = new FormData();
    form.append('file', file);
    form.append('policy', policy);
    return form;
}

/**
 * Dry-runs an import.
 *
 * A mutation rather than a query even though it writes nothing: it is driven by
 * a file the user just picked, it should never be retried or refetched on its
 * own, and caching a result keyed on a `File` is not a thing that works.
 */
export function useImportPreview() {
    return useMutation<ImportPreview, unknown, ImportPreviewRequest>({
        mutationFn: ({ typeName, file, policy }) =>
            apiClient
                .post<ImportPreview>(
                    `/content/${typeName}/import/preview`,
                    importFormData(file, policy)
                )
                .then((response) => response.data)
    });
}

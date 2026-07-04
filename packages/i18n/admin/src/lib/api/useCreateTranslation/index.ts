import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    contentEntriesPrefix,
    type EntryRecord
} from '@ortha-cms/content-admin';
import { I18N_CONTENT_PATH } from '../../constants';
import { entryLocalesPrefix } from '../useEntryLocales';
import { localeSummariesPrefix } from '../useLocaleSummaries';

/** What a create-translation submits. */
export type CreateTranslationInput = {
    /** The source entry whose translation group the new row joins. */
    sourceId: string;
    /** Target locale slug. */
    locale: string;
};

/**
 * Creates a translation via
 * `POST /api/i18n/content/:type/:id/translations` — a new sibling row in the
 * target locale (all values copied as a starting point, same group, draft).
 * A concurrent duplicate surfaces as a **409** {@link ApiError}. On success,
 * invalidates the type's records lists (the new row may appear in the target
 * locale's table), locale panels, and table summaries.
 */
export function useCreateTranslation(typeName: string) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    return useMutation<EntryRecord, ApiError, CreateTranslationInput>({
        mutationFn: async ({ sourceId, locale }) => {
            try {
                const { data } = await apiClient.post<EntryRecord>(
                    `${I18N_CONTENT_PATH}/${typeName}/${sourceId}/translations`,
                    { locale }
                );
                return data;
            } catch (error) {
                throw toApiError(error);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: contentEntriesPrefix(workspace.id, typeName)
            });
            queryClient.invalidateQueries({
                queryKey: entryLocalesPrefix(workspace.id, typeName)
            });
            queryClient.invalidateQueries({
                queryKey: localeSummariesPrefix(workspace.id, typeName)
            });
        }
    });
}

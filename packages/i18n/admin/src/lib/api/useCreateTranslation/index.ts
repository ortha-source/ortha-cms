import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import {
    contentEntriesPrefix,
    type EntryRecord
} from '@ortha-cms/content-admin';
import { entryLocalesPrefix } from '../useEntryLocales';
import { localeSummariesPrefix } from '../useLocaleSummaries';

/** What a create-translation submits. */
export type CreateTranslationInput = {
    /** The source entry's field values, copied as the translation's starting point. */
    values: Record<string, unknown>;
    /** Target locale slug. */
    locale: string;
    /** The source entry's translation group the new sibling joins. */
    localeGroupId: string;
};

/**
 * Creates a translation via the normal create endpoint,
 * `POST /api/content/:type` with `{ values, locale, localeGroupId }` — a new
 * draft sibling in the target locale joining the source's group. The values
 * are copied client-side from the source entry (many-relation links are not
 * copied — they're per-locale in v1). A duplicate locale in the group surfaces
 * as a **409**, an unknown group as a **404** {@link ApiError}. On success,
 * invalidates the type's records lists (the new row may appear in the target
 * locale's table), locale panels, and table summaries.
 */
export function useCreateTranslation(typeName: string) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    return useMutation<EntryRecord, ApiError, CreateTranslationInput>({
        mutationFn: async ({ values, locale, localeGroupId }) => {
            try {
                const { data } = await apiClient.post<EntryRecord>(
                    `/content/${typeName}`,
                    { values, locale, localeGroupId }
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

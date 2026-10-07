import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@orthacms/utils-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { ENTRY_TRANSLATIONS_MAX_IDS, I18N_CONTENT_PATH } from '../../constants';
import type { EntryTranslationsResult } from '../../types/locale';

/** Query key of one selection's translation groups, workspace-scoped. */
export const entryTranslationsKey = (
    workspaceId: string,
    typeName: string,
    ids: readonly string[]
) => ['i18n-entry-translations', workspaceId, typeName, ids] as const;

/**
 * Reads each entry's translation group from
 * `POST /api/i18n/content/:type/translations`, in slices the server accepts —
 * a records selection spans pages and has no cap of its own.
 */
async function fetchEntryTranslations(
    typeName: string,
    ids: readonly string[]
): Promise<EntryTranslationsResult> {
    const entries: EntryTranslationsResult['entries'] = {};
    try {
        for (
            let start = 0;
            start < ids.length;
            start += ENTRY_TRANSLATIONS_MAX_IDS
        ) {
            const { data } = await apiClient.post<EntryTranslationsResult>(
                `${I18N_CONTENT_PATH}/${typeName}/translations`,
                { ids: ids.slice(start, start + ENTRY_TRANSLATIONS_MAX_IDS) }
            );
            Object.assign(entries, data.entries);
        }
    } catch (error) {
        throw toApiError(error);
    }
    return { entries };
}

/**
 * The translation groups of a records selection — per selected entry, its own
 * locale and title and every live member of its group with publish state.
 * Feeds the **Publish with translations** picker.
 *
 * Gated on `enabled` (the picker being open), and refetched each time it
 * opens: the default `staleTime` of 0 makes a re-enabled query fetch, so the
 * picker never offers a state another tab has since changed. **Not** refetched
 * on window focus while open — the picker re-seeds its picks from each answer,
 * and tabbing away to check a record must not wipe what the reader ticked.
 */
export function useEntryTranslations(
    typeName: string,
    ids: readonly string[],
    enabled: boolean
) {
    const workspace = useCurrentWorkspace();
    // Sorted so the same selection is the same key whatever order it was made in.
    const sorted = [...ids].sort();
    return useQuery({
        queryKey: entryTranslationsKey(workspace.id, typeName, sorted),
        enabled: enabled && sorted.length > 0,
        refetchOnWindowFocus: false,
        queryFn: () => fetchEntryTranslations(typeName, sorted)
    });
}

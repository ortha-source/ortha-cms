import { apiClient, toApiError } from '@orthacms/utils-admin';
import { ENTRY_TRANSLATIONS_MAX_IDS, I18N_CONTENT_PATH } from '../../constants';
import type { EntryTranslationsResult } from '../../types/locale';

/** Query key of one batch of entries' translation groups, workspace-scoped. */
export const entryTranslationsKey = (
    workspaceId: string,
    typeName: string,
    ids: readonly string[],
    version: number
) => ['i18n-entry-translations', workspaceId, typeName, ids, version] as const;

/**
 * Reads each entry's translation group from
 * `POST /api/i18n/content/:type/translations`, in slices the server accepts —
 * a records selection has no cap of its own, and the Publish Manager asks
 * about every localized record in a set, linked drafts included.
 */
export async function fetchEntryTranslations(
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

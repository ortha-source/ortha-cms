import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import { contentEntriesPrefix } from '@ortha-cms/content-admin';
import { I18N_CONTENT_PATH } from '../../constants';
import type {
    LocaleSummariesResult,
    LocaleSummaryItem
} from '../../types/locale';

/** What the Locales column's cells consume — the per-group member map. */
export type LocaleSummariesData = {
    /** Live members per translation-group id (empty array = group unknown). */
    groups: Record<string, LocaleSummaryItem[]>;
    /** Whether the batch read is still in flight. */
    isPending: boolean;
};

/**
 * Query key of one page's locale summaries, workspace-scoped. Nested **under**
 * content-admin's `contentEntriesPrefix` so a save's existing invalidation
 * (`useSaveEntry` invalidates that prefix) also refreshes the Locales column —
 * creating/deleting a translation mutates the group, and this key rides along.
 */
export const localeSummariesKey = (
    workspaceId: string,
    typeName: string,
    groupIds: readonly string[]
) =>
    [
        ...contentEntriesPrefix(workspaceId, typeName),
        'i18n-locale-summaries',
        groupIds
    ] as const;

/**
 * Query-key prefix of a type's locale summaries — refreshed whenever the
 * content-entries prefix it nests under is invalidated (translation
 * create/delete), so the table column stays current.
 */
export const localeSummariesPrefix = (workspaceId: string, typeName: string) =>
    [
        ...contentEntriesPrefix(workspaceId, typeName),
        'i18n-locale-summaries'
    ] as const;

/** Batch-loads group summaries via `POST /api/i18n/content/:type/locale-summary`. */
async function fetchLocaleSummaries(
    typeName: string,
    groupIds: string[]
): Promise<LocaleSummariesResult> {
    try {
        const { data } = await apiClient.post<LocaleSummariesResult>(
            `${I18N_CONTENT_PATH}/${typeName}/locale-summary`,
            { groupIds }
        );
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * The locale summaries for one records-table page: one batched request over
 * the page's unique translation-group ids (never per row). Sorted ids key the
 * cache, so row reordering within a page is a cache hit. Disabled until
 * `enabled` (the schema is i18n) and there's something to summarize.
 */
export function useLocaleSummaries(
    typeName: string,
    groupIds: readonly (string | undefined)[],
    enabled = true
): LocaleSummariesData {
    const workspace = useCurrentWorkspace();
    const uniqueIds = [
        ...new Set(groupIds.filter((id): id is string => !!id))
    ].sort();
    const query = useQuery({
        queryKey: localeSummariesKey(workspace.id, typeName, uniqueIds),
        enabled: enabled && uniqueIds.length > 0,
        queryFn: () => fetchLocaleSummaries(typeName, uniqueIds)
    });
    return {
        groups: query.data?.groups ?? {},
        isPending: enabled && uniqueIds.length > 0 && query.isPending
    };
}

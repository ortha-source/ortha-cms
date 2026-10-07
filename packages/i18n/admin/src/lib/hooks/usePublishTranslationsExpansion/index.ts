import { useQueries } from '@tanstack/react-query';
import type {
    PublishAxis,
    PublishCell,
    PublishExpansion,
    PublishRecord,
    PublishSlotContext
} from '@orthacms/publishing-admin';
import {
    entryTranslationsKey,
    fetchEntryTranslations
} from '../../api/entryTranslations';
import { useLocales } from '../../api/useLocales';

/**
 * **Translations** in the Publish Manager (`PUBLISH_EXPANSION_SLOT`): for every
 * localized record in the set — selected or reached by a link — its other
 * translations as cells, and the configured locales as the columns they sit
 * in. This is what turns a selection of English rows into a choice of which
 * languages go out, for every record at once or one record at a time.
 *
 * The publish itself is content's: translations are entries of the same type,
 * so the manager's per-type dry run and commit cover them with no endpoint of
 * this plugin's own. What lives here is only the read —
 * `POST …/translations`, keyed by entry id, one request per localized type in
 * the set, and re-read after a commit through `version`.
 *
 * Every configured locale is a column, translated or not: a column of dashes
 * is what "nobody translated this" looks like, and hiding it would say the
 * language does not exist.
 */
export function usePublishTranslationsExpansion(
    records: readonly PublishRecord[],
    context: PublishSlotContext
): PublishExpansion | null {
    const { locales } = useLocales();
    const anchors = new Map<string, PublishRecord[]>();
    for (const record of records) {
        if (!record.localized) continue;
        const list = anchors.get(record.type) ?? [];
        list.push(record);
        anchors.set(record.type, list);
    }
    const types = [...anchors];
    const queries = useQueries({
        queries: types.map(([type, list]) => {
            const ids = list.map((record) => record.anchorId).sort();
            return {
                queryKey: entryTranslationsKey(
                    context.workspaceId,
                    type,
                    ids,
                    context.version
                ),
                queryFn: () => fetchEntryTranslations(type, ids),
                // The manager carries the reader's picks across every answer;
                // a refetch nobody asked for is a change nobody asked for.
                refetchOnWindowFocus: false
            };
        })
    });
    if (types.length === 0) return null;

    const cells = new Map<string, PublishCell[]>();
    types.forEach(([type, list], index) => {
        const entries = queries[index]?.data?.entries ?? {};
        for (const record of list) {
            const group = entries[record.anchorId];
            if (!group) continue;
            cells.set(
                record.key,
                group.members.map((member) => ({
                    id: member.entryId,
                    type,
                    ...(member.title ? { title: member.title } : {}),
                    // Every type in a publish set is publishable, so the
                    // server always sends a status; draft is the safe reading
                    // of one that is somehow absent — it is offered, and the
                    // dry run has the final word.
                    status: member.status ?? 'draft',
                    publishedAt: member.publishedAt ?? null,
                    locale: member.locale,
                    axis: member.locale
                }))
            );
        }
    });
    const axes: PublishAxis[] = locales.map((locale) => ({
        key: locale.slug,
        label: locale.name,
        code: locale.slug
    }));

    return {
        cells,
        axes,
        isPending: queries.some((query) => query.isPending),
        isError: queries.some((query) => query.isError),
        refetch: () => {
            for (const query of queries) void query.refetch();
        }
    };
}

import { useQueries } from '@tanstack/react-query';
import { STALE_TIME } from '@orthacms/utils-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { relationLabel } from '../../domain/relationLabel';
import type { ContentType, EntryRecord } from '../../domain/types/contentType';
import {
    contentEntriesKey,
    contentSchemaKey,
    type ContentEntriesParams
} from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';

/** How many of each type's newest records the overview reads. */
const PER_TYPE = 5;

/**
 * The most types the overview asks about. One list read per type is fine for
 * a workspace's handful; a catalogue of dozens would fan out a request each
 * on every visit to the library's landing.
 */
export const RECENT_TYPE_LIMIT = 12;

const PARAMS: ContentEntriesParams = {
    sort: '-updatedAt',
    page: 1,
    pageSize: PER_TYPE
};

/** One record in the "Recently edited" list. */
export type RecentEntry = {
    id: string;
    type: ContentType;
    /** The record's display title — its first short text field, else the id. */
    title: string;
    updatedAt: string;
    locale?: string;
    entry: Pick<EntryRecord, 'status' | 'publishedAt'>;
};

/** What the overview knows about one type from its newest page of records. */
export type TypeActivity = {
    /** Every record of the type in this workspace. */
    total: number;
    /** When its newest record was last saved, or `null` with none. */
    updatedAt: string | null;
    /** A single's one record, for its status. */
    first: EntryRecord | null;
};

/**
 * The workspace's most recently saved records across its own types, newest
 * first — plus, per type, its record count and last save, which the same
 * reads answer.
 *
 * One `?sort=-updatedAt` page per type (capped at {@link RECENT_TYPE_LIMIT}),
 * keyed exactly as the records table keys its lists so they share cache, plus
 * each type's schema for the titles (shared with the table too).
 */
export function useRecentEntries(types: readonly ContentType[], limit = 6) {
    const workspace = useCurrentWorkspace();
    const asked = types.slice(0, RECENT_TYPE_LIMIT);

    const lists = useQueries({
        queries: asked.map((type) => ({
            queryKey: contentEntriesKey(workspace.id, type.name, PARAMS),
            queryFn: () => httpContentGateway.listEntries(type.name, PARAMS),
            staleTime: STALE_TIME.Standard
        }))
    });
    const schemas = useQueries({
        queries: asked.map((type) => ({
            queryKey: contentSchemaKey(type.name),
            queryFn: () => httpContentGateway.getSchema(type.name),
            staleTime: STALE_TIME.Standard
        }))
    });

    const byType = new Map<string, TypeActivity>();
    const entries: RecentEntry[] = [];
    asked.forEach((type, index) => {
        const result = lists[index].data;
        if (!result) return;
        const [first = null] = result.items;
        byType.set(type.name, {
            total: result.total,
            updatedAt: first?.updatedAt ?? null,
            first
        });
        const fields = schemas[index].data?.fields ?? [];
        for (const item of result.items) {
            entries.push({
                id: item.id,
                type,
                title: relationLabel(item.values, fields, item.id),
                updatedAt: item.updatedAt,
                locale: item.locale,
                entry: item
            });
        }
    });
    entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return {
        entries: entries.slice(0, limit),
        byType,
        isPending:
            lists.some((query) => query.isPending) ||
            schemas.some((query) => query.isPending),
        isError: lists.length > 0 && lists.every((query) => query.isError)
    };
}

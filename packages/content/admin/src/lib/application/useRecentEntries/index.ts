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
 * The most types the overview reads. Every own type gets one small list read
 * — its count and last save live in it, and a card without them would sit on
 * a skeleton — so this is only a guard against a pathological catalogue; a
 * type past it shows its card without figures rather than loading forever.
 */
export const RECENT_TYPE_LIMIT = 60;

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
export type TypeActivity =
    | { state: 'pending' }
    | {
          state: 'ready';
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
 * One `?sort=-updatedAt` page per own type (up to {@link RECENT_TYPE_LIMIT}),
 * keyed as the records table keys its lists. Schemas — needed only to title a
 * row — are read for the types that actually reach the list, not for every
 * type in the catalogue. A type whose read failed is simply absent from
 * `byType`: its card shows no figures rather than a skeleton that never ends.
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

    const byType = new Map<string, TypeActivity>();
    const candidates: { type: ContentType; item: EntryRecord }[] = [];
    asked.forEach((type, index) => {
        const query = lists[index];
        if (query.isPending) {
            byType.set(type.name, { state: 'pending' });
            return;
        }
        const result = query.data;
        if (!result) return;
        const [first = null] = result.items;
        byType.set(type.name, {
            state: 'ready',
            total: result.total,
            updatedAt: first?.updatedAt ?? null,
            first
        });
        for (const item of result.items) candidates.push({ type, item });
    });
    candidates.sort((a, b) => b.item.updatedAt.localeCompare(a.item.updatedAt));
    const shown = candidates.slice(0, limit);

    // Only the types on screen need their fields, for the titles.
    const titled = [...new Set(shown.map(({ type }) => type.name))];
    const schemas = useQueries({
        queries: titled.map((name) => ({
            queryKey: contentSchemaKey(name),
            queryFn: () => httpContentGateway.getSchema(name),
            staleTime: STALE_TIME.Standard
        }))
    });
    const fieldsOf = (name: string) =>
        schemas[titled.indexOf(name)]?.data?.fields;

    const entries: RecentEntry[] = shown.map(({ type, item }) => ({
        id: item.id,
        type,
        title: relationLabel(item.values, fieldsOf(type.name) ?? [], item.id),
        updatedAt: item.updatedAt,
        locale: item.locale,
        entry: item
    }));

    return {
        entries,
        byType,
        isPending:
            lists.some((query) => query.isPending) ||
            schemas.some((query) => query.isPending),
        isError: lists.length > 0 && lists.every((query) => query.isError)
    };
}

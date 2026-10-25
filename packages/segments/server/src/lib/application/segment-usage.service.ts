import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, inArray, or, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    entryTitle,
    InjectContentRegistry,
    type AnyContentType,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import { segments } from '../schema/segments';
import { entryAccess } from '../schema/entry-access';
import { uuidArray } from '../infrastructure/uuid-array';

/**
 * Most entries one usage read names.
 *
 * The panel beside the audience form and the delete confirmation are both a
 * glance, not a report — past this the count is still exact and the records
 * list (filtered to the audience) is where the rest are read.
 */
export const SEGMENT_USAGE_LIMIT = 100;

/** Which list of the entry names the audience. */
export const USAGE_STATE = {
    /** In the allow list — readers in the audience **can see** it. */
    Allow: 'allow',
    /** In the deny list — readers in the audience **cannot see** it. */
    Deny: 'deny'
} as const;

/** One value of {@link USAGE_STATE}. */
export type UsageState = (typeof USAGE_STATE)[keyof typeof USAGE_STATE];

/** One entry that names the audience. */
export interface SegmentUsageItem {
    entryId: string;
    /** The entry's content type slug — what the admin's entry route carries. */
    typeSlug: string;
    /** The type's label, or the slug when the type is no longer registered. */
    typeLabel: string;
    /**
     * The entry's display title, or `null` when it cannot be read — its type is
     * no longer registered, so there is no table to read it from.
     */
    title: string | null;
    /** The row's locale on a localized type; `null` otherwise. */
    locale: string | null;
    /** Whether the entry allows or refuses the audience. */
    state: UsageState;
    /** Whether the entry is in the trash — it still names the audience. */
    trashed: boolean;
}

/** Where one audience is used, in one workspace. */
export interface SegmentUsageView {
    segmentId: string;
    /** Every entry of this workspace that names the audience, either way. */
    total: number;
    /** The first {@link SEGMENT_USAGE_LIMIT}, by type then title. */
    items: SegmentUsageItem[];
    /** Whether {@link SegmentUsageView.items} stops short of `total`. */
    truncated: boolean;
}

/** One `entry_access` row naming the audience. */
interface AccessRow {
    entryId: string;
    typeSlug: string;
    allow: string[];
    deny: string[];
}

/** The locale / soft-delete envelope columns, read by name off a type's table. */
type Columns = Record<string, PgColumn | undefined>;

/**
 * Where an audience is used — the entries of **one workspace** that name it.
 *
 * What the audience page shows beside its form, and what its delete
 * confirmation spells out: which entries allow the audience, which refuse it,
 * before anybody changes the tags those entries rely on or deletes it out from
 * under them.
 *
 * **Workspace-scoped, on purpose.** The directory is installation-wide, but an
 * entry is not, and its title is content. The answer reads `entry_access` by
 * the caller's workspace and then the entry rows by the same workspace, so a
 * session holding one workspace cannot learn the titles — or the existence — of
 * another's entries through this route. The directory's `usageCount` stays the
 * installation-wide figure it always was; this is the part of it the caller may
 * open.
 *
 * Read-only, and it reads `entry_access` directly rather than through the public
 * entry read: that read is reader-scoped, and an entry restricted from the
 * anonymous reader is exactly the one this has to name.
 */
@Injectable()
export class SegmentUsageService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        // The token, not the class: content provides the registry as a
        // `useValue` under `CONTENT_REGISTRY`.
        @InjectContentRegistry() private readonly types: ContentTypeRegistry
    ) {}

    /** The entries of `workspaceId` naming `segmentId`, either way. */
    async forWorkspace(
        segmentId: string,
        workspaceId: string
    ): Promise<SegmentUsageView> {
        const [segment] = await this.db
            .select({ id: segments.id })
            .from(segments)
            .where(eq(segments.id, segmentId))
            .limit(1);
        // Segments are installation-wide vocabulary any `segments:read` holder
        // can list, so a 404 here tells nobody anything the directory does not.
        if (!segment) throw new NotFoundException('Unknown segment.');

        const named = uuidArray([segmentId]);
        const where = and(
            eq(entryAccess.workspaceId, workspaceId),
            or(
                sql`${entryAccess.allow} @> ${named}`,
                sql`${entryAccess.deny} @> ${named}`
            )
        );

        const [counted, rows] = await Promise.all([
            this.db
                .select({ value: count() })
                .from(entryAccess)
                .where(where)
                .then(([row]) => Number(row?.value ?? 0)),
            this.db
                .select({
                    entryId: entryAccess.entryId,
                    typeSlug: entryAccess.typeSlug,
                    allow: entryAccess.allow,
                    deny: entryAccess.deny
                })
                .from(entryAccess)
                .where(where)
                .orderBy(asc(entryAccess.typeSlug), asc(entryAccess.entryId))
                .limit(SEGMENT_USAGE_LIMIT)
        ]);

        const items: SegmentUsageItem[] = [];
        let orphans = 0;
        for (const [slug, group] of groupBySlug(rows)) {
            const type = this.types.get(slug);
            if (!type) {
                // A type removed from the model leaves its access rows behind.
                // Still named, so still counted — just without a title to show.
                for (const row of group) {
                    items.push(toItem(row, segmentId, slug, null));
                }
                continue;
            }
            const entries = await this.entries(
                type,
                group.map((row) => row.entryId),
                workspaceId
            );
            for (const row of group) {
                const entry = entries.get(row.entryId);
                // A hard-deleted entry leaves its `entry_access` row behind
                // (deletes are not hooked). Nobody can open it, so it is not
                // listed — and not counted, or "Used by 3" would sit over two.
                if (!entry) {
                    orphans += 1;
                    continue;
                }
                items.push(toItem(row, segmentId, type.label, entry));
            }
        }

        items.sort(
            (a, b) =>
                a.typeLabel.localeCompare(b.typeLabel) ||
                (a.title ?? '').localeCompare(b.title ?? '') ||
                a.entryId.localeCompare(b.entryId)
        );
        const total = Math.max(items.length, counted - orphans);
        return {
            segmentId,
            total,
            items,
            truncated: total > items.length
        };
    }

    /**
     * Title, locale and trash state of some entries of one type — read by the
     * workspace as well as the id, so an access row carrying a foreign entry id
     * (which the write paths refuse, but a row is a row) never names it.
     */
    private async entries(
        type: AnyContentType,
        ids: readonly string[],
        workspaceId: string
    ): Promise<Map<string, EntryFacts>> {
        const columns = type.table as unknown as Columns;
        const id = columns['id'];
        const workspace = columns['workspaceId'];
        if (!id || !workspace || !ids.length) return new Map();

        const rows = (await this.db
            .select()
            .from(type.table)
            .where(
                and(inArray(id, [...ids]), eq(workspace, workspaceId))
            )) as Record<string, unknown>[];

        return new Map(
            rows.map((row) => [
                row['id'] as string,
                {
                    title: entryTitle(type, row),
                    locale:
                        typeof row['locale'] === 'string'
                            ? row['locale']
                            : null,
                    trashed: row['deletedAt'] != null
                }
            ])
        );
    }
}

/** What one entry row contributes to its usage item. */
interface EntryFacts {
    title: string;
    locale: string | null;
    trashed: boolean;
}

/** The rows, grouped by type slug in first-seen order. */
function groupBySlug(rows: readonly AccessRow[]): Map<string, AccessRow[]> {
    const groups = new Map<string, AccessRow[]>();
    for (const row of rows) {
        const group = groups.get(row.typeSlug) ?? [];
        group.push(row);
        groups.set(row.typeSlug, group);
    }
    return groups;
}

/**
 * One usage item. A row naming the audience on both sides — which the admin's
 * `withState` makes unreachable, but the `PUT` route would store — reads as a
 * **deny**, because that is what `canRead` makes of it.
 */
function toItem(
    row: AccessRow,
    segmentId: string,
    typeLabel: string,
    entry: EntryFacts | null
): SegmentUsageItem {
    return {
        entryId: row.entryId,
        typeSlug: row.typeSlug,
        typeLabel,
        title: entry?.title ?? null,
        locale: entry?.locale ?? null,
        state: row.deny.includes(segmentId)
            ? USAGE_STATE.Deny
            : USAGE_STATE.Allow,
        trashed: entry?.trashed ?? false
    };
}

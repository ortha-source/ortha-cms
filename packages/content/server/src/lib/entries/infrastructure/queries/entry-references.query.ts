import { Injectable } from '@nestjs/common';
import {
    and,
    count,
    eq,
    isNotNull,
    isNull,
    ne,
    sql,
    type AnyColumn
} from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { InjectContentRegistry } from '../../../content.tokens';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import type { AnyContentType } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../../../types/fields';
import type {
    EntryReference,
    EntryReferenceOnPurge,
    EntryReferencesView
} from '../../types/entry-list-view';
import { fieldLabel } from './entry-filter-surface';

/** A generated content/join table seen as a bag of columns by property name. */
type Columns = Record<string, AnyColumn>;

/** One grouped count: how many referrers, and how many of them are live. */
type CountRow = { count: number | string; live: number | string };

/**
 * Which records **in this workspace** link to one entry, and what a permanent
 * delete would do to each — the read behind
 * `GET /content/:type/:id/references`, which the admin asks before it deletes
 * or purges a record.
 *
 * The sibling of {@link EntryUsagesQuery}, which answers the same walk for the
 * *other* workspaces of a shared one. Same rules: every **storage-owning**
 * relation field targeting the type (inverses own no storage and would count a
 * link twice), referrers in the trash do not count, and the entry's own row
 * does not count as referring to itself. One grouped count per field — the
 * registry is code-defined, so the statement count is fixed per type.
 *
 * Counts, not rows: the confirmation needs "12 records, 3 of them live, and
 * purging deletes 2 of them", not a list it would have to page.
 */
@Injectable()
export class EntryReferencesQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    /**
     * Whether `id` is an entry of `target` in `workspaceId` — live **or** in the
     * trash, since a purge is asked about from the trash.
     */
    async exists(
        target: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<boolean> {
        const cols = target.table as unknown as Columns;
        const [row] = await this.db
            .select({ one: sql`1` })
            .from(target.table)
            .where(
                and(eq(cols['id'], id), eq(cols['workspaceId'], workspaceId))
            )
            .limit(1);
        return !!row;
    }

    /** The references into entry `id` of `target`, per referring field. */
    async forEntry(
        target: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<EntryReferencesView> {
        const items: EntryReference[] = [];
        for (const source of this.registry.all()) {
            for (const [field, spec] of Object.entries(source.fields)) {
                if (
                    spec.type !== CONTENT_FIELD_TYPE.Relation ||
                    !spec.relation ||
                    spec.relation.inverse ||
                    spec.relation.to().name !== target.name
                )
                    continue;
                const [row] = spec.relation.many
                    ? await this.joinCount(source, field, id, workspaceId)
                    : await this.fkCount(source, field, id, workspaceId);
                const total = Number(row?.count ?? 0);
                if (!total) continue;
                items.push({
                    typeName: source.name,
                    typeLabel: source.label,
                    field,
                    fieldLabel: fieldLabel(field, spec),
                    count: total,
                    live: Number(row?.live ?? 0),
                    onPurge: onPurgeOf(spec)
                });
            }
        }
        items.sort(
            (a, b) =>
                b.count - a.count ||
                a.typeLabel.localeCompare(b.typeLabel) ||
                a.fieldLabel.localeCompare(b.fieldLabel)
        );
        return {
            items,
            total: items.reduce((sum, item) => sum + item.count, 0),
            live: items.reduce((sum, item) => sum + item.live, 0)
        };
    }

    /**
     * How many of the counted referrers have a **live** version — published,
     * or Modified (a `published_at` survives an edit). Those are the ones a
     * reader of the content API would see lose the link. A non-publishable
     * type is always live.
     */
    private liveCount(source: AnyContentType) {
        const cols = source.table as unknown as Columns;
        return source.publishable
            ? sql<number>`count(*) filter (where ${isNotNull(cols['publishedAt'])})`
            : count();
    }

    /** The referrer predicate shared by both storage forms. */
    private referrerWhere(
        source: AnyContentType,
        id: string,
        workspaceId: string
    ) {
        const cols = source.table as unknown as Columns;
        return and(
            eq(cols['workspaceId'], workspaceId),
            // A self-relation: the entry is not a reference to itself.
            ne(cols['id'], id),
            source.paranoid ? isNull(cols['deletedAt']) : undefined
        );
    }

    /** Owning single relation: rows of `source` whose FK names the entry. */
    private fkCount(
        source: AnyContentType,
        field: string,
        id: string,
        workspaceId: string
    ): Promise<CountRow[]> {
        const cols = source.table as unknown as Columns;
        return this.db
            .select({ count: count(), live: this.liveCount(source) })
            .from(source.table)
            .where(
                and(
                    eq(cols[field], id),
                    this.referrerWhere(source, id, workspaceId)
                )
            ) as unknown as Promise<CountRow[]>;
    }

    /** Owning many-to-many: entries of `source` with a join row to the entry. */
    private joinCount(
        source: AnyContentType,
        field: string,
        id: string,
        workspaceId: string
    ): Promise<CountRow[]> {
        const join = source.joinTables[field];
        if (!join) return Promise.resolve([]);
        const joinCols = join as unknown as Columns;
        const cols = source.table as unknown as Columns;
        return this.db
            .select({ count: count(), live: this.liveCount(source) })
            .from(join)
            .innerJoin(source.table, eq(cols['id'], joinCols['sourceId']))
            .where(
                and(
                    eq(joinCols['targetId'], id),
                    this.referrerWhere(source, id, workspaceId)
                )
            ) as unknown as Promise<CountRow[]>;
    }
}

/**
 * What a **permanent** delete of the target does to a referrer through one
 * field — the foreign key decides, not this code. A join row cascades, so a
 * many-relation just loses the link; a single FK follows its `onDelete`.
 */
function onPurgeOf(spec: AnyFieldSpec): EntryReferenceOnPurge {
    if (spec.relation?.many) return 'unlink';
    switch (spec.relation?.onDelete) {
        case 'cascade':
            return 'delete';
        case 'restrict':
            return 'block';
        default:
            return 'unlink';
    }
}

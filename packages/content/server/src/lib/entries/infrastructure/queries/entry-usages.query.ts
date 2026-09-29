import { Injectable } from '@nestjs/common';
import { and, count, eq, isNull, ne, type AnyColumn } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@orthacms/database';
import { InjectContentRegistry } from '../../../content.tokens';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import type { AnyContentType } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../../types/fields';
import type { EntryUsage } from '../../types/entry-list-view';
import { SharedSourcesQuery } from './shared-sources.query';

/** A generated content/join table seen as a bag of columns by property name. */
type Columns = Record<string, AnyColumn>;

/** The same bag typed for Drizzle's select builder. */
type SelectableColumns = Record<string, PgColumn>;

/**
 * How often records in **other** workspaces link to one entry — the read
 * model behind `GET /content/:type/:id/usages` (ADR-0019). A shared
 * workspace's editors see, before they unpublish or delete, who is relying on
 * the record.
 *
 * Walks every **storage-owning** relation field in the registry that targets
 * the entry's type — owning single FKs (the `<field>_id` column) and owning
 * many-to-many join tables. Inverse fields own no storage, so counting them
 * would count the same link twice. A link from a soft-deleted source is not a
 * usage. One grouped count per field; the registry is code-defined, so the
 * number of statements is fixed per type, never per row.
 *
 * Reports counts and workspace names only — never the linking entries —
 * because the caller is a member of the target's workspace, not of the
 * consumers'.
 */
@Injectable()
export class EntryUsagesQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly shared: SharedSourcesQuery
    ) {}

    /**
     * Link counts into entry `id` of `target`, from entries outside
     * `workspaceId`, grouped by workspace and sorted by count (descending,
     * then name). The caller has already established that the entry belongs to
     * `workspaceId`.
     */
    async forEntry(
        target: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<EntryUsage[]> {
        const totals = new Map<string, number>();
        for (const source of this.registry.all()) {
            for (const [field, spec] of Object.entries(source.fields)) {
                if (
                    spec.type !== CONTENT_FIELD_TYPE.Relation ||
                    !spec.relation ||
                    spec.relation.inverse ||
                    spec.relation.to().name !== target.name
                )
                    continue;
                const rows = spec.relation.many
                    ? await this.joinUsages(source, field, id, workspaceId)
                    : await this.fkUsages(source, field, id, workspaceId);
                for (const row of rows) {
                    totals.set(
                        row.workspaceId,
                        (totals.get(row.workspaceId) ?? 0) + Number(row.count)
                    );
                }
            }
        }
        if (!totals.size) return [];
        const names = await this.shared.workspaceNames(totals.keys());
        return [...totals]
            .map(([usingWorkspace, total]) => ({
                workspaceId: usingWorkspace,
                workspaceName: names.get(usingWorkspace) ?? '',
                count: total
            }))
            .sort(
                (a, b) =>
                    b.count - a.count ||
                    a.workspaceName.localeCompare(b.workspaceName) ||
                    a.workspaceId.localeCompare(b.workspaceId)
            );
    }

    /** Owning single relation: rows of `source` whose FK names the entry. */
    private fkUsages(
        source: AnyContentType,
        field: string,
        id: string,
        workspaceId: string
    ) {
        const cols = source.table as unknown as SelectableColumns;
        const plain = source.table as unknown as Columns;
        return this.db
            .select({ workspaceId: cols['workspaceId'], count: count() })
            .from(source.table)
            .where(
                and(
                    eq(plain[field], id),
                    ne(plain['workspaceId'], workspaceId),
                    source.paranoid ? isNull(plain['deletedAt']) : undefined
                )
            )
            .groupBy(cols['workspaceId']) as unknown as Promise<
            { workspaceId: string; count: number }[]
        >;
    }

    /** Owning many-to-many: join rows naming the entry, by source workspace. */
    private joinUsages(
        source: AnyContentType,
        field: string,
        id: string,
        workspaceId: string
    ) {
        const join = source.joinTables[field];
        if (!join) return Promise.resolve([]);
        const joinCols = join as unknown as Columns;
        const cols = source.table as unknown as SelectableColumns;
        const plain = source.table as unknown as Columns;
        return this.db
            .select({ workspaceId: cols['workspaceId'], count: count() })
            .from(join)
            .innerJoin(source.table, eq(plain['id'], joinCols['sourceId']))
            .where(
                and(
                    eq(joinCols['targetId'], id),
                    ne(plain['workspaceId'], workspaceId),
                    source.paranoid ? isNull(plain['deletedAt']) : undefined
                )
            )
            .groupBy(cols['workspaceId']) as unknown as Promise<
            { workspaceId: string; count: number }[]
        >;
    }
}

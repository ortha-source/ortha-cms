import { Injectable } from '@nestjs/common';
import {
    and,
    asc,
    count,
    desc,
    ilike,
    isNull,
    or,
    type AnyColumn,
    type SQL
} from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { applyFilterTree, parseFilterTree } from '@ortha-cms/utils-server';
import type { AnyContentType } from '../../types/content-type';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../../types/fields';
import type { ListEntriesQueryDto } from '../dto/list-entries-query.dto';
import type { EntryListView, EntryRecord } from '../types/entry-list-view';
import { DEFAULT_PAGE_SIZE } from '../entries.constants';
import { buildEntryFilterSchema, isScalarField } from './entry-filter-schema';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/** Columns the free-text `search` scans (have searchable textual content). */
function isTextLike(spec: AnyFieldSpec): boolean {
    return (
        spec.type === CONTENT_FIELD_TYPE.Text ||
        spec.type === CONTENT_FIELD_TYPE.RichText ||
        spec.type === CONTENT_FIELD_TYPE.Select
    );
}

/**
 * Reads a collection's entries. Generic over the content type: the physical
 * table, the filterable columns, the searchable columns, and the sort whitelist
 * are all derived from `type` at request time, so one service backs every
 * collection. Owns no schema of its own — it queries the HOST-owned generated
 * `content_<name>` tables through the shared Drizzle client.
 */
@Injectable()
export class EntriesService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * One page of a collection's entries: search → filter → sort → paginate, run
     * in SQL against the type's generated table, returned as the
     * `{ items, total, page, pageSize }` envelope the admin records table renders.
     */
    async list(
        type: AnyContentType,
        query: ListEntriesQueryDto
    ): Promise<EntryListView> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

        const where = await this.listWhere(type, query);
        const orderBy = this.orderBy(type, query.sort);

        // Count and page rows share the WHERE but are independent — run them
        // concurrently so the request pays the slower of the two, not their sum.
        const [[{ total }], rows] = await Promise.all([
            this.db.select({ total: count() }).from(type.table).where(where),
            this.db
                .select()
                .from(type.table)
                .where(where)
                .orderBy(...orderBy)
                .limit(pageSize)
                .offset((page - 1) * pageSize)
        ]);

        return {
            items: rows.map((row) =>
                this.toRecord(type, row as Record<string, unknown>)
            ),
            total,
            page,
            pageSize
        };
    }

    /**
     * The full WHERE: free-text search AND the query-builder `?filter=` tree AND
     * (for paranoid types) the not-deleted guard. `and(undefined, …)` collapses
     * empties, so an unfiltered list still scans the whole table. A malformed
     * filter throws a `FilterException` (HTTP 400).
     */
    private async listWhere(
        type: AnyContentType,
        query: ListEntriesQueryDto
    ): Promise<SQL | undefined> {
        const table = type.table as unknown as ContentTable;
        const schema = buildEntryFilterSchema(type);
        const tree = parseFilterTree(query.filter, schema);
        const filterSql = await applyFilterTree(
            tree,
            schema,
            type.table,
            this.db
        );
        return and(
            this.searchPredicate(type, query.search),
            filterSql,
            type.paranoid ? isNull(table['deletedAt']) : undefined
        );
    }

    /**
     * Case-insensitive `ILIKE` across the type's text-like columns, OR-ed
     * together; `undefined` when there's no search term. The needle's LIKE
     * metacharacters are escaped so a literal `%`/`_` searches literally.
     */
    private searchPredicate(
        type: AnyContentType,
        search: string | undefined
    ): SQL | undefined {
        const needle = search?.trim();
        if (!needle) return undefined;
        const table = type.table as unknown as ContentTable;
        const pattern = `%${needle.replace(/[\\%_]/g, '\\$&')}%`;
        const clauses = Object.entries(type.fields)
            .filter(([, spec]) => isTextLike(spec))
            .map(([name]) => ilike(table[name], pattern));
        return clauses.length ? or(...clauses) : undefined;
    }

    /**
     * Translate the `?sort=` spec (`col` asc, `-col` desc) into an ORDER BY,
     * always with an `id` tiebreaker so pagination is stable across requests.
     * Sortable = the always-present envelope columns + `status` (publishable
     * only) + the type's **scalar** fields. Non-scalar fields (`json`/
     * `multiselect`, single/many `relation`) are excluded — a many-relation has
     * no column on the main table at all, so ordering by it would pass
     * `undefined` to `asc`/`desc`; the others have no meaningful order. An
     * unknown or excluded column falls back to `updatedAt` desc.
     */
    private orderBy(type: AnyContentType, sort: string | undefined): SQL[] {
        const table = type.table as unknown as ContentTable;
        const sortable = new Set<string>([
            'createdAt',
            'updatedAt',
            ...(type.publishable ? ['status'] : []),
            ...Object.entries(type.fields)
                .filter(([, spec]) => isScalarField(spec))
                .map(([name]) => name)
        ]);
        const isDesc = !!sort && sort.startsWith('-');
        const columnId = sort ? (isDesc ? sort.slice(1) : sort) : '';

        // The whitelist only admits scalar columns, but guard against a missing
        // column defensively so a sort key never reaches `asc(undefined)`.
        const col = sortable.has(columnId) ? table[columnId] : undefined;
        if (col) {
            return [isDesc ? desc(col) : asc(col), asc(table['id'])];
        }
        return [desc(table['updatedAt']), asc(table['id'])];
    }

    /**
     * Map a raw DB row to the admin `EntryRecord`: envelope fields plus a
     * `values` bag keyed by field name. `status` is emitted only for publishable
     * types. Many-relations live in join tables and aren't selected here yet
     * (single relations pass through as their FK uuid).
     */
    private toRecord(
        type: AnyContentType,
        row: Record<string, unknown>
    ): EntryRecord {
        const values: Record<string, unknown> = {};
        for (const [name, spec] of Object.entries(type.fields)) {
            if (
                spec.type === CONTENT_FIELD_TYPE.Relation &&
                spec.relation?.many
            )
                continue;
            values[name] = row[name] ?? null;
        }
        const record: EntryRecord = {
            id: row['id'] as string,
            createdAt: (row['createdAt'] as Date).toISOString(),
            updatedAt: (row['updatedAt'] as Date).toISOString(),
            values
        };
        if (type.publishable) {
            record.status = row['status'] as EntryRecord['status'];
        }
        return record;
    }
}

import {
    Inject,
    Injectable,
    NotFoundException,
    Optional
} from '@nestjs/common';
import {
    and,
    asc,
    count,
    desc,
    eq,
    isNull,
    type AnyColumn,
    type SQL
} from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { applyFilterTree, parseFilterTree } from '@ortha-cms/utils-server';
import {
    CONTENT_ENTRY_EXTENSION,
    type ContentEntryExtension
} from '../../extension/entry-extension';
import { ENTRY_STATUS, type AnyContentType } from '../../types/content-type';
import { isScalarField } from '../../entries/infrastructure/queries/entry-scalar-fields';
import { buildEntryFilterSurface } from '../../entries/infrastructure/queries/entry-filter-surface';
import { buildSearchPredicate } from '../../entries/infrastructure/queries/entry-search';
import { DEFAULT_PAGE_SIZE } from '../../entries/entries.constants';
import type { PublicListEntriesQueryDto } from '../http/dto/public-list-entries-query.dto';
import type { PublicEntry, PublicEntryListView } from '../types/public-entry';
import { toPublicEntry } from './public-entry-row';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/**
 * The read side of the public content API. Generic over the content type like
 * the admin's `EntriesService` — the physical table and the sortable columns
 * are derived from `type` per request, so one service serves every code-defined
 * collection and single.
 *
 * It **reuses** the admin's query machinery where the semantics are identical —
 * the same ILIKE search predicate and the same query-builder filter engine, so
 * one query language covers both surfaces — but it is deliberately **not** built
 * on `EntriesService` itself. Several of that service's knobs (`?deleted=only`
 * most obviously) select rows this API must never serve, and reaching through it
 * to subtract them would make the visibility rule an argument about what was
 * *not* passed. Instead the public read states its own WHERE, so "what can a
 * token see?" is answerable by reading one method:
 *
 * - the **workspace** the request resolved to, always;
 * - **published only**, on publishable types — a draft is unfinished work and
 *   never leaves the admin;
 * - **not soft-deleted**, on paranoid types;
 * - the bound `CONTENT_ENTRY_EXTENSION`'s scope, so a localized type reads the
 *   requested locale (and the same rules the admin gets) for free.
 *
 * `?search=` and `?filter=` narrow that set further; neither can widen it, since
 * both are AND-ed onto the predicate above.
 */
@Injectable()
export class PublicEntriesQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        // The entries extension port (e.g. i18n's locale scoping) — absent
        // unless a downstream plugin binds it, hence optional.
        @Optional()
        @Inject(CONTENT_ENTRY_EXTENSION)
        private readonly extension?: ContentEntryExtension
    ) {}

    /**
     * One page of a type's publicly readable entries. Count and page share the
     * WHERE and run concurrently, so the request pays the slower of the two.
     */
    async list(
        type: AnyContentType,
        query: PublicListEntriesQueryDto,
        workspaceId: string,
        grantedTypes: ReadonlySet<string>
    ): Promise<PublicEntryListView> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const where = and(
            this.readableWhere(type, workspaceId, query.locale),
            buildSearchPredicate(type, query.search),
            await this.filterPredicate(
                type,
                query.filter,
                workspaceId,
                grantedTypes
            )
        );

        const [[{ total }], rows] = await Promise.all([
            this.db.select({ total: count() }).from(type.table).where(where),
            this.db
                .select()
                .from(type.table)
                .where(where)
                .orderBy(...this.orderBy(type, query.sort))
                .limit(pageSize)
                .offset((page - 1) * pageSize)
        ]);

        return {
            items: rows.map((row) =>
                toPublicEntry(type, row as Record<string, unknown>)
            ),
            total,
            page,
            pageSize
        };
    }

    /**
     * One publicly readable entry by id. A draft, a soft-deleted row, an entry
     * in another workspace, and an id that never existed are all the same 404 —
     * an unpublished entry must not be distinguishable from a missing one.
     */
    async getOne(
        type: AnyContentType,
        id: string,
        workspaceId: string,
        locale?: string
    ): Promise<PublicEntry> {
        const table = type.table as unknown as ContentTable;
        const [row] = await this.db
            .select()
            .from(type.table)
            .where(
                and(
                    eq(table['id'], id),
                    this.readableWhere(type, workspaceId, locale)
                )
            )
            .limit(1);
        if (!row) {
            throw new NotFoundException(
                `No published "${type.name}" entry with id "${id}".`
            );
        }
        return toPublicEntry(type, row as Record<string, unknown>);
    }

    /**
     * Translate one `?filter=` payload — the same query-builder tree the admin
     * records list takes — against a surface derived from the type.
     *
     * Two departures from the admin's version, both deliberate:
     *
     * - **Grant-pruned.** `grantedTypes` is passed, so a relation whose target
     *   the workspace was never granted is omitted from the surface and a rule
     *   naming it 400s. Without it, `author.name eq "Ada"` would let a token
     *   infer relation data by watching which entries come back — data this API
     *   deliberately does not return. The admin's list leaves this unset on
     *   purpose (there it is a SQL whitelist, not a visibility boundary); here
     *   it is exactly a visibility boundary.
     * - **No `status`.** The read already forces `status = published`, so a
     *   `status` rule could only be a no-op or match nothing. Dropping it from
     *   the schema turns a confusingly empty page into a clear 400.
     *
     * Built lazily — the surface walks the type's whole relation graph to the
     * hop budget, so an unfiltered list (the common case) never pays for it.
     * A malformed filter throws `FilterException`, which is a 400.
     */
    private async filterPredicate(
        type: AnyContentType,
        filter: string | undefined,
        workspaceId: string,
        grantedTypes: ReadonlySet<string>
    ): Promise<SQL | undefined> {
        if (!filter) {
            return undefined;
        }
        const { schema } = buildEntryFilterSurface(type, {
            workspaceId,
            grantedTypes
        });
        if (schema.fields) {
            delete schema.fields['status'];
        }
        const tree = parseFilterTree(filter, schema);
        return applyFilterTree(tree, schema, type.table, this.db);
    }

    /**
     * The predicate every public read shares — the whole visibility rule in one
     * place. `and(undefined, …)` collapses the clauses a type doesn't have, so
     * a plain non-publishable, non-paranoid type reduces to the workspace scope.
     */
    private readableWhere(
        type: AnyContentType,
        workspaceId: string,
        locale: string | undefined
    ): SQL | undefined {
        const table = type.table as unknown as ContentTable;
        return and(
            eq(table['workspaceId'], workspaceId),
            type.publishable
                ? eq(table['status'], ENTRY_STATUS.Published)
                : undefined,
            type.paranoid ? isNull(table['deletedAt']) : undefined,
            // No-op for types the extension doesn't apply to; for an i18n type
            // it scopes to the requested locale (rejecting an unknown one).
            this.extension?.listScope(type, workspaceId, { locale })
        );
    }

    /**
     * Translate `?sort=` (`col` ascending, `-col` descending) into an ORDER BY,
     * always with an `id` tiebreaker so paging is stable across requests.
     * Sortable = the envelope timestamps, `publishedAt` (publishable types),
     * `locale` (i18n types), and the type's **scalar** fields — the same
     * whitelist rule the admin list uses, so a sort key never reaches
     * `asc(undefined)`. Unknown or excluded keys fall back to newest-updated.
     */
    private orderBy(type: AnyContentType, sort: string | undefined): SQL[] {
        const table = type.table as unknown as ContentTable;
        const sortable = new Set<string>([
            'createdAt',
            'updatedAt',
            ...(type.publishable ? ['publishedAt'] : []),
            ...(type.i18n ? ['locale'] : []),
            ...Object.entries(type.fields)
                .filter(([, spec]) => isScalarField(spec))
                .map(([name]) => name)
        ]);
        const isDesc = !!sort && sort.startsWith('-');
        const columnId = sort ? (isDesc ? sort.slice(1) : sort) : '';
        const column = sortable.has(columnId) ? table[columnId] : undefined;
        if (column) {
            return [isDesc ? desc(column) : asc(column), asc(table['id'])];
        }
        return [desc(table['updatedAt']), asc(table['id'])];
    }
}

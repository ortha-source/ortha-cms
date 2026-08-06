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
import {
    CONTENT_ENTRY_EXTENSION,
    type ContentEntryExtension
} from '../../extension/entry-extension';
import { ENTRY_STATUS, type AnyContentType } from '../../types/content-type';
import { isScalarField } from '../../entries/infrastructure/queries/entry-scalar-fields';
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
 * It is deliberately **not** built on `EntriesService`. That service's surface
 * (free-text search, the `?filter=` tree, `?deleted=only`, relation preview) is
 * the admin's, and several of its knobs — `deleted=only` most obviously —
 * select rows this API must never serve. Rather than reach through it and
 * subtract, the public read states its own narrow WHERE, so "what can a token
 * see?" is answerable by reading one method:
 *
 * - the **workspace** the request resolved to, always;
 * - **published only**, on publishable types — a draft is unfinished work and
 *   never leaves the admin;
 * - **not soft-deleted**, on paranoid types;
 * - the bound `CONTENT_ENTRY_EXTENSION`'s scope, so a localized type reads the
 *   requested locale (and the same rules the admin gets) for free.
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
        workspaceId: string
    ): Promise<PublicEntryListView> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const where = this.readableWhere(type, workspaceId, query.locale);

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

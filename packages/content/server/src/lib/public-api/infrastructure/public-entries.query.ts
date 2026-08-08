import {
    BadRequestException,
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
import type { PgColumn, SelectedFields } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { applyFilterTree, parseFilterTree } from '@ortha-cms/utils-server';
import {
    CONTENT_ENTRY_EXTENSION,
    type ContentEntryExtension
} from '../../extension/entry-extension';
import { ENTRY_STATUS, type AnyContentType } from '../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../types/fields';
import { RelationLinkService } from '../../entries/infrastructure/persistence/relation-link.service';
import type { RelationFieldView } from '../../entries/types/entry-list-view';
import type {
    PublicMediaFieldView,
    PublicRelationFieldView
} from '../types/public-expansion';
import { isScalarField } from '../../entries/infrastructure/queries/entry-scalar-fields';
import { buildEntryFilterSurface } from '../../entries/infrastructure/queries/entry-filter-surface';
import { buildSearchPredicate } from '../../entries/infrastructure/queries/entry-search';
import { parseFieldSelection } from './field-selection';
import { PublicExpansionQuery } from './public-expansion.query';
import { DEFAULT_PAGE_SIZE } from '../../entries/entries.constants';
import {
    DEFAULT_EXPANSION_LIMIT,
    PREVIEW,
    type PublicEntryQueryDto,
    type PublicListEntriesQueryDto
} from '../http/dto/public-list-entries-query.dto';
import type { PublicEntry, PublicEntryListView } from '../types/public-entry';
import { toPublicEntry } from './public-entry-row';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/**
 * The same table seen as `PgColumn`s — what drizzle's `.select({...})` requires.
 * Generated tables carry no static column types, so both views are casts; this
 * one is kept separate rather than widening {@link ContentTable}, which the
 * predicate helpers use against the looser `AnyColumn` operators.
 */
type ContentColumns = Record<string, PgColumn>;

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
        private readonly expansion: PublicExpansionQuery,
        private readonly relationLinks: RelationLinkService,
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
        const selected = parseFieldSelection(type, query.fields);
        const relationFields =
            query.relations === PREVIEW
                ? this.expansion.parseRelationFields(
                      type,
                      query.relationFields,
                      grantedTypes
                  )
                : [];
        const mediaFields =
            query.media === PREVIEW
                ? this.expansion.parseMediaFields(type, query.mediaFields)
                : [];
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
        // An expansion reads columns that never appear in `values` — an owning
        // single relation's FK, a media field's ids — so a `?fields=` selection
        // must still carry them or the preview would find nothing to resolve.
        const projection = this.projection(type, selected, [
            ...relationFields,
            ...mediaFields
        ]);
        const rowsQuery = projection
            ? this.db.select(projection).from(type.table)
            : this.db.select().from(type.table);

        const [[{ total }], rows] = await Promise.all([
            this.db.select({ total: count() }).from(type.table).where(where),
            rowsQuery
                .where(where)
                .orderBy(...this.orderBy(type, query.sort))
                .limit(pageSize)
                .offset((page - 1) * pageSize)
        ]);

        const items = rows.map((row) =>
            toPublicEntry(type, row as Record<string, unknown>, selected)
        );
        await this.attachExpansions(
            type,
            items,
            rows as Record<string, unknown>[],
            workspaceId,
            relationFields,
            mediaFields,
            { relation: query.relationLimit, media: query.mediaLimit }
        );
        return { items, total, page, pageSize };
    }

    /**
     * Attach the opt-in relation / media previews to an already-projected page.
     * Both resolvers are batched across the whole page, so this adds a bounded
     * number of queries per requested field and none per row.
     */
    private async attachExpansions(
        type: AnyContentType,
        items: PublicEntry[],
        rows: Record<string, unknown>[],
        workspaceId: string,
        relationFields: string[],
        mediaFields: string[],
        limits: { relation?: number; media?: number }
    ): Promise<void> {
        if (!relationFields.length && !mediaFields.length) {
            return;
        }
        const [relations, media] = await Promise.all([
            this.expansion.relationsForRows(
                type,
                relationFields,
                rows,
                workspaceId,
                limits.relation
            ),
            this.expansion.mediaForRows(
                type,
                mediaFields,
                rows,
                workspaceId,
                limits.media
            )
        ]);
        for (const item of items) {
            // Keys are present-but-empty when the caller asked for a field the
            // entry has no links in, so a consumer can read `relations.author`
            // without testing for the map itself.
            if (relationFields.length) {
                item.relations = relations.get(item.id) ?? {};
                for (const field of relationFields) {
                    item.relations[field] ??= { items: [], total: 0 };
                }
            }
            if (mediaFields.length) {
                item.media = media.get(item.id) ?? {};
                for (const field of mediaFields) {
                    item.media[field] ??= { items: [], total: 0 };
                }
            }
        }
    }

    /**
     * The SELECT list for a `?fields=` selection, or `undefined` to select the
     * whole row. Narrowing this is the point of a sparse fieldset: without it
     * the query still reads (and Postgres still detoasts) a richtext column the
     * caller asked to leave out, and only the serializer saves any bytes.
     *
     * The envelope is always included — `toPublicEntry` reads those columns
     * unconditionally, and they are what make an entry addressable. The WHERE
     * and ORDER BY may reference columns outside this list; SQL allows that, so
     * filtering and sorting stay unrestricted by the selection.
     */
    private projection(
        type: AnyContentType,
        selected: ReadonlySet<string> | undefined,
        alsoNeeded: readonly string[] = []
    ): SelectedFields | undefined {
        if (!selected) {
            return undefined;
        }
        const table = type.table as unknown as ContentColumns;
        const columns: ContentColumns = {
            id: table['id'],
            createdAt: table['createdAt'],
            updatedAt: table['updatedAt']
        };
        if (type.publishable) {
            columns['publishedAt'] = table['publishedAt'];
        }
        if (type.i18n) {
            columns['locale'] = table['locale'];
            columns['localeGroupId'] = table['localeGroupId'];
        }
        for (const name of selected) {
            columns[name] = table[name];
        }
        for (const name of alsoNeeded) {
            // Join-backed relations own no column on this table; skip them
            // rather than putting `undefined` in the SELECT list.
            if (table[name]) columns[name] = table[name];
        }
        return columns;
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
        query: PublicEntryQueryDto,
        grantedTypes: ReadonlySet<string>
    ): Promise<PublicEntry> {
        const table = type.table as unknown as ContentTable;
        const selected = parseFieldSelection(type, query.fields);
        const relationFields =
            query.relations === PREVIEW
                ? this.expansion.parseRelationFields(
                      type,
                      query.relationFields,
                      grantedTypes
                  )
                : [];
        const mediaFields =
            query.media === PREVIEW
                ? this.expansion.parseMediaFields(type, query.mediaFields)
                : [];
        const projection = this.projection(type, selected, [
            ...relationFields,
            ...mediaFields
        ]);
        const rowQuery = projection
            ? this.db.select(projection).from(type.table)
            : this.db.select().from(type.table);
        const [row] = await rowQuery
            .where(
                and(
                    eq(table['id'], id),
                    this.readableWhere(type, workspaceId, query.locale)
                )
            )
            .limit(1);
        if (!row) {
            throw new NotFoundException(
                `No published "${type.name}" entry with id "${id}".`
            );
        }
        const entry = toPublicEntry(
            type,
            row as Record<string, unknown>,
            selected
        );
        // One row is still a "page" as far as the batched resolvers care, so
        // the single read reuses exactly the list's expansion path.
        await this.attachExpansions(
            type,
            [entry],
            [row as Record<string, unknown>],
            workspaceId,
            relationFields,
            mediaFields,
            { relation: query.relationLimit, media: query.mediaLimit }
        );
        return entry;
    }

    /**
     * Every relation field of one entry, first page each — the sibling route
     * for a consumer that wants links without re-reading the entry, and the way
     * past the preview's per-field cap in combination with
     * {@link relationField}. Published-only, like every public read.
     */
    async relationsOf(
        type: AnyContentType,
        id: string,
        workspaceId: string,
        grantedTypes: ReadonlySet<string>,
        locale?: string,
        limit = DEFAULT_EXPANSION_LIMIT
    ): Promise<Record<string, PublicRelationFieldView>> {
        const row = await this.readableRow(type, id, workspaceId, locale);
        const views = await this.relationLinks.readAll(
            type,
            row,
            workspaceId,
            limit,
            { publishedOnly: true }
        );
        // Skip a relation whose target type this workspace can't reach, so the
        // route agrees with what `relationFields` would allow.
        const reachable: Record<string, RelationFieldView> = {};
        for (const [field, view] of Object.entries(views)) {
            const target = type.fields[field]?.relation?.to();
            if (target && grantedTypes.has(target.name))
                reachable[field] = view;
        }
        return this.expansion.hydrateRelationViews(
            type,
            reachable,
            workspaceId
        );
    }

    /** One page of a single relation field's links. */
    async relationField(
        type: AnyContentType,
        id: string,
        field: string,
        page: number,
        pageSize: number,
        workspaceId: string,
        grantedTypes: ReadonlySet<string>,
        locale?: string
    ): Promise<PublicRelationFieldView> {
        const spec = type.fields[field];
        if (
            !spec ||
            spec.type !== CONTENT_FIELD_TYPE.Relation ||
            !spec.relation
        ) {
            throw new BadRequestException(
                `"${field}" is not a relation field on "${type.name}".`
            );
        }
        if (!grantedTypes.has(spec.relation.to().name)) {
            throw new BadRequestException(
                `"${field}" cannot be expanded — this workspace has no access to "${spec.relation.to().name}".`
            );
        }
        const row = await this.readableRow(type, id, workspaceId, locale);
        const view = await this.relationLinks.readField(
            type,
            row,
            field,
            spec,
            page,
            pageSize,
            workspaceId,
            { publishedOnly: true }
        );
        const hydrated = await this.expansion.hydrateRelationViews(
            type,
            { [field]: view },
            workspaceId
        );
        return hydrated[field];
    }

    /** Every media field of one entry, resolved to asset metadata + URLs. */
    async mediaOf(
        type: AnyContentType,
        id: string,
        workspaceId: string,
        locale?: string,
        limit = DEFAULT_EXPANSION_LIMIT
    ): Promise<Record<string, PublicMediaFieldView>> {
        const row = await this.readableRow(type, id, workspaceId, locale);
        const fields = Object.entries(type.fields)
            .filter(([, spec]) => spec.type === CONTENT_FIELD_TYPE.Media)
            .map(([name]) => name);
        const media = await this.expansion.mediaForRows(
            type,
            fields,
            [row],
            workspaceId,
            limit
        );
        const out = media.get(id) ?? {};
        for (const field of fields) out[field] ??= { items: [], total: 0 };
        return out;
    }

    /**
     * The full row of one publicly readable entry, or a 404 — the shared
     * pre-step of the sibling routes, so `/relations` and `/media` are exactly
     * as invisible for a draft or foreign entry as the entry read itself.
     */
    private async readableRow(
        type: AnyContentType,
        id: string,
        workspaceId: string,
        locale?: string
    ): Promise<Record<string, unknown>> {
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
        return row as Record<string, unknown>;
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

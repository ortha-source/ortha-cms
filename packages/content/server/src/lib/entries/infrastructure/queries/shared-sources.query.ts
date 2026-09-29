import { Injectable } from '@nestjs/common';
import {
    and,
    eq,
    inArray,
    isNull,
    ne,
    or,
    type AnyColumn,
    type SQL
} from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@orthacms/database';
import { workspaces } from '@orthacms/workspaces-server';
import { ENTRY_STATUS, type AnyContentType } from '../../../types/content-type';
import type { EntrySource } from '../../types/entry-list-view';
import {
    ownGrantProbe,
    servingSourceIds
} from '../../../content-types/queries/shared-grant.sql';

/** A generated content table seen as a bag of columns by property name. */
type Columns = Record<string, AnyColumn>;

/** A uuid, loosely — anything else can never name a row. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * **Shared workspaces** (ADR-0019) — the one read-side definition of which
 * foreign entries a workspace may see.
 *
 * A workspace flagged `is_shared` exposes its **published, non-deleted**
 * entries of a type to every **other** workspace holding an explicit **shared
 * grant** of that type naming it — `(W, slug, S)` in `workspace_content`
 * ("Explicit per-source grants") — provided the source still holds its own
 * grant for the type. W's own grant of the type is neither needed nor
 * sufficient: it lets W author records, and exposes nothing foreign. The rule
 * in full is `content-types/queries/content-access.ts`; the SQL here and there
 * share `shared-grant.sql.ts`. Exposure is read-only and not transitive: a
 * shared workspace exposes only its own rows, an archived one exposes nothing,
 * and no write path ever consults this class — every mutation keeps its strict
 * `workspace_id = :workspace` predicate.
 *
 * Every read that crosses the boundary goes through here — the admin list's
 * `?source=`, the single-entry read, relation link reads and writes, the
 * public expansion and GraphQL's nested loads — so there is exactly one rule to
 * review and one place it can be wrong. The predicates are SQL sub-selects
 * rather than a pre-fetched id list, so they compose into a synchronous query
 * builder and see the same snapshot as the statement they are part of.
 *
 * Reads the workspaces context's tables directly, as
 * `WorkspaceGrantsQuery` already does — content depends on workspaces-server,
 * never the other way round.
 */
@Injectable()
export class SharedSourcesQuery {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * The rows of `type` that `workspaceId` may read **from other workspaces**:
     * `workspace_id` names a workspace other than the caller's that the caller
     * holds a shared grant of `type` for, which is still shared, active and
     * holding its own grant for `type` — and the row is live: published (on a
     * publishable type) and not soft-deleted (on a paranoid one).
     *
     * `table` defaults to `type.table`; pass an alias when the predicate must
     * bind to an aliased copy of it.
     */
    foreignVisibleWhere(
        type: AnyContentType,
        workspaceId: string,
        table: PgTable = type.table
    ): SQL {
        const cols = table as unknown as Columns;
        return and(
            ne(cols['workspaceId'], workspaceId),
            inArray(
                cols['workspaceId'],
                servingSourceIds(this.db, workspaceId, type.name)
            ),
            type.publishable
                ? eq(cols['status'], ENTRY_STATUS.Published)
                : undefined,
            type.paranoid ? isNull(cols['deletedAt']) : undefined
        ) as SQL;
    }

    /**
     * `workspace_id = :workspace` **or** {@link foreignVisibleWhere} — the
     * workspace half of every read that honours sharing. Adds nothing about the
     * caller's *own* rows (their status and tombstones stay the caller's
     * concern, exactly as before), so swapping this in for a bare workspace
     * equality widens a read by the shared rows and by nothing else.
     */
    visibleWhere(
        type: AnyContentType,
        workspaceId: string,
        table: PgTable = type.table
    ): SQL {
        const cols = table as unknown as Columns;
        return or(
            eq(cols['workspaceId'], workspaceId),
            this.foreignVisibleWhere(type, workspaceId, table)
        ) as SQL;
    }

    /**
     * The own half of a read, per `?source=own`: the caller's rows of `type`,
     * **provided it holds the own grant**. Without one the type is at most
     * shared-only here and `own` is empty (ADR-0019, "Explicit per-source
     * grants"). The grant probe is almost always redundant — a workspace
     * cannot create rows of a type it does not own, nor revoke the own grant
     * while rows remain — but it makes the rule true by construction.
     */
    ownWhere(
        type: AnyContentType,
        workspaceId: string,
        table: PgTable = type.table
    ): SQL {
        const cols = table as unknown as Columns;
        return and(
            eq(cols['workspaceId'], workspaceId),
            ownGrantProbe(this.db, workspaceId, type.name)
        ) as SQL;
    }

    /**
     * `visibleSources(W, slug)` — the workspaces whose `typeSlug` entries
     * `workspaceId` may read: itself when it holds the own grant, plus every
     * source of an available shared grant. Own id first.
     */
    async visibleSources(
        workspaceId: string,
        typeSlug: string
    ): Promise<string[]> {
        const [own, shared] = await Promise.all([
            this.db
                .select({ id: workspaces.id })
                .from(workspaces)
                .where(
                    and(
                        eq(workspaces.id, workspaceId),
                        ownGrantProbe(this.db, workspaceId, typeSlug)
                    )
                ),
            this.sharedSources(workspaceId, typeSlug)
        ]);
        return [
            ...own.map((row) => row.id),
            ...shared.map((source) => source.workspaceId)
        ];
    }

    /**
     * The foreign half of {@link visibleSources}, with display names — empty
     * when `workspaceId` holds no available shared grant of `typeSlug`.
     */
    async sharedSources(
        workspaceId: string,
        typeSlug: string
    ): Promise<EntrySource[]> {
        const rows = await this.db
            .select({ id: workspaces.id, name: workspaces.name })
            .from(workspaces)
            .where(
                inArray(
                    workspaces.id,
                    servingSourceIds(this.db, workspaceId, typeSlug)
                )
            )
            .orderBy(workspaces.name, workspaces.id);
        return rows.map((row) => ({
            workspaceId: row.id,
            workspaceName: row.name
        }));
    }

    /** Display names for a set of workspace ids, keyed by id. */
    async workspaceNames(ids: Iterable<string>): Promise<Map<string, string>> {
        const unique = [...new Set(ids)].filter(Boolean);
        if (!unique.length) return new Map();
        const rows = await this.db
            .select({ id: workspaces.id, name: workspaces.name })
            .from(workspaces)
            .where(inArray(workspaces.id, unique));
        return new Map(rows.map((row) => [row.id, row.name]));
    }

    /**
     * The `source` a row reports to `workspaceId`: `null` for its own rows,
     * `{ workspaceId, workspaceName }` for a row read across the boundary.
     * `names` comes from {@link workspaceNames} over the page's foreign ids.
     */
    sourceOf(
        row: Record<string, unknown>,
        workspaceId: string,
        names: ReadonlyMap<string, string>
    ): EntrySource | null {
        const owner = row['workspaceId'];
        if (typeof owner !== 'string' || owner === workspaceId) return null;
        return { workspaceId: owner, workspaceName: names.get(owner) ?? '' };
    }

    /**
     * {@link sourceOf} for a whole page: resolves the foreign workspaces' names
     * in one query, then maps each row. The returned function is keyed by row.
     */
    async sourcesFor(
        rows: readonly Record<string, unknown>[],
        workspaceId: string
    ): Promise<(row: Record<string, unknown>) => EntrySource | null> {
        const foreign = rows
            .map((row) => row['workspaceId'])
            .filter(
                (id): id is string =>
                    typeof id === 'string' && id !== workspaceId
            );
        const names = await this.workspaceNames(foreign);
        return (row) => this.sourceOf(row, workspaceId, names);
    }

    /**
     * Which of `keys` name a row of `type` that `workspaceId` may read **from
     * another workspace** — the {@link foreignVisibleWhere} rule, keyed by
     * entry id or (`by: 'localeGroupId'`) translation-group id — mapped to the
     * row's {@link EntrySource}.
     *
     * The agent tools' reason to exist: a write on such a key is still refused
     * (every write keeps the strict own-workspace predicate), but the caller
     * could already see the record, so it can be told *why* instead of reading
     * a bare not-found. A key that is not visible — unknown, a draft, deleted,
     * ungranted, in an unshared or archived workspace — is simply absent, so
     * the answer never widens what the caller could learn by reading.
     *
     * `where` ANDs extra read restrictions on (the public API's reader scopes),
     * so a record hidden from a reader is not described to them either. Keys
     * that are not uuid-shaped are dropped before the query — they could only
     * ever be a Postgres cast error.
     */
    async foreignVisibleRows(
        type: AnyContentType,
        keys: readonly string[],
        workspaceId: string,
        options: {
            by?: 'id' | 'localeGroupId';
            where?: readonly (SQL | undefined)[];
        } = {}
    ): Promise<Map<string, EntrySource>> {
        const by = options.by ?? 'id';
        const wanted = [...new Set(keys)].filter((key) => UUID_RE.test(key));
        if (!wanted.length || (by === 'localeGroupId' && !type.i18n)) {
            return new Map();
        }
        const cols = type.table as unknown as Columns;
        const rows = (await this.db
            .select({
                key: cols[by] as PgColumn,
                workspaceId: cols['workspaceId'] as PgColumn
            })
            .from(type.table)
            .where(
                and(
                    inArray(cols[by], wanted),
                    this.foreignVisibleWhere(type, workspaceId),
                    ...(options.where ?? [])
                )
            )) as { key: string; workspaceId: string }[];
        const names = await this.workspaceNames(
            rows.map((row) => row.workspaceId)
        );
        return new Map(
            rows.map((row) => [
                row.key,
                {
                    workspaceId: row.workspaceId,
                    workspaceName: names.get(row.workspaceId) ?? ''
                }
            ])
        );
    }
}

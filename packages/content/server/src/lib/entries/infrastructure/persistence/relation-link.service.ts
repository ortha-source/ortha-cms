import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
    and,
    asc,
    count,
    eq,
    getTableName,
    inArray,
    isNull,
    max,
    notInArray,
    sql,
    type AnyColumn
} from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type { AnyContentType, EntryStatus } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../../../types/fields';
import type {
    RelationDelta,
    RelationFieldView,
    RelationRef
} from '../../types/entry-list-view';
import { entrySlug, entryTitle } from './entry-row';

/** A generated content/join table seen as a bag of columns by property name. */
type Columns = Record<string, AnyColumn>;

/**
 * The same bag typed as `PgColumn` rather than `AnyColumn` — needed where a
 * column is fed to Drizzle's *select* builder (as the window previews do), whose
 * `SelectedFieldsFlat` accepts `PgColumn` but not the broader `AnyColumn`.
 */
type SelectableColumns = Record<string, PgColumn>;

/** A generated content row seen as a bag of values by property name. */
type Row = Record<string, unknown>;

/** Default links per page when the caller doesn't specify one. */
export const RELATION_PAGE_SIZE = 20;

/**
 * How many relation fields a page preview resolves at once. `relationFields` is
 * bounded in bytes but not in count, so a type with many relation columns could
 * otherwise fan out one concurrent query per field — and each field takes a
 * connection twice (its window query, then `refsFor`). The pool is small and
 * app-wide, so cap the fan-out and let the remainder queue in-process rather
 * than in the pool, where it would block unrelated requests.
 */
const PREVIEW_FIELD_CONCURRENCY = 3;

/**
 * A private advisory-lock class (the first `pg_advisory_xact_lock` key)
 * namespacing the per-source append locks, so their hashed `<table>:<sourceId>`
 * keys can't collide with any other advisory lock the app takes (e.g. identity's
 * per-workspace lock). Arbitrary but fixed.
 */
const RELATION_APPEND_LOCK_CLASS = 0x524c; // 'RL'

/**
 * The transaction handle Drizzle hands the `db.transaction(tx => …)` callback —
 * derived from {@link Database} so link writes share the exact query surface of
 * the client without hard-coding the dialect's transaction type.
 */
export type DbTransaction = Parameters<
    Parameters<Database['transaction']>[0]
>[0];

/**
 * Where a join-backed relation field's links physically live, normalized so the
 * read and write paths treat every one the same. `table` is the join table;
 * `ownCol` holds the editing record's id, `refCol` the linked target's — swapped
 * for an inverse of a many-to-many, which reuses the owning side's join table.
 */
interface JoinPlan {
    table: PgTable;
    /** Property name of the column holding the editing record's id. */
    ownCol: 'sourceId' | 'targetId';
    /** Property name of the column holding the linked target's id. */
    refCol: 'sourceId' | 'targetId';
    /** The content type the linked ids belong to. */
    target: AnyContentType;
}

/** Where an inverse-of-single (one-to-many) field reads from: the owner table. */
interface InversePlan {
    table: PgTable;
    /** The owning FK column (property name) pointing back at the editing record. */
    fkCol: string;
    target: AnyContentType;
}

/**
 * Reads and writes the relation **links** an entry owns beyond its own columns:
 * many-to-many join rows and the inverse (back-reference) side of a two-way
 * relation. Owning **single** relations are plain `<field>_id` FK columns —
 * written by `toColumns`, read off the row — so they need no join plumbing.
 *
 * Everything is **paginated**: a relation can hold thousands of links, so reads
 * return one ordered page + a `total` (never every id), and writes apply an
 * incremental {@link RelationDelta} (link / unlink / reorder) inside a
 * transaction — so a huge relation never has to be sent or held in full.
 * Order is persisted in the join table's `position` column, owned by the
 * **source** side; the inverse reads by it (stable) but can't reorder it.
 */
@Injectable()
export class RelationLinkService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    // ---- reads -------------------------------------------------------------

    /**
     * First page (+ total) of **every** relation field of `type` for one entry,
     * keyed by field name — what the editor loads on open. Each field is read
     * independently (paginated), so a relation with many links contributes only
     * its first page, not every id.
     */
    async readAll(
        type: AnyContentType,
        row: Row,
        workspaceId: string,
        pageSize = RELATION_PAGE_SIZE
    ): Promise<Record<string, RelationFieldView>> {
        // Each relation field is an independent read, so fan them out
        // concurrently rather than awaiting one before starting the next — a
        // type with several relations pays one field's latency, not their sum.
        const fields = Object.entries(type.fields).filter(
            ([, spec]) =>
                spec.type === CONTENT_FIELD_TYPE.Relation && spec.relation
        );
        const views = await Promise.all(
            fields.map(([name, spec]) =>
                this.readField(type, row, name, spec, 1, pageSize, workspaceId)
            )
        );
        const out: Record<string, RelationFieldView> = {};
        fields.forEach(([name], i) => {
            out[name] = views[i];
        });
        return out;
    }

    /**
     * A capped relation preview for a whole **page** of entries — what the
     * records table's relation columns render. Returns, per entry id, a
     * `{ items, total }` view for each requested field.
     *
     * The batching is the point: this issues a constant number of queries **per
     * relation field**, spanning every row on the page (`inArray(ownCol, ids)`),
     * never one query per row. Contrast {@link readAll}, which is scoped to a
     * single entry (`eq(ownCol, row.id)`) because the editor opens one record —
     * calling it in a loop over a page would be a textbook N+1 (a 50-row page
     * with two relation columns would cost 300 queries; this costs a handful).
     *
     * Each field contributes at most `pageSize` refs plus its true `total`, so a
     * record holding thousands of links reads exactly one page here — the
     * dropdown pages through the rest via {@link readField}. Only `fields` are
     * resolved (the table's visible columns), so a hidden relation column costs
     * nothing.
     */
    async previewForEntries(
        type: AnyContentType,
        fields: string[],
        rows: Row[],
        workspaceId: string,
        pageSize = RELATION_PAGE_SIZE
    ): Promise<Map<string, Record<string, RelationFieldView>>> {
        const out = new Map<string, Record<string, RelationFieldView>>();
        const sourceIds = rows
            .map((row) => row['id'])
            .filter((id): id is string => typeof id === 'string' && !!id);
        const specs = fields
            .map((name) => [name, type.fields[name]] as const)
            .filter(
                (entry): entry is readonly [string, AnyFieldSpec] =>
                    entry[1]?.type === CONTENT_FIELD_TYPE.Relation &&
                    !!entry[1].relation
            );
        if (!sourceIds.length || !specs.length) return out;
        for (const id of sourceIds) out.set(id, {});

        // Each relation field is an independent read, so fan them out
        // concurrently rather than awaiting one before starting the next — a
        // table with several relation columns pays one field's latency, not
        // their sum (the same reasoning as `readAll`).
        //
        // Bounded, though: the pool is small and shared app-wide, and each
        // field holds a connection for its window query and then another for
        // `refsFor`. A type with many relation columns would otherwise let a
        // couple of list requests occupy every connection, queueing unrelated
        // traffic behind a records table's previews.
        const views: Map<string, RelationFieldView>[] = [];
        for (let i = 0; i < specs.length; i += PREVIEW_FIELD_CONCURRENCY) {
            const batch = specs.slice(i, i + PREVIEW_FIELD_CONCURRENCY);
            views.push(
                ...(await Promise.all(
                    batch.map(([name, spec]) =>
                        this.previewField(
                            type,
                            name,
                            spec,
                            rows,
                            sourceIds,
                            workspaceId,
                            pageSize
                        )
                    )
                ))
            );
        }
        specs.forEach(([name], index) => {
            for (const [sourceId, view] of views[index]) {
                const bucket = out.get(sourceId);
                if (bucket) bucket[name] = view;
            }
        });
        return out;
    }

    /**
     * Preview one relation field across the page, dispatched by storage form —
     * the same three shapes {@link readField} handles: an owning single relation
     * (FK on the row), a join-backed relation (owning many-to-many or the
     * inverse of one), and an inverse-of-single (the owner's FK points back).
     */
    private previewField(
        type: AnyContentType,
        field: string,
        spec: AnyFieldSpec,
        rows: Row[],
        sourceIds: string[],
        workspaceId: string,
        pageSize: number
    ): Promise<Map<string, RelationFieldView>> {
        const relation = spec.relation;
        if (!relation) return Promise.resolve(new Map());
        if (!relation.many && !relation.inverse)
            return this.previewSingle(relation.to(), field, rows, workspaceId);

        const join = this.joinPlanFor(type, field, spec);
        if (join)
            return this.previewJoin(join, sourceIds, workspaceId, pageSize);

        const inverse = this.inversePlanFor(spec);
        if (inverse)
            return this.previewInverse(
                inverse,
                sourceIds,
                workspaceId,
                pageSize
            );
        return Promise.resolve(new Map());
    }

    /**
     * Owning **single** relations: the FK already rides each page row, so this
     * is one batched {@link refsFor} for every row's target at once — which also
     * de-duplicates, so 50 posts sharing one author resolve that title once
     * instead of 50 times.
     */
    private async previewSingle(
        target: AnyContentType,
        field: string,
        rows: Row[],
        workspaceId: string
    ): Promise<Map<string, RelationFieldView>> {
        const fkBySource = new Map<string, string>();
        for (const row of rows) {
            const fk = row[field];
            const id = row['id'];
            if (typeof fk === 'string' && fk && typeof id === 'string')
                fkBySource.set(id, fk);
        }
        const out = new Map<string, RelationFieldView>();
        if (!fkBySource.size) return out;

        const refs = await this.refsFor(
            target,
            [...fkBySource.values()],
            workspaceId
        );
        const refById = new Map(refs.map((ref) => [ref.id, ref]));
        for (const [sourceId, fk] of fkBySource) {
            // `refsFor` is total — it yields a ref for every id, id-only and
            // flagged `missing` when the target is gone. So the link is always
            // represented (`total` counts the link, not whether its target
            // resolved, exactly as `readField` reports it), and it is the flag,
            // not an absent item, that tells the UI the target is unavailable.
            const ref: RelationRef = refById.get(fk) ?? {
                id: fk,
                title: fk,
                missing: true
            };
            out.set(sourceId, { items: [ref], total: 1 });
        }
        return out;
    }

    /**
     * Join-backed relations (owning many-to-many, or the inverse of one), ranked
     * in a single windowed pass: `row_number()` applies the per-source page cap
     * and `count(*)` the true total, both partitioned by the owning id. That is
     * what keeps a 600-link record to `pageSize` rows read instead of 600.
     */
    private async previewJoin(
        join: JoinPlan,
        sourceIds: string[],
        workspaceId: string,
        pageSize: number
    ): Promise<Map<string, RelationFieldView>> {
        const cols = join.table as unknown as SelectableColumns;
        const own = cols[join.ownCol];
        const ref = cols[join.refCol];
        const position = cols['position'];

        const ranked = this.db
            .select({
                own,
                ref,
                rn: sql<number>`row_number() over (partition by ${own} order by ${position} asc, ${ref} asc)`.as(
                    'rn'
                ),
                total: sql<number>`count(*) over (partition by ${own})`.as(
                    'total'
                )
            })
            .from(join.table)
            .where(inArray(own, sourceIds))
            .as('ranked');

        // The window aliases (`rn`/`own`) carry no column type through the
        // subquery, so compare and order them as raw fragments rather than via
        // `lte`/`asc`, whose overloads can't resolve an untyped alias.
        const rows = (await this.db
            .select()
            .from(ranked)
            .where(sql`${ranked.rn} <= ${pageSize}`)
            .orderBy(sql`${ranked.own} asc, ${ranked.rn} asc`)) as Row[];

        return this.groupPreview(
            rows,
            'ref',
            await this.refsFor(
                join.target,
                rows.map((row) => row['ref'] as string),
                workspaceId
            )
        );
    }

    /**
     * Inverse-of-single (one-to-many): the links are the owner rows whose FK
     * points back at each page row. Windowed the same way, and scoped to the
     * workspace with the soft-delete guard the inverse read side already applies.
     */
    private async previewInverse(
        inverse: InversePlan,
        sourceIds: string[],
        workspaceId: string,
        pageSize: number
    ): Promise<Map<string, RelationFieldView>> {
        const cols = inverse.table as unknown as SelectableColumns;
        const fk = cols[inverse.fkCol];
        const ranked = this.db
            .select({
                own: fk,
                ref: cols['id'],
                rn: sql<number>`row_number() over (partition by ${fk} order by ${cols['createdAt']} asc, ${cols['id']} asc)`.as(
                    'rn'
                ),
                total: sql<number>`count(*) over (partition by ${fk})`.as(
                    'total'
                )
            })
            .from(inverse.table)
            .where(
                and(
                    inArray(fk, sourceIds),
                    eq(cols['workspaceId'], workspaceId),
                    cols['deletedAt'] ? isNull(cols['deletedAt']) : undefined
                )
            )
            .as('ranked');

        const rows = (await this.db
            .select()
            .from(ranked)
            .where(sql`${ranked.rn} <= ${pageSize}`)
            .orderBy(sql`${ranked.own} asc, ${ranked.rn} asc`)) as Row[];

        return this.groupPreview(
            rows,
            'ref',
            await this.refsFor(
                inverse.target,
                rows.map((row) => row['ref'] as string),
                workspaceId
            )
        );
    }

    /**
     * Fold ranked window rows (already ordered by owner, then rank) into one
     * `{ items, total }` view per owning id, resolving each link through the
     * batched `refs`. Shared by the join-backed and inverse previews.
     */
    private groupPreview(
        rows: Row[],
        refKey: string,
        refs: RelationRef[]
    ): Map<string, RelationFieldView> {
        const refById = new Map(refs.map((ref) => [ref.id, ref]));
        const out = new Map<string, RelationFieldView>();
        for (const row of rows) {
            const sourceId = row['own'] as string;
            let view = out.get(sourceId);
            if (!view) {
                view = { items: [], total: Number(row['total']) };
                out.set(sourceId, view);
            }
            // `refsFor` resolved every ranked id, so there is always a ref —
            // id-only and flagged `missing` where the target is soft-deleted or
            // out of workspace. Skipping it here would make `items` shorter
            // than `total` and leave the cell showing a phantom `+N`.
            const id = row[refKey] as string;
            view.items.push(
                refById.get(id) ?? { id, title: id, missing: true }
            );
        }
        return out;
    }

    /**
     * One page of a single relation field's links, ordered by `position`
     * (owning) and resolved to display-ready refs (id + title). `row` is the
     * editing entry (its FK columns back a single relation); pass it to avoid a
     * re-read. Returns `{ items, total }`.
     */
    async readField(
        type: AnyContentType,
        row: Row,
        field: string,
        spec: AnyFieldSpec,
        page: number,
        pageSize: number,
        workspaceId: string
    ): Promise<RelationFieldView> {
        if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation)
            return { items: [], total: 0 };
        const offset = (page - 1) * pageSize;

        // Owning single relation: the id is the row's FK value (0 or 1 link).
        if (!spec.relation.many && !spec.relation.inverse) {
            const fk = row[field];
            const ids = typeof fk === 'string' && fk ? [fk] : [];
            const items =
                page === 1
                    ? await this.refsFor(spec.relation.to(), ids, workspaceId)
                    : [];
            return { items, total: ids.length };
        }

        const join = this.joinPlanFor(type, field, spec);
        if (join) {
            const cols = join.table as unknown as Columns;
            const [rows, [{ total }]] = await Promise.all([
                this.db
                    .select()
                    .from(join.table)
                    .where(eq(cols[join.ownCol], row['id']))
                    .orderBy(asc(cols['position']), asc(cols[join.refCol]))
                    .limit(pageSize)
                    .offset(offset),
                this.db
                    .select({ total: count() })
                    .from(join.table)
                    .where(eq(cols[join.ownCol], row['id']))
            ]);
            const ids = (rows as Row[]).map((r) => r[join.refCol] as string);
            return {
                items: await this.refsFor(join.target, ids, workspaceId),
                total: Number(total)
            };
        }

        const inverse = this.inversePlanFor(spec);
        if (inverse) {
            const cols = inverse.table as unknown as Columns;
            const where = and(
                eq(cols[inverse.fkCol], row['id']),
                eq(cols['workspaceId'], workspaceId),
                cols['deletedAt'] ? isNull(cols['deletedAt']) : undefined
            );
            const [rows, [{ total }]] = await Promise.all([
                this.db
                    .select()
                    .from(inverse.table)
                    .where(where)
                    .orderBy(asc(cols['createdAt']), asc(cols['id']))
                    .limit(pageSize)
                    .offset(offset),
                this.db
                    .select({ total: count() })
                    .from(inverse.table)
                    .where(where)
            ]);
            return {
                items: (rows as Row[]).map((r) =>
                    this.rowToRef(inverse.target, r)
                ),
                total: Number(total)
            };
        }
        return { items: [], total: 0 };
    }

    // ---- writes ------------------------------------------------------------

    /**
     * Apply an incremental {@link RelationDelta} to one many/inverse relation
     * field inside `tx`: validate the linked targets are in the workspace, unlink
     * the removed pairs, append the new ones (`position = max+1` for the source,
     * `ON CONFLICT DO NOTHING`), then renumber to `order` (owning side only).
     * A single relation or an inverse-of-single owns no delta-writable link, so
     * it's a no-op. Returns nothing — read the field back for the new state.
     */
    async applyDelta(
        tx: DbTransaction,
        type: AnyContentType,
        sourceId: string,
        field: string,
        delta: RelationDelta,
        workspaceId: string
    ): Promise<void> {
        const spec = type.fields[field];
        const join = spec ? this.joinPlanFor(type, field, spec) : null;
        if (!join) return; // single / inverse-of-single: nothing to write here

        await this.assertTargets(
            tx,
            join.target,
            delta.link ?? [],
            workspaceId,
            field
        );
        const cols = join.table as unknown as Columns;
        const own = cols[join.ownCol];
        const ref = cols[join.refCol];

        if (delta.unlink?.length) {
            await tx
                .delete(join.table)
                .where(and(eq(own, sourceId), inArray(ref, delta.unlink)));
        }

        // Append each new link at the end of its **source's** ordered list.
        const links = dedupe(delta.link);
        if (links.length && join.ownCol === 'sourceId') {
            // Owning relation: every new link shares this entry as its source, so
            // read the append base once and insert them all in a single
            // statement (position = base + index) instead of a SELECT+INSERT per
            // link inside the locked transaction. Take the source's append lock
            // first so a concurrent writer to the same list can't read the same
            // `max(position)` and produce a duplicate position (the inverse side
            // and a whole-set write both target this same physical list).
            await this.lockSource(tx, join.table, sourceId);
            const base = await this.nextPosition(tx, join.table, sourceId);
            await tx
                .insert(join.table)
                .values(
                    links.map(
                        (targetId, i) =>
                            ({
                                [join.ownCol]: sourceId,
                                [join.refCol]: targetId,
                                position: base + i
                            }) as never
                    )
                )
                .onConflictDoNothing();
        } else if (links.length) {
            // Inverse relation: each link appends to a **different** owner row's
            // list (its physical source is the linked owner, not this entry), so
            // each needs its own append base — and its own append lock. Lock (and
            // append) in a stable sorted order so two transactions touching an
            // overlapping owner set can't deadlock by taking the locks in
            // opposite orders.
            for (const targetId of [...links].sort()) {
                await this.lockSource(tx, join.table, targetId);
                const position = await this.nextPosition(
                    tx,
                    join.table,
                    targetId
                );
                await tx
                    .insert(join.table)
                    .values({
                        [join.ownCol]: sourceId,
                        [join.refCol]: targetId,
                        position
                    } as never)
                    .onConflictDoNothing();
            }
        }

        // Reorder is the owning side's prerogative (its `source_id` axis); the
        // inverse reuses the same rows and can't renumber them without corrupting
        // the owner's order, so `order` is ignored there. One `CASE` update
        // renumbers every listed target instead of a statement per id.
        if (delta.order?.length && join.ownCol === 'sourceId') {
            // Renumber the whole list in one UPDATE — position = its index in
            // `order`, via a CASE keyed on the ref id — instead of an UPDATE per
            // id inside the locked transaction. The WHERE bounds it to this
            // source's rows named in `order`; the `else` keeps any unmatched row
            // untouched.
            const order = delta.order;
            const cases = order.map(
                (targetId, i) => sql`when ${ref} = ${targetId} then ${i}`
            );
            await tx
                .update(join.table)
                .set({
                    position: sql`case ${sql.join(cases, sql` `)} else ${cols['position']} end`
                } as never)
                .where(and(eq(own, sourceId), inArray(ref, order)));
        }
    }

    /**
     * Replace a many-relation's links with exactly `values[field]` (array),
     * position = array index — the **whole-set** write used only when a caller
     * genuinely submits a relation **array** in the entry body (legacy / bulk).
     * The editor uses {@link applyDelta} instead. Runs inside the entry's
     * transaction. **Only an array counts**: a field that's absent or `null`
     * (`coerceValues` stamps `null` onto every unset field) is left untouched, so
     * a save that manages a relation purely through deltas can never have its
     * links cleared here.
     */
    async writeLinks(
        tx: DbTransaction,
        type: AnyContentType,
        sourceId: string,
        values: Record<string, unknown>,
        workspaceId: string
    ): Promise<void> {
        for (const [name, spec] of Object.entries(type.fields)) {
            // Only a genuinely submitted **array** is a whole-set write. Anything
            // else — key absent, or `null` (which `coerceValues` stamps onto
            // every unset field) — means "not managing this relation via the
            // whole-set path"; skip it so the incremental delta path owns it and
            // a null can't be read as "clear all links".
            if (!Array.isArray(values[name])) continue;
            const join = this.joinPlanFor(type, name, spec);
            if (!join || join.ownCol !== 'sourceId') continue; // owning many only
            const ids = dedupe(values[name] as unknown[]);
            await this.assertTargets(tx, join.target, ids, workspaceId, name);
            const cols = join.table as unknown as Columns;
            const own = cols[join.ownCol];
            const ref = cols[join.refCol];
            await tx
                .delete(join.table)
                .where(
                    ids.length
                        ? and(eq(own, sourceId), notInArray(ref, ids))
                        : eq(own, sourceId)
                );
            if (ids.length) {
                await tx
                    .insert(join.table)
                    .values(
                        ids.map(
                            (id, i) =>
                                ({
                                    [join.ownCol]: sourceId,
                                    [join.refCol]: id,
                                    position: i
                                }) as never
                        )
                    )
                    .onConflictDoNothing();
            }
        }
    }

    /**
     * Count the links of one join-backed relation field for an entry — the
     * `total` a read would report, without fetching or resolving any page. Runs
     * on the passed executor (the write transaction when validating a just-saved
     * entry, so it sees the delta's uncommitted rows). Returns 0 for a relation
     * that owns no writable links from this side (single FK / inverse-of-single).
     */
    async countLinks(
        exec: Database | DbTransaction,
        type: AnyContentType,
        row: Row,
        field: string,
        spec: AnyFieldSpec,
        workspaceId: string
    ): Promise<number> {
        const join = this.joinPlanFor(type, field, spec);
        if (join) {
            const cols = join.table as unknown as Columns;
            const [{ total }] = await exec
                .select({ total: count() })
                .from(join.table)
                .where(eq(cols[join.ownCol], row['id']));
            return Number(total);
        }
        const inverse = this.inversePlanFor(spec);
        if (inverse) {
            const cols = inverse.table as unknown as Columns;
            const [{ total }] = await exec
                .select({ total: count() })
                .from(inverse.table)
                .where(
                    and(
                        eq(cols[inverse.fkCol], row['id']),
                        eq(cols['workspaceId'], workspaceId),
                        cols['deletedAt']
                            ? isNull(cols['deletedAt'])
                            : undefined
                    )
                );
            return Number(total);
        }
        return 0;
    }

    // ---- helpers -----------------------------------------------------------

    /**
     * Take the transaction-scoped advisory lock for one physical source list
     * (`<join table>:<sourceId>`), serializing every appender to that list so no
     * two concurrent writes read the same `max(position)`. Auto-releases at
     * commit/rollback. Keyed on the table name too, so distinct join tables that
     * happen to share a source id don't falsely contend.
     */
    private async lockSource(
        tx: DbTransaction,
        table: PgTable,
        sourceId: string
    ): Promise<void> {
        const key = `${getTableName(table)}:${sourceId}`;
        await tx.execute(
            sql`select pg_advisory_xact_lock(${RELATION_APPEND_LOCK_CLASS}, hashtext(${key}))`
        );
    }

    /** Next append position for a source: `max(position) + 1`, else 0. */
    private async nextPosition(
        tx: DbTransaction,
        table: PgTable,
        sourceId: string
    ): Promise<number> {
        const cols = table as unknown as Columns;
        const [row] = await tx
            .select({ max: max(cols['position']) })
            .from(table)
            .where(eq(cols['sourceId'], sourceId));
        const current = row?.max;
        return current == null ? 0 : Number(current) + 1;
    }

    /**
     * Resolve `ids` (in order) to display-ready refs via one lookup on the target
     * type, scoped to the workspace. Ids with no **live** row drop to an id-only
     * ref — a soft-deleted (paranoid) target is excluded here just as it is on
     * the inverse read side, so a trashed record never surfaces its title on the
     * owning side while it's hidden on the other.
     */
    private async refsFor(
        target: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<RelationRef[]> {
        if (!ids.length) return [];
        const cols = target.table as unknown as Columns;
        const rows = (await this.db
            .select()
            .from(target.table)
            .where(
                and(
                    inArray(cols['id'], [...new Set(ids)]),
                    eq(cols['workspaceId'], workspaceId),
                    cols['deletedAt'] ? isNull(cols['deletedAt']) : undefined
                )
            )) as Row[];
        const byId = new Map(
            rows.map((row) => [row['id'] as string, this.rowToRef(target, row)])
        );
        // A ref is produced for *every* id, so a link is never silently
        // dropped — `total` and `items` stay consistent. An id with no live row
        // is flagged `missing` rather than passed off as a titled record: its
        // `title` is only the raw id standing in, which the UI must not print.
        return ids.map(
            (id) => byId.get(id) ?? { id, title: id, missing: true as const }
        );
    }

    /** Build a display ref from a full target row. */
    private rowToRef(target: AnyContentType, row: Row): RelationRef {
        const ref: RelationRef = {
            id: row['id'] as string,
            title: entryTitle(target, row)
        };
        const slug = entrySlug(target, row);
        if (slug) ref.slug = slug;
        if (target.publishable) ref.status = row['status'] as EntryStatus;
        return ref;
    }

    /**
     * Verify every id to be linked exists **in the same workspace** (the join FK
     * has no workspace constraint of its own). A missing or cross-workspace id is
     * a uniform 422 — indistinguishable from an invalid id, so no enumeration
     * signal.
     */
    private async assertTargets(
        tx: DbTransaction,
        target: AnyContentType,
        ids: string[],
        workspaceId: string,
        field: string
    ): Promise<void> {
        const unique = [...new Set(ids)].filter((id) => !!id);
        if (!unique.length) return;
        const cols = target.table as unknown as Columns;
        // Read on the write transaction's own connection (not `this.db`, a
        // separate pooled connection), so the existence check shares the txn's
        // snapshot and the workspace advisory lock the write path holds.
        const rows = (await tx
            .select()
            .from(target.table)
            .where(
                and(
                    inArray(cols['id'], unique),
                    eq(cols['workspaceId'], workspaceId)
                )
            )) as Row[];
        const present = new Set(rows.map((r) => r['id'] as string));
        const missing = unique.filter((id) => !present.has(id));
        if (missing.length) {
            throw new UnprocessableEntityException({
                message: 'Entry validation failed',
                issues: missing.map(() => ({
                    field,
                    message: 'must reference an existing entry'
                }))
            });
        }
    }

    /**
     * The join-table plan for a relation field, or `null` when it owns no join
     * table (an owning single relation, or an inverse-of-single). An owning
     * many-relation uses its own join table (`source→target`); an inverse of a
     * many-to-many reuses the owning side's join table with the roles swapped.
     */
    private joinPlanFor(
        type: AnyContentType,
        field: string,
        spec: AnyFieldSpec
    ): JoinPlan | null {
        if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation)
            return null;
        const relation = spec.relation;
        if (relation.inverse) {
            const owner = relation.to();
            const owningField = owner.fields[relation.inverse.field];
            if (!owningField?.relation?.many) return null; // inverse-of-single
            return {
                table: owner.joinTables[relation.inverse.field],
                ownCol: 'targetId',
                refCol: 'sourceId',
                target: relation.to()
            };
        }
        if (relation.many) {
            return {
                table: type.joinTables[field],
                ownCol: 'sourceId',
                refCol: 'targetId',
                target: relation.to()
            };
        }
        return null;
    }

    /**
     * The inverse-of-single (one-to-many) plan for a relation field, or `null`:
     * it reads the owner rows whose FK points back at the editing record, and
     * owns no writable link from this side.
     */
    private inversePlanFor(spec: AnyFieldSpec): InversePlan | null {
        if (
            spec.type !== CONTENT_FIELD_TYPE.Relation ||
            !spec.relation?.inverse
        )
            return null;
        const owner = spec.relation.to();
        const owningField = owner.fields[spec.relation.inverse.field];
        if (owningField?.relation?.many) return null; // handled as a join plan
        return {
            table: owner.table,
            fkCol: spec.relation.inverse.field,
            target: owner
        };
    }
}

/** De-duplicate a list of ids, preserving order and dropping empties. */
function dedupe(value: unknown[] | undefined): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of value ?? []) {
        if (typeof item === 'string' && item && !seen.has(item)) {
            seen.add(item);
            out.push(item);
        }
    }
    return out;
}

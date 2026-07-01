import { Injectable } from '@nestjs/common';
import {
    and,
    eq,
    inArray,
    isNull,
    notInArray,
    sql,
    type AnyColumn,
    type SQL
} from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type { AnyContentType, EntryStatus } from '../../types/content-type';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../../types/fields';
import type { RelationRef } from '../types/entry-list-view';
import { entryTitle } from './entry-row';

/** A generated content/join table seen as a bag of columns by property name. */
type Columns = Record<string, AnyColumn>;

/** A generated content row seen as a bag of values by property name. */
type Row = Record<string, unknown>;

/**
 * The transaction handle Drizzle hands the `db.transaction(tx => …)` callback —
 * derived from {@link Database} so link writes share the exact query surface of
 * the client without hard-coding the dialect's transaction type.
 */
export type DbTransaction = Parameters<
    Parameters<Database['transaction']>[0]
>[0];

/**
 * Where a relation field's links physically live, normalized so the read and
 * write paths treat every join-backed relation the same. `table` is the join
 * table; `ownCol` holds the editing record's id, `refCol` the linked target's —
 * swapped for an inverse field, which reuses the owning side's join table.
 */
interface JoinPlan {
    field: string;
    table: PgTable;
    ownCol: string;
    refCol: string;
    /** The content type the linked ids belong to (for title resolution). */
    target: AnyContentType;
}

/**
 * Where an inverse-of-single (one-to-many) relation reads from: the owning
 * type's main table, filtered by its FK column. It owns no join table, so its
 * links are the owner rows whose FK points back at the editing record.
 */
interface InverseColumnPlan {
    field: string;
    table: PgTable;
    /** The owning FK column that points back at the editing record. */
    fkCol: string;
    target: AnyContentType;
}

/**
 * Reads and writes the relation **links** an entry owns beyond its own columns:
 * many-to-many join rows and the inverse (back-reference) side of a two-way
 * relation. Owning **single** relations are plain `<field>_id` FK columns —
 * written by `toColumns` and read straight off the row — so they need no join
 * plumbing; this service fills the gap for everything that lives in a join
 * table (or, for an inverse-of-single, on another type's table).
 *
 * Reads resolve **every** relation field to display-ready {@link RelationRef}s
 * (id + title) in a bounded set of queries — one `UNION ALL` over all
 * join/inverse sources, then one lookup per referenced target type. Writes
 * replace a record's links with exactly the submitted ids **inside the caller's
 * transaction**, so the entry row and its links commit or roll back together.
 */
@Injectable()
export class RelationLinkService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * Replace every join-backed relation link for `sourceId` with exactly the
     * ids in `values`, running inside the caller's transaction so links commit
     * atomically with the entry write. Handles owning many-relations and the
     * inverse side of a many-to-many (the same join rows, roles swapped);
     * owning single relations are FK columns (already written by `toColumns`),
     * and an inverse-of-single owns no writable link here, so both are skipped.
     */
    async writeLinks(
        tx: DbTransaction,
        type: AnyContentType,
        sourceId: string,
        values: Record<string, unknown>
    ): Promise<void> {
        for (const [name, spec] of Object.entries(type.fields)) {
            const plan = this.joinPlanFor(type, name, spec);
            if (!plan) continue;
            await this.replaceLinks(tx, plan, sourceId, idsOf(values[name]));
        }
    }

    /**
     * Resolve every relation field of `type` for one `row` to display-ready
     * refs, keyed by field name. Single owning relations come off the row's FK;
     * everything join-backed (many, inverse) is read in **one `UNION ALL`**, and
     * titles are filled with **one lookup per referenced target type** — never a
     * query per link. Scoped to `workspaceId` so a title can't be read across
     * workspaces.
     */
    async readLinks(
        type: AnyContentType,
        row: Row,
        workspaceId: string
    ): Promise<Record<string, RelationRef[]>> {
        const sourceId = row['id'] as string;

        // Field → ordered target ids. Single relations resolve straight off the
        // row; join/inverse relations are gathered by the union query below.
        const idsByField = new Map<string, string[]>();
        const targetByField = new Map<string, AnyContentType>();

        const joinReads: SQL[] = [];
        const inversePlans: InverseColumnPlan[] = [];

        for (const [name, spec] of Object.entries(type.fields)) {
            if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation)
                continue;
            targetByField.set(name, spec.relation.to());
            idsByField.set(name, []);

            const join = this.joinPlanFor(type, name, spec);
            if (join) {
                const cols = join.table as unknown as Columns;
                // One SELECT per join-backed field, unioned into a single read
                // below. `${name}` binds as a parameter (the field label);
                // `${column}` renders the qualified column reference.
                joinReads.push(
                    sql`select ${name} as "field", ${cols[join.refCol]} as "target" from ${join.table} where ${cols[join.ownCol]} = ${sourceId}`
                );
                continue;
            }

            const inverse = this.inversePlanFor(spec);
            if (inverse) {
                inversePlans.push({ ...inverse, field: name });
                continue;
            }

            // Owning single relation: the target id is the row's FK value.
            const fk = row[name];
            if (typeof fk === 'string' && fk) idsByField.get(name)!.push(fk);
        }

        for (const [field, target] of await this.readJoinLinks(
            joinReads,
            inversePlans,
            sourceId,
            workspaceId
        )) {
            idsByField.get(field)?.push(target);
        }

        const titles = await this.resolveTitles(
            idsByField,
            targetByField,
            workspaceId
        );

        const relations: Record<string, RelationRef[]> = {};
        for (const [field, ids] of idsByField) {
            relations[field] = ids.map(
                (id) => titles.get(id) ?? { id, title: id }
            );
        }
        return relations;
    }

    /**
     * Run the combined link read: the join-table `UNION ALL` plus a lookup per
     * inverse-of-single field (a one-to-many read off the owning table's FK).
     * Returns flat `[field, targetId]` pairs. The inverse-of-single reads are
     * workspace-scoped and skip soft-deleted owners.
     */
    private async readJoinLinks(
        joinReads: SQL[],
        inversePlans: InverseColumnPlan[],
        sourceId: string,
        workspaceId: string
    ): Promise<[string, string][]> {
        const pairs: [string, string][] = [];

        if (joinReads.length) {
            // All join/inverse-many reads in one round-trip: `… UNION ALL …`.
            const statement = sql.join(joinReads, sql` union all `);
            const result = (await this.db.execute(statement)) as unknown as {
                rows?: Row[];
            } & Row[];
            for (const r of result.rows ?? result)
                pairs.push([r['field'] as string, r['target'] as string]);
        }

        for (const plan of inversePlans) {
            const cols = plan.table as unknown as Columns;
            const owners = (await this.db
                .select()
                .from(plan.table)
                .where(
                    and(
                        eq(cols[plan.fkCol], sourceId),
                        eq(cols['workspaceId'], workspaceId),
                        cols['deletedAt'] ? isNull(cols['deletedAt']) : undefined
                    )
                )) as Row[];
            for (const owner of owners)
                pairs.push([plan.field, owner['id'] as string]);
        }

        return pairs;
    }

    /**
     * Batch-resolve a title (and status) for every referenced id: group the ids
     * by their target content type and run **one** `SELECT … WHERE id IN (…)`
     * per type, scoped to the workspace. Returns an id → {@link RelationRef} map.
     */
    private async resolveTitles(
        idsByField: Map<string, string[]>,
        targetByField: Map<string, AnyContentType>,
        workspaceId: string
    ): Promise<Map<string, RelationRef>> {
        const idsByTarget = new Map<AnyContentType, Set<string>>();
        for (const [field, ids] of idsByField) {
            if (!ids.length) continue;
            const target = targetByField.get(field)!;
            const set = idsByTarget.get(target) ?? new Set<string>();
            ids.forEach((id) => set.add(id));
            idsByTarget.set(target, set);
        }

        const refs = new Map<string, RelationRef>();
        for (const [target, ids] of idsByTarget) {
            const cols = target.table as unknown as Columns;
            const rows = (await this.db
                .select()
                .from(target.table)
                .where(
                    and(
                        inArray(cols['id'], [...ids]),
                        eq(cols['workspaceId'], workspaceId)
                    )
                )) as Row[];
            for (const row of rows) {
                const ref: RelationRef = {
                    id: row['id'] as string,
                    title: entryTitle(target, row)
                };
                if (target.publishable)
                    ref.status = row['status'] as EntryStatus;
                refs.set(ref.id, ref);
            }
        }
        return refs;
    }

    /**
     * Replace the join-table links for one record: unlink the target ids no
     * longer present, then insert the newcomers idempotently
     * (`ON CONFLICT DO NOTHING`, so re-saving an unchanged set is a no-op rather
     * than a unique-constraint error). An empty `refIds` clears every link.
     */
    private async replaceLinks(
        tx: DbTransaction,
        plan: JoinPlan,
        ownId: string,
        refIds: string[]
    ): Promise<void> {
        const cols = plan.table as unknown as Columns;
        const own = cols[plan.ownCol];
        const ref = cols[plan.refCol];
        await tx
            .delete(plan.table)
            .where(
                refIds.length
                    ? and(eq(own, ownId), notInArray(ref, refIds))
                    : eq(own, ownId)
            );
        if (refIds.length) {
            await tx
                .insert(plan.table)
                .values(
                    refIds.map(
                        (id) =>
                            ({
                                [plan.ownCol]: ownId,
                                [plan.refCol]: id
                            }) as never
                    )
                )
                .onConflictDoNothing();
        }
    }

    /**
     * The join-table plan for a relation field, or `null` when it owns no join
     * table (an owning single relation — a plain FK column — or an
     * inverse-of-single, handled by {@link inversePlanFor}). An owning
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
            // Only an inverse of a many-to-many has a join table to write.
            if (!owningField?.relation?.many) return null;
            return {
                field,
                table: owner.joinTables[relation.inverse.field],
                ownCol: 'targetId',
                refCol: 'sourceId',
                target: relation.to()
            };
        }
        if (relation.many) {
            return {
                field,
                table: type.joinTables[field],
                ownCol: 'sourceId',
                refCol: 'targetId',
                target: relation.to()
            };
        }
        return null;
    }

    /**
     * The inverse-of-single (one-to-many) plan for a relation field, or `null`.
     * Such a field reads the owner rows whose FK column points back at the
     * editing record; it owns no join table and isn't written from this side.
     */
    private inversePlanFor(spec: AnyFieldSpec): Omit<
        InverseColumnPlan,
        'field'
    > | null {
        if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation?.inverse)
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

/**
 * Normalize a submitted relation value to a de-duplicated id array: a
 * many/inverse value is an array, a single value one id string; empties yield
 * `[]`. Order is preserved (a many-relation's order is meaningful).
 */
function idsOf(value: unknown): string[] {
    const raw = Array.isArray(value)
        ? value
        : typeof value === 'string' && value
          ? [value]
          : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
        if (typeof item === 'string' && item && !seen.has(item)) {
            seen.add(item);
            out.push(item);
        }
    }
    return out;
}

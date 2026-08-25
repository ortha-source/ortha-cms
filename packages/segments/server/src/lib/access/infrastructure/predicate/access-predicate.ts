/**
 * Emitting the read predicate — the Drizzle half of the compiler.
 *
 * The shape it produces, for an entry table aliased as the read's own:
 *
 * ```sql
 * COALESCE(
 *     (SELECT bool_or(<row matches the caller>)
 *      FROM entry_access ea
 *      WHERE ea.entry_id = <entries>.id AND ea.workspace_id = $ws),
 *     true
 * )
 * ```
 *
 * `bool_or` over the entry's rows is the OR between condition groups, and the
 * `COALESCE(…, true)` is the "no rows means unrestricted" rule stated once. An
 * aggregate subquery rather than the more obvious `NOT EXISTS(…) OR EXISTS(…)`
 * pair: same answer, one scan of the entry's rows instead of two.
 */

import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { slotColumnNames } from '../schema/entry-access';
import type { AccessPlan, SlotPlan } from './access-plan';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/** A `uuid[]` literal, every id bound as a parameter. */
function uuidArray(ids: readonly string[]): SQL {
    if (!ids.length) {
        return sql`'{}'::uuid[]`;
    }
    return sql`ARRAY[${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `
    )}]::uuid[]`;
}

/**
 * One slot's clause pair.
 *
 * `cardinality(allow) = 0` is the "this group does not constrain this type"
 * case and must come first: a group that names only a plan says nothing about
 * organisations, and requiring an intersection there would refuse every reader.
 */
function slotClause(plan: SlotPlan): SQL {
    const { allow, deny } = slotColumnNames(plan.slot);
    const caller = uuidArray(plan.callerSegmentIds);
    const allowColumn = sql.raw(`ea.${allow}`);
    const denyColumn = sql.raw(`ea.${deny}`);
    return sql`(cardinality(${allowColumn}) = 0 OR ${allowColumn} && ${caller}) AND NOT (${denyColumn} && ${caller})`;
}

/**
 * The predicate for one read, or `undefined` when there is nothing to add.
 *
 * `undefined` is returned only for a `null` plan — no active segment type — so
 * an installation that has not configured segmentation pays a null check and
 * nothing else. A caller with no segments at all still gets a full predicate:
 * they are an anonymous reader, not an unconfigured one, and the difference is
 * the whole point.
 */
export function buildAccessPredicate(input: {
    readonly plan: AccessPlan | null;
    readonly table: ContentTable;
    readonly workspaceId: string;
}): SQL | undefined {
    const { plan, table, workspaceId } = input;
    if (!plan) {
        return undefined;
    }
    const entryId = table['id'];
    if (!entryId) {
        // A content table with no `id` cannot be joined to the projection. The
        // generated tables always have one; refusing here rather than emitting
        // a fragment that silently matches everything keeps a future change to
        // the envelope from opening the door.
        throw new Error(
            'segments: the content table has no `id` column to scope against.'
        );
    }

    const slotClauses = plan.slots.map(slotClause);
    const windowClause = sql`(ea.access_from IS NULL OR ea.access_from <= now()) AND (ea.access_to IS NULL OR ea.access_to > now())`;
    const rowMatches = sql.join(
        [...slotClauses, windowClause].map((clause) => sql`(${clause})`),
        sql` AND `
    );

    return sql`COALESCE((SELECT bool_or(${rowMatches}) FROM entry_access ea WHERE ea.entry_id = ${entryId} AND ea.workspace_id = ${workspaceId}), true)`;
}

/**
 * Planning the read predicate — the pure half of the compiler.
 *
 * Turning a caller and the active segment types into SQL is two jobs, and only
 * one of them needs a database: deciding **which slots participate and with
 * which segment ids** is arithmetic over plain data, while emitting the fragment
 * is Drizzle plumbing. They are split so the first is exhaustively unit-testable
 * — a predicate that silently stops constraining is not the kind of bug to leave
 * to an integration test.
 */

import {
    SEGMENT_TYPE_STATE,
    type SegmentType,
    type SegmentTypeKey
} from '@orthacms/segments-domain';

/** One slot's contribution to the predicate. */
export interface SlotPlan {
    /** The projection slot this type owns. */
    readonly slot: number;
    /** The type's key, for readable test failures and explanations. */
    readonly typeKey: SegmentTypeKey;
    /**
     * The caller's segment ids in this type. **Empty is meaningful**: the
     * allow clause then matches only rows that constrain nothing, and the deny
     * clause cannot fire — which is exactly right for a reader who carries no
     * tag in this namespace.
     */
    readonly callerSegmentIds: readonly string[];
}

/** What the SQL emitter needs, and nothing else. */
export interface AccessPlan {
    /**
     * The participating slots, ordered by slot number so the emitted SQL is
     * stable across requests — a fragment that reorders itself defeats
     * statement caching and makes a query log unreadable.
     */
    readonly slots: readonly SlotPlan[];
}

/** The caller's resolved segments, grouped by segment type key. */
export type CallerSegmentsByType = ReadonlyMap<
    SegmentTypeKey,
    readonly string[]
>;

/**
 * Plan the predicate for one read.
 *
 * Returns `null` when nothing should be emitted at all — no active segment
 * type, so no installation has configured segmentation and the read must cost
 * exactly what it cost before the plugin existed. That is a different answer
 * from "a plan with no slots", which would emit a fragment matching only
 * unrestricted entries.
 *
 * A **draining** type is excluded: it has left the decision, and its slot
 * columns still hold ids that no longer mean anything. Matching against them
 * would let a removed type keep hiding content.
 */
export function planAccessPredicate(
    types: readonly SegmentType[],
    caller: CallerSegmentsByType
): AccessPlan | null {
    const active = types.filter(
        (type) => type.state === SEGMENT_TYPE_STATE.Active
    );
    if (!active.length) {
        return null;
    }
    const slots = active
        .map((type) => ({
            slot: type.slot,
            typeKey: type.key,
            callerSegmentIds: caller.get(type.key) ?? []
        }))
        .sort((left, right) => left.slot - right.slot);
    return { slots };
}

import { OP, type OpId } from '../types/filter-tree.type';

/**
 * Wire-format operator vocabulary the BE `parseFilterTree` accepts. The
 * UI never serialises a bare string — every leaf flows through
 * {@link UI_TO_WIRE} so the FE and the BE can't drift on op spelling.
 */
export const WIRE_OP = {
    Eq: 'eq',
    Ne: 'ne',
    Ilike: 'ilike',
    Nilike: 'nilike',
    In: 'in',
    Nin: 'nin',
    Null: 'null',
    Gt: 'gt',
    Gte: 'gte',
    Lt: 'lt',
    Lte: 'lte',
    /**
     * A window measured from **query time**, carried to the server as
     * `{ n, unit }` instead of a resolved cutoff.
     *
     * Only emitted when the caller asks for it (`treeToJsonFilter`'s
     * `relativeDates` option). A filter destined for a URL still freezes its
     * cutoff — see {@link WIRE_TO_UI} — because a shared link should keep
     * showing the same rows. A filter that is **stored and replayed**, like an
     * alarm rule, needs the opposite, or "not updated in 90 days" quietly
     * becomes "not updated since the day the rule was written".
     */
    WithinLast: 'within_last'
} as const;

/** One of the {@link WIRE_OP} values. */
export type WireOp = (typeof WIRE_OP)[keyof typeof WIRE_OP];

/**
 * UI op → single wire op mapping for ops that round-trip 1:1.
 *
 * `OP.Between` and `OP.WithinLast` are intentionally **not** in this
 * table — they expand to compound shapes (a small `and` group, or a
 * `gte` with a resolved cutoff) and are handled directly by the
 * serialiser.
 */
export const UI_TO_WIRE: Partial<Record<OpId, WireOp>> = {
    [OP.Equals]: WIRE_OP.Eq,
    [OP.NotEquals]: WIRE_OP.Ne,
    [OP.Contains]: WIRE_OP.Ilike,
    [OP.IsOneOf]: WIRE_OP.In,
    [OP.IsEmpty]: WIRE_OP.Null,
    [OP.Gt]: WIRE_OP.Gt,
    [OP.Gte]: WIRE_OP.Gte,
    [OP.Lt]: WIRE_OP.Lt,
    [OP.Lte]: WIRE_OP.Lte
};

/**
 * Inverse of {@link UI_TO_WIRE}. `gte`/`lte` map back to their UI ops.
 * `OP.Between` is reconstructed by `jsonFilterToTree` (it pairs a same-field
 * `gte`+`lte` AND group back into one Between rule).
 *
 * `OP.WithinLast` has **two** wire spellings, and which one a filter carries is
 * a property of where it is going rather than of the rule:
 *
 * - Serialised **for a URL** (the default) it becomes a concrete `gte` cutoff
 *   and is therefore one-way — on reload it rehydrates as an absolute `OP.Gte`
 *   rule, because a single `gte` is indistinguishable from a real one. That is
 *   deliberate: a shared deep link should keep showing the same rows.
 * - Serialised **for storage** (`relativeDates`) it keeps `within_last`, which
 *   round-trips exactly and is resolved by the database on every evaluation.
 */
export const WIRE_TO_UI: Partial<Record<WireOp, OpId>> = {
    [WIRE_OP.Eq]: OP.Equals,
    [WIRE_OP.Ne]: OP.NotEquals,
    [WIRE_OP.Ilike]: OP.Contains,
    [WIRE_OP.Nilike]: OP.NotContains,
    [WIRE_OP.In]: OP.IsOneOf,
    [WIRE_OP.Nin]: OP.NotOneOf,
    // `null` maps to `is_empty` by default; the deserialiser promotes a
    // `value: false` payload to `is_not_empty` (they share this wire op).
    [WIRE_OP.Null]: OP.IsEmpty,
    [WIRE_OP.Gt]: OP.Gt,
    [WIRE_OP.Gte]: OP.Gte,
    [WIRE_OP.Lt]: OP.Lt,
    [WIRE_OP.Lte]: OP.Lte,
    [WIRE_OP.WithinLast]: OP.WithinLast
};

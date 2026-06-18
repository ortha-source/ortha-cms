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
    In: 'in',
    Null: 'null',
    Gt: 'gt',
    Gte: 'gte',
    Lt: 'lt',
    Lte: 'lte'
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
 * `gte`+`lte` AND group back into one Between rule). `OP.WithinLast` is
 * intentionally **one-way**: it serialises to a concrete `gte` cutoff, so on
 * reload it rehydrates as an absolute `OP.Gte` rule (a single `gte` is
 * indistinguishable from a real one) — the relative window is resolved at
 * Apply time, which is the right behaviour for a shareable deep link.
 */
export const WIRE_TO_UI: Partial<Record<WireOp, OpId>> = {
    [WIRE_OP.Eq]: OP.Equals,
    [WIRE_OP.Ne]: OP.NotEquals,
    [WIRE_OP.Ilike]: OP.Contains,
    [WIRE_OP.In]: OP.IsOneOf,
    [WIRE_OP.Null]: OP.IsEmpty,
    [WIRE_OP.Gt]: OP.Gt,
    [WIRE_OP.Gte]: OP.Gte,
    [WIRE_OP.Lt]: OP.Lt,
    [WIRE_OP.Lte]: OP.Lte
};

import { describe, expect, it } from 'vitest';
import { UI_TO_WIRE, WIRE_OP, WIRE_TO_UI } from './wireOp';

/**
 * The two tables in this module are one dictionary read in two directions, and
 * nothing was checking that they agreed.
 *
 * They are both `Partial<Record<…>>`, deliberately — the forward map is
 * genuinely partial, because `OP.Between` and `OP.WithinLast` expand to
 * compound shapes the serialiser handles by hand rather than by lookup. But
 * `Partial` is also what let the *reverse* map lose an entry with the compiler
 * saying nothing: `like` was dropped from {@link WIRE_TO_UI}, and a filter
 * lifted out of a URL came back one clause short. No error, no chip, nothing in
 * "Filters (N)" — and the next Apply re-serialised the tree without it, so the
 * table quietly **widened**. It was restored by hand; this is the check that
 * would have caught it going, and will catch the next one.
 *
 * The reverse map has to be total over `WIRE_OP` because the server accepts
 * every one of those spellings and the list pages send the raw `?filter=`
 * through: an operator the builder cannot read back is one the table is
 * filtered by and the builder above it does not show.
 */
describe('the wire dictionary reads both ways', () => {
    /** Every wire spelling this module declares. */
    const wireOps = Object.values(WIRE_OP);

    it('reads back every operator it declares', () => {
        const unreadable = wireOps.filter(
            (op) => !Object.hasOwn(WIRE_TO_UI, op)
        );
        expect(
            `filters the table with no rule on screen: ${unreadable.join(', ')}`
        ).toBe('filters the table with no rule on screen: ');
    });

    it('reads back nothing it does not declare', () => {
        const stray = Object.keys(WIRE_TO_UI).filter(
            (op) => !(wireOps as string[]).includes(op)
        );
        expect(
            `rehydrated from a spelling nothing sends: ${stray.join(', ')}`
        ).toBe('rehydrated from a spelling nothing sends: ');
    });

    /**
     * The forward map is a subset on purpose, so it gets the weaker claim: not
     * that it is total, but that everything in it is a spelling the server
     * knows. A `UI_TO_WIRE` entry outside `WIRE_OP` would serialise a rule the
     * parser rejects with a 400 the builder cannot explain.
     */
    it('writes only operators it declares', () => {
        const stray = Object.values(UI_TO_WIRE).filter(
            (op) => !(wireOps as string[]).includes(op as string)
        );
        expect(
            `serialised to an operator the server 400s: ${stray.join(', ')}`
        ).toBe('serialised to an operator the server 400s: ');
    });

    /**
     * `like` by name, because it is the one that actually went missing and a
     * generic set comparison reads as a formality until you know that.
     *
     * It maps to `contains` and therefore leaves as `ilike` — a *visible*
     * widening of one operator's case-sensitivity, which is the lossy-but-
     * preferred trade this file already makes for `gte`+`lte` → Between.
     */
    it('still reads `like`, which the builder cannot write', () => {
        expect(Object.values(UI_TO_WIRE)).not.toContain(WIRE_OP.Like);
        expect(WIRE_TO_UI[WIRE_OP.Like]).toBe('contains');
    });
});

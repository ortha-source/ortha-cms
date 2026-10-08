/**
 * A named extension point that plugins contribute items to. Created via
 * {@link createSlot}; the host wires contributions in at boot and a consumer
 * (e.g. the shell toolbar) reads them. Pure data — no React, no plugin coupling.
 */
export type Slot<T> = {
    /** Unique slot identifier. */
    readonly name: string;
    /**
     * Every item registered to this slot, as a **frozen snapshot** — a
     * consumer that sorts, filters in place, or pushes throws instead of
     * rewriting what the next consumer of the same slot sees.
     *
     * The snapshot keeps its identity until the slot's contents change, so it
     * is safe to depend on: `useMemo(…, [slot.getItems()])` recomputes only
     * after a registration or a reset, not on every render.
     */
    getItems(): readonly T[];
    /** Registers items into this slot. Used by the host wiring only. */
    _register(items: T[]): void;
    /**
     * Empties the slot. Used by the host wiring only, immediately before it
     * re-runs the registration loop.
     *
     * A slot's items live as long as the module, while `_register` only ever
     * appends — so anything that runs the host's wiring
     * loop a second time against the same module doubles every contribution.
     * A Vite hot update does exactly that: the dev sidebar filled with
     * duplicates and compounded with each save until a hard reload. Making the
     * loop idempotent needs a way to start from empty, which is this.
     */
    _reset(): void;
};

/** A plugin's contribution of items to a specific {@link Slot}. */
export type SlotContribution<T = unknown> = {
    /** The slot to contribute to. */
    slot: Slot<T>;
    /** Items to add to the slot. */
    items: T[];
};

/**
 * Creates a named slot plugins can contribute to.
 *
 * @example
 * ```typescript
 * const NAVBAR_START_SLOT = createSlot<NavbarItem>('shell.navbar.start');
 * ```
 */
export function createSlot<T>(name: string): Slot<T> {
    // One frozen array, replaced on every write and handed out as-is on every
    // read. Frozen because a slot is read by every plugin that consumes it, so
    // handing out a mutable list would make one consumer's in-place
    // `sort()`/`push()` a change to shared plugin state. Handed out as-is —
    // not as a fresh copy per call — because a copy is a new identity on every
    // render, which made every `useMemo`/effect keyed on a slot's items rerun
    // each time and the "boot-frozen, so stable" reading at the call sites
    // untrue. All three members close over this one binding, so reassigning
    // it is what keeps them in step.
    let items: readonly T[] = Object.freeze([]);
    return {
        name,
        getItems: () => items,
        _register: (newItems: T[]) => {
            items = Object.freeze([...items, ...newItems]);
        },
        _reset: () => {
            items = Object.freeze([]);
        }
    };
}

/**
 * Registers every contribution into its target slot, from empty.
 *
 * The host calls this once at boot with every plugin's contributions. It exists
 * as a function rather than a loop at the call site because being **idempotent**
 * is the load-bearing part, and that is a property of the slot mechanism rather
 * than of the composition root:
 *
 * - A slot's items live as long as its module, and `_register` only ever
 *   appends. Anything that runs the host's boot wiring a second time against
 *   those same closures doubles every contribution.
 * - A Vite hot update does exactly that — it re-executes the entry module
 *   instead of reloading the page. Observed in dev: every nav entry and every
 *   workspace listed twice, compounding with each save until a hard reload,
 *   with the symptom looking like a bug in whatever was being edited.
 *
 * Resetting the targets is therefore a **separate pass**, not something folded
 * into the registration loop: several plugins contribute to the same slot, so
 * clearing per contribution would drop what an earlier plugin in the same run
 * had just registered.
 */
export function wireSlotContributions(
    contributions: readonly SlotContribution[]
): void {
    for (const slot of new Set(
        contributions.map((contribution) => contribution.slot)
    )) {
        slot._reset();
    }
    for (const contribution of contributions) {
        contribution.slot._register(contribution.items);
    }
}

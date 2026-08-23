/**
 * A named extension point that plugins contribute items to. Created via
 * {@link createSlot}; the host wires contributions in at boot and a consumer
 * (e.g. the shell toolbar) reads them. Pure data — no React, no plugin coupling.
 */
export type Slot<T> = {
    /** Unique slot identifier. */
    readonly name: string;
    /**
     * Every item registered to this slot, as a fresh array — a consumer that
     * sorts, filters in place, or pushes cannot rewrite what the next consumer
     * of the same slot sees.
     */
    getItems(): T[];
    /** Registers items into this slot. Used by the host wiring only. */
    _register(items: T[]): void;
    /**
     * Empties the slot. Used by the host wiring only, immediately before it
     * re-runs the registration loop.
     *
     * A slot closes over one array that lives as long as the module, while
     * `_register` is a bare `push` — so anything that runs the host's wiring
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
    const items: T[] = [];
    return {
        name,
        // A copy, not the live array: a slot is read by every plugin that
        // consumes it, so handing out the internal list makes one consumer's
        // in-place `sort()`/`push()` a change to shared plugin state.
        getItems: () => items.slice(),
        _register: (newItems: T[]) => items.push(...newItems),
        // `length = 0`, not a fresh array: `getItems` and `_register` close
        // over this one, so rebinding it here would leave them writing to and
        // reading from an array nobody else can see.
        _reset: () => {
            items.length = 0;
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
 * - A slot closes over one array that lives as long as its module, and
 *   `_register` is a bare `push`. Anything that runs the host's boot wiring a
 *   second time against those same closures doubles every contribution.
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

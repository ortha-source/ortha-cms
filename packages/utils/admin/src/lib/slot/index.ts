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
        _register: (newItems: T[]) => items.push(...newItems)
    };
}

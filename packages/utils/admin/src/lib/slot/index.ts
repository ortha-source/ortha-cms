/**
 * A named extension point that plugins contribute items to. Created via
 * {@link createSlot}; the host wires contributions in at boot and a consumer
 * (e.g. the shell toolbar) reads them. Pure data — no React, no plugin coupling.
 */
export type Slot<T> = {
    /** Unique slot identifier. */
    readonly name: string;
    /** Returns every item registered to this slot. */
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
 * const NAV_ITEM_SLOT = createSlot<NavItem>('shell.navItem');
 * ```
 */
export function createSlot<T>(name: string): Slot<T> {
    const items: T[] = [];
    return {
        name,
        getItems: () => items,
        _register: (newItems: T[]) => items.push(...newItems)
    };
}

/**
 * Sorts items by ascending `order` into a **new** array, leaving the source
 * untouched. Slot contributions are read from a shared, plugin-owned (and
 * frozen) array, so callers must never sort it in place — hence the `slice()`
 * copy before sort.
 */
export function byOrder<T extends { order: number }>(items: readonly T[]): T[] {
    return items.slice().sort((a, b) => a.order - b.order);
}

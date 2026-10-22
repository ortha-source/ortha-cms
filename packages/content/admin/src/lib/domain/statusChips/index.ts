/** How much a status item matters; mirrors the slot's `EntryStatusSeverity`. */
export type StatusSeverity = 'blocking' | 'warning' | 'info';

/** The one severity order used everywhere: blocking → warning → info. */
export const STATUS_SEVERITY_RANK: Record<StatusSeverity, number> = {
    blocking: 0,
    warning: 1,
    info: 2
};

/** The most chips the header's status cluster ever draws. */
export const MAX_STATUS_CHIPS = 2;

/** Items in severity order, keeping the given order inside a severity. */
export function sortStatusItems<T extends { severity: StatusSeverity }>(
    items: readonly T[]
): T[] {
    return items
        .map((item, index) => ({ item, index }))
        .sort(
            (a, b) =>
                STATUS_SEVERITY_RANK[a.item.severity] -
                    STATUS_SEVERITY_RANK[b.item.severity] || a.index - b.index
        )
        .map(({ item }) => item);
}

/**
 * Which status items the header shows as **chips**, and how many it folds
 * behind "+N" (`docs/design/entry-editor.md`, _Status items_):
 *
 * 1. Most severe first.
 * 2. At most two chips. From the third item on, only the top chip shows and
 *    it carries "+N" — the cluster never pushes the actions or wraps.
 * 3. An info item never takes a chip while something blocks publishing.
 *
 * Every item stays in the full list behind the cluster; this only decides
 * what is on the bar.
 */
export function arrangeStatusChips<T extends { severity: StatusSeverity }>(
    items: readonly T[]
): { chips: T[]; more: number } {
    const sorted = sortStatusItems(items);
    const blocked = sorted.some((item) => item.severity === 'blocking');
    const eligible = blocked
        ? sorted.filter((item) => item.severity !== 'info')
        : sorted;
    const chips =
        sorted.length > MAX_STATUS_CHIPS
            ? eligible.slice(0, 1)
            : eligible.slice(0, MAX_STATUS_CHIPS);
    return { chips, more: sorted.length - chips.length };
}

import type { ResourceSelection } from '../types/wizard';

/** An empty `specific` selection — the neutral starting point. */
export const EMPTY_SELECTION: ResourceSelection = { mode: 'specific', ids: [] };

/** Whether `id` is currently selected, in either mode. */
export function isSelected(selection: ResourceSelection, id: string): boolean {
    return selection.mode === 'specific'
        ? selection.ids.includes(id)
        : !selection.excludedIds.includes(id);
}

/**
 * Toggles one id. In `specific` mode this adds/removes it from the include
 * list; in `all` mode it adds/removes it from the exclude list (so unchecking
 * a row under "all" carves out an exception without leaving the mode).
 */
export function toggle(
    selection: ResourceSelection,
    id: string
): ResourceSelection {
    if (selection.mode === 'specific') {
        const has = selection.ids.includes(id);
        return {
            mode: 'specific',
            ids: has
                ? selection.ids.filter((x) => x !== id)
                : [...selection.ids, id]
        };
    }
    const excluded = selection.excludedIds.includes(id);
    return {
        mode: 'all',
        excludedIds: excluded
            ? selection.excludedIds.filter((x) => x !== id)
            : [...selection.excludedIds, id]
    };
}

/** Switches the whole resource between "all" and an empty "specific" list. */
export function setAll(all: boolean): ResourceSelection {
    return all ? { mode: 'all', excludedIds: [] } : { mode: 'specific', ids: [] };
}

/** Count of selected items given the total number available. */
export function count(selection: ResourceSelection, total: number): number {
    return selection.mode === 'specific'
        ? selection.ids.length
        : Math.max(0, total - selection.excludedIds.length);
}

/** The concrete set of selected ids, resolved against the full id list. */
export function deriveSelectedIds(
    selection: ResourceSelection,
    allIds: readonly string[]
): string[] {
    return selection.mode === 'specific'
        ? selection.ids
        : allIds.filter((id) => !selection.excludedIds.includes(id));
}

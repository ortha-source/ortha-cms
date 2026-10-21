import { useCallback, useSyncExternalStore } from 'react';

/** How long an id counts as new — long enough to outlast a list refetch. */
const WINDOW_MS = 4000;

/** `scope → id → expiry timestamp`. */
const created = new Map<string, Map<string, number>>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
    version += 1;
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

const getVersion = () => version;

/**
 * Record that `id` was just created in `scope` (a list's own name —
 * `'api-tokens'`, `'workspace-members'`), so the list can tell the reader
 * which row is the one they made.
 *
 * Called from a mutation's `onSuccess`, which knows the id; the list that
 * draws the row only learns about it on its next fetch, possibly on another
 * page. The mark expires on its own after a few seconds.
 */
export function markJustCreated(scope: string, id: string): void {
    let ids = created.get(scope);
    if (!ids) {
        ids = new Map();
        created.set(scope, ids);
    }
    ids.set(id, Date.now() + WINDOW_MS);
    emit();
    setTimeout(() => {
        const current = created.get(scope);
        if (current && (current.get(id) ?? 0) <= Date.now()) {
            current.delete(id);
            emit();
        }
    }, WINDOW_MS);
}

/**
 * `isJustCreated(id)` for one scope — true for an id {@link markJustCreated}
 * marked within the last few seconds. Put the design system's `ds-flash` (and,
 * for a list that grows in place, `ds-item-enter`) on the row it returns true
 * for: the row is highlighted when it first appears, and only that row.
 *
 * Not "every id this list has not seen before": a search being cleared or a
 * page turning brings in rows the list has not seen either, and flashing those
 * would teach the reader to ignore the highlight.
 */
export function useJustCreated(scope: string): (id: string) => boolean {
    const current = useSyncExternalStore(subscribe, getVersion, getVersion);
    return useCallback(
        (id: string) => (created.get(scope)?.get(id) ?? 0) > Date.now(),
        // `current` is the store version: a new function per change, so a
        // memoised row that takes it as a prop re-renders.
        [scope, current]
    );
}

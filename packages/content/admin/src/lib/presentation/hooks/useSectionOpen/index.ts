import { useCallback, useState } from 'react';

/** localStorage key for one form section's open state. */
function storageKey(typeName: string, groupKey: string): string {
    return `orthacms:content:section:${typeName}:${groupKey}`;
}

/** The reader's stored choice, or `undefined` when they never made one. */
function readOpen(typeName: string, groupKey: string): boolean | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        const raw = window.localStorage.getItem(storageKey(typeName, groupKey));
        return raw === null ? undefined : raw === '1';
    } catch {
        return undefined;
    }
}

/**
 * Whether one section of the entry form is open, remembered per content type
 * in `localStorage` — the same posture as the sidebar favorites.
 *
 * Remembered because the editor's tabs are **routes**: every tab switch and
 * every locale switch remounts the General tab, and a section that sprang back
 * to its schema default each time would have to be folded again on every
 * visit. The schema's `collapsed` is only the answer until the reader gives
 * their own. Storage failures degrade to in-memory state.
 */
export function useSectionOpen(
    typeName: string,
    groupKey: string,
    defaultOpen: boolean
): [boolean, (open: boolean) => void] {
    const [open, setOpenState] = useState(
        () => readOpen(typeName, groupKey) ?? defaultOpen
    );

    const setOpen = useCallback(
        (next: boolean) => {
            setOpenState(next);
            try {
                window.localStorage.setItem(
                    storageKey(typeName, groupKey),
                    next ? '1' : '0'
                );
            } catch {
                // Storage unavailable (private mode, quota) — keep it in memory.
            }
        },
        [typeName, groupKey]
    );

    return [open, setOpen];
}

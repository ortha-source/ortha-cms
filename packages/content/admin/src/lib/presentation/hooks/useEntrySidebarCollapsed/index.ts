import { useCallback, useEffect, useState } from 'react';

/** Whether the entry editor's properties rail is collapsed, and how to flip it. */
export type EntrySidebarCollapsed = {
    /** Whether the rail is currently collapsed to its narrow strip. */
    collapsed: boolean;
    /** Collapse an expanded rail, or expand a collapsed one. */
    toggle: () => void;
};

/** localStorage key for the rail's collapsed state (one per browser, not per type). */
const STORAGE_KEY = 'ortha:content:entrySidebar';

/** Reads the persisted state, tolerating missing/blocked/corrupt storage. */
function readCollapsed(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'collapsed';
    } catch {
        return false;
    }
}

/**
 * The entry editor rail's collapsed state, persisted in `localStorage` like the
 * sidebar favorites (guarded reads/writes, so private mode or a quota error
 * degrades to in-memory rather than throwing).
 *
 * It is persisted rather than component state because the editor is **remounted
 * by navigations it doesn't own** — a locale switch re-targets it at a sibling
 * record, and a single's tab segments are separate routes. A rail that sprang
 * back open on every such move would be a setting the user can't actually make.
 */
export function useEntrySidebarCollapsed(): EntrySidebarCollapsed {
    const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

    // Persist on change; swallow quota/security errors.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                collapsed ? 'collapsed' : 'expanded'
            );
        } catch {
            // Storage unavailable (private mode, quota) — keep it in memory.
        }
    }, [collapsed]);

    const toggle = useCallback(() => setCollapsed((current) => !current), []);

    return { collapsed, toggle };
}

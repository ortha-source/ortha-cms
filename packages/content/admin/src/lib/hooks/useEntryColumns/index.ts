import { useCallback, useEffect, useState } from 'react';
import { COLUMNS_STORAGE_PREFIX } from '../../constants';

/** Visible-column ids + the operations to mutate them. */
export type EntryColumns = {
    /** Currently visible column ids (a subset of the available columns). */
    visible: string[];
    /** Whether a column is currently shown. */
    isVisible: (id: string) => boolean;
    /** Show a hidden column, or hide a shown one. */
    toggle: (id: string) => void;
};

/** localStorage key for a content type's chosen columns. */
function storageKey(typeName: string): string {
    return `${COLUMNS_STORAGE_PREFIX}${typeName}`;
}

/** Reads persisted column ids, tolerating missing/blocked/corrupt storage. */
function read(typeName: string): string[] | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(storageKey(typeName));
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
        return null;
    }
}

/**
 * Per-type visible-table-columns, persisted in `localStorage` (keyed by
 * type-name, mirroring {@link useContentFavorites} — there is no column-prefs
 * server yet). Seeded with `defaultColumns` on first use, then the user's
 * picks stick across reloads. Guarded storage access degrades to an in-memory
 * list on a private-mode/quota error.
 */
export function useEntryColumns(
    typeName: string,
    defaultColumns: string[]
): EntryColumns {
    const [visible, setVisible] = useState<string[]>(
        () => read(typeName) ?? defaultColumns
    );

    // Re-seed when the open type changes (columns are per-type).
    useEffect(() => {
        setVisible(read(typeName) ?? defaultColumns);
        // `defaultColumns` is derived from the schema; key the reset on the
        // type-name so a stable default for the same type doesn't re-run this.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typeName]);

    // Persist on change; swallow quota/security errors.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                storageKey(typeName),
                JSON.stringify(visible)
            );
        } catch {
            // Storage unavailable (private mode, quota) — keep the in-memory list.
        }
    }, [typeName, visible]);

    const isVisible = useCallback(
        (id: string) => visible.includes(id),
        [visible]
    );

    const toggle = useCallback((id: string) => {
        setVisible((current) =>
            current.includes(id)
                ? current.filter((shown) => shown !== id)
                : [...current, id]
        );
    }, []);

    return { visible, isVisible, toggle };
}

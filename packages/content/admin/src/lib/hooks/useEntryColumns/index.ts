import { useCallback, useEffect, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { COLUMNS_STORAGE_PREFIX } from '../../constants';

/** Visible-column ids (ordered) + the operations to mutate them. */
export type EntryColumns = {
    /** Visible column ids, **in display order** (a subset of the available columns). */
    visible: string[];
    /** Whether a column is currently shown. */
    isVisible: (id: string) => boolean;
    /** Show a hidden column (appended last), or hide a shown one. */
    toggle: (id: string) => void;
    /** Move the `active` column to the `over` column's position. */
    reorder: (activeId: string, overId: string) => void;
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
 * Reconcile a stored order against the live schema: keep the stored ids that are
 * still available (preserving their order, de-duped), dropping any that vanished.
 * Falls back to `defaults` when nothing usable remains (e.g. first use, or a
 * schema change removed every persisted column). Newly added fields stay hidden
 * until the user enables them via the column picker.
 */
function reconcile(
    stored: string[] | null,
    available: readonly string[],
    defaults: string[]
): string[] {
    const allowed = new Set(available);
    const seen = new Set<string>();
    const kept = (stored ?? []).filter(
        (id) => allowed.has(id) && !seen.has(id) && (seen.add(id), true)
    );
    return kept.length > 0 ? kept : defaults.filter((id) => allowed.has(id));
}

/**
 * Per-type **ordered** visible-table-columns, persisted in `localStorage` (keyed
 * by type-name, mirroring {@link useContentFavorites} — there is no column-prefs
 * server yet). The stored array is the visible columns in display order, so it
 * powers both the column picker (visibility) and drag-to-reorder. Seeded with
 * `defaultColumns` on first use and reconciled against `availableColumns` on
 * load, then the user's picks/order stick across reloads. Guarded storage access
 * degrades to an in-memory list on a private-mode/quota error.
 */
export function useEntryColumns(
    typeName: string,
    availableColumns: string[],
    defaultColumns: string[]
): EntryColumns {
    const [visible, setVisible] = useState<string[]>(() =>
        reconcile(read(typeName), availableColumns, defaultColumns)
    );

    // Re-seed when the open type changes (columns are per-type). Keyed on the
    // type-name so a stable default/available for the same type doesn't re-run.
    useEffect(() => {
        setVisible(reconcile(read(typeName), availableColumns, defaultColumns));
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

    const reorder = useCallback((activeId: string, overId: string) => {
        if (activeId === overId) return;
        setVisible((current) => {
            const from = current.indexOf(activeId);
            const to = current.indexOf(overId);
            if (from === -1 || to === -1) return current;
            return arrayMove(current, from, to);
        });
    }, []);

    return { visible, isVisible, toggle, reorder };
}

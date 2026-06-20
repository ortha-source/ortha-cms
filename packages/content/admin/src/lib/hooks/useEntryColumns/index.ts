import { useCallback, useEffect, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

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

/**
 * The visible columns to start from: `defaults` narrowed to what's actually
 * available, in `defaults` order, de-duped.
 */
function seed(available: readonly string[], defaults: string[]): string[] {
    const allowed = new Set(available);
    const seen = new Set<string>();
    return defaults.filter(
        (id) => allowed.has(id) && !seen.has(id) && (seen.add(id), true)
    );
}

/**
 * Per-type **ordered** visible-table-columns, held in component state only — the
 * choice is **not persisted**, so it lasts for the session and resets on reload.
 * Seeded from `defaultColumns` (filtered to `availableColumns`) and re-seeded
 * when the open type changes (columns are per-type).
 */
export function useEntryColumns(
    typeName: string,
    availableColumns: string[],
    defaultColumns: string[]
): EntryColumns {
    const [visible, setVisible] = useState<string[]>(() =>
        seed(availableColumns, defaultColumns)
    );

    // Re-seed when the open type changes. Keyed on the type-name so a stable
    // default/available for the same type doesn't re-run.
    useEffect(() => {
        setVisible(seed(availableColumns, defaultColumns));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typeName]);

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

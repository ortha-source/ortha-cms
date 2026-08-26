import { useCallback, useState } from 'react';
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
    /**
     * Replace the whole selection — how an applied saved view seeds its pinned
     * columns. Pass `null` to fall back to the type's defaults (a view that
     * pins nothing, or whose every pinned column is gone).
     */
    replace: (columns: string[] | null) => void;
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
 * Seeded from `defaultColumns` (filtered to `availableColumns`), re-seeded when
 * the open type changes (columns are per-type), and replaceable outright so an
 * applied saved view can pin its own selection.
 */
export function useEntryColumns(
    typeName: string,
    availableColumns: string[],
    defaultColumns: string[]
): EntryColumns {
    const [visible, setVisible] = useState<string[]>(() =>
        seed(availableColumns, defaultColumns)
    );

    // Re-seed when the open type changes (columns are per-type). Using the
    // "adjust state while rendering" pattern — track the type the current
    // selection was seeded for and re-seed inline when it changes — so the new
    // columns read the *fresh* `availableColumns`/`defaultColumns` of this
    // render. This replaces a `useEffect([typeName])` that had to silence
    // `exhaustive-deps`; React applies the update before committing, no effect.
    const [seededFor, setSeededFor] = useState(typeName);
    if (seededFor !== typeName) {
        setSeededFor(typeName);
        setVisible(seed(availableColumns, defaultColumns));
    }

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

    // Applying a saved view replaces the selection wholesale; `null` means the
    // view pinned nothing usable, so fall back to the type's defaults.
    //
    // The caller drives this from an effect keyed on the applied view, **after**
    // the type re-seed above has run. Doing it the other way — seeding the view
    // during render — would fight that re-seed on the one commit where both the
    // type and the view change (a deep link into another collection's view).
    const replace = useCallback(
        (columns: string[] | null) => {
            setVisible(columns ?? seed(availableColumns, defaultColumns));
        },
        // `seed` is pure and the caller rebuilds these arrays per render from a
        // `useMemo`; depending on the serialized ids keeps the callback stable
        // across renders that changed nothing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [availableColumns.join(','), defaultColumns.join(',')]
    );

    return { visible, isVisible, toggle, reorder, replace };
}

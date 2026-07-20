import { useMemo } from 'react';
import type { ResourceSelection } from '../../../domain/types/wizard';
import {
    count as countSelected,
    isSelected as isSelectedIn,
    setAll as setAllMode,
    toggle as toggleId
} from '../../../domain/resourceSelection';

/** Bound helpers returned by {@link useResourceSelection}. */
export type ResourceSelectionController = {
    /** Whether `id` is selected in the current mode. */
    isSelected: (id: string) => boolean;
    /** Toggle one id (include list in `specific`, exclude list in `all`). */
    toggle: (id: string) => void;
    /** Switch the whole resource to "all" or back to an empty "specific" list. */
    setAll: (all: boolean) => void;
    /** Whether the resource is in "all" mode. */
    isAll: boolean;
    /** Count of selected items given the total available. */
    count: number;
};

/**
 * Controlled wrapper over the pure `resourceSelection` helpers. State lives in
 * the caller (the wizard); this binds the selection + `onChange` into ready
 * handlers for a selection panel, and derives the selected `count` from `total`.
 */
export function useResourceSelection(
    selection: ResourceSelection,
    onChange: (next: ResourceSelection) => void,
    total: number
): ResourceSelectionController {
    return useMemo(
        () => ({
            isSelected: (id: string) => isSelectedIn(selection, id),
            toggle: (id: string) => onChange(toggleId(selection, id)),
            setAll: (all: boolean) => onChange(setAllMode(all)),
            isAll: selection.mode === 'all',
            count: countSelected(selection, total)
        }),
        [selection, onChange, total]
    );
}

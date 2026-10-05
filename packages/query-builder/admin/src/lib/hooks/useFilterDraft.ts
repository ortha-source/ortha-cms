import { useCallback, useEffect, useState } from 'react';
import type { FilterField } from '../types/filter-field.type';
import type { FilterGroup } from '../types/filter-tree.type';
import { treeHasInvalidRules } from '../utils/validateRule';

/** Options for {@link useFilterDraft}. */
export type UseFilterDraftOptions = {
    /** Whether the hosting surface is open. Each open re-reads `value`. */
    open: boolean;
    /** The applied filter tree (URL-driven). `null` when no rules are set. */
    value: FilterGroup | null;
    /** The fields the Apply gate resolves each rule against. */
    fields: readonly FilterField[];
    /** Called on Apply (with the next tree) or Reset (with `null`). */
    onApply: (next: FilterGroup | null) => void;
    /** Called after a successful **Apply** (not Reset). */
    onApplied?: () => void;
};

/** What {@link useFilterDraft} hands the surface hosting the builder. */
export type FilterDraft = {
    /** The staged tree the builder edits. */
    draft: FilterGroup | null;
    /** Replace the staged tree — the builder's `onChange`. */
    setDraft: (next: FilterGroup | null) => void;
    /** Whether the builder should render its inline rule errors. */
    showErrors: boolean;
    /**
     * Commit the draft. Returns `false` — and turns the inline errors on —
     * when a rule fails the Apply gate, in which case nothing is committed and
     * the surface should stay open; `true` once `onApply` / `onApplied` ran.
     */
    apply: () => boolean;
    /** Clear the draft and commit "no filter" (`onApply(null)`). */
    reset: () => void;
};

/**
 * The staged-draft lifecycle every query-builder surface shares (the popover
 * and the drawer): the builder edits a **draft**, and only Apply commits it.
 *
 * - Every open re-reads the applied `value`, so the user edits the filter the
 *   table is actually showing — closing without Apply discards the draft, and
 *   a reopened surface never resurrects yesterday's abandoned edit
 *   (`[query-builder:I-14]`).
 * - Inline errors stay hidden until Apply is pressed on an invalid draft, are
 *   cleared on reopen (a fresh draft has not been "applied" yet), and fade out
 *   by themselves once the draft becomes valid — no second Apply needed.
 * - Apply on a draft with no rules commits `null`, not an empty group, so the
 *   URL loses its `filter` param rather than carrying `{"and":[]}`.
 */
export function useFilterDraft({
    open,
    value,
    fields,
    onApply,
    onApplied
}: UseFilterDraftOptions): FilterDraft {
    const [draft, setDraft] = useState<FilterGroup | null>(value);
    const [showErrors, setShowErrors] = useState(false);

    useEffect(() => {
        if (open) {
            setDraft(value);
            setShowErrors(false);
        }
    }, [open, value]);

    useEffect(() => {
        if (showErrors && !treeHasInvalidRules(draft, fields)) {
            setShowErrors(false);
        }
    }, [draft, fields, showErrors]);

    const apply = useCallback((): boolean => {
        if (treeHasInvalidRules(draft, fields)) {
            setShowErrors(true);
            return false;
        }
        const hasRules = draft !== null && draft.children.length > 0;
        onApply(hasRules ? draft : null);
        onApplied?.();
        return true;
    }, [draft, fields, onApply, onApplied]);

    const reset = useCallback(() => {
        setDraft(null);
        setShowErrors(false);
        onApply(null);
    }, [onApply]);

    return { draft, setDraft, showErrors, apply, reset };
}

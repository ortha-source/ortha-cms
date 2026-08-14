import {
    useCallback,
    useEffect,
    useId,
    useState,
    type KeyboardEvent
} from 'react';

/** Arguments for {@link useComboboxList}. */
export type UseComboboxListArgs = {
    /** How many options the popover is currently showing. */
    count: number;
    /** Whether the popover is open (a closed list has no active option). */
    open: boolean;
    /** Commit the option at `index` — called on Enter. */
    onSelect: (index: number) => void;
    /** Close the popover — called on Escape. */
    onDismiss?: () => void;
};

/** What {@link useComboboxList} returns. */
export type UseComboboxListResult = {
    /** `id` for the `role="listbox"` element, wired to `aria-controls`. */
    listboxId: string;
    /** `id` for the option at `index`, wired to `aria-activedescendant`. */
    optionId: (index: number) => string;
    /** The active option's id, or `undefined` when nothing is active. */
    activeId: string | undefined;
    /** Index of the visually-active option. */
    activeIndex: number;
    /** Point the active option at `index` (e.g. on pointer hover). */
    setActiveIndex: (index: number) => void;
    /** ↓/↑/Home/End/Enter/Escape handler for the combobox input. */
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

/**
 * The keyboard half of the ARIA 1.2 **combobox** pattern for a search input with
 * a popover list of results.
 *
 * Focus deliberately stays in the input — the list is driven by
 * `aria-activedescendant`, not by moving DOM focus — because a search field the
 * user is still typing into must not lose focus when results arrive. That is
 * what lets ↓/↑ walk the options while typing continues to work, and it is the
 * affordance both typeaheads were missing: previously the only route to a result
 * was Tab *out of* the input into the popover, which is not what anyone expects
 * from a search box.
 *
 * The caller owns rendering and the `count → action` mapping; this owns the
 * active index, the id wiring, and the key handling.
 */
export function useComboboxList({
    count,
    open,
    onSelect,
    onDismiss
}: UseComboboxListArgs): UseComboboxListResult {
    const listboxId = useId();
    const [activeIndex, setActiveIndex] = useState(0);

    // Results change under the cursor as the query narrows, so the active option
    // has to snap back rather than point past the end of a shorter list.
    useEffect(() => {
        setActiveIndex(0);
    }, [count, open]);

    const optionId = useCallback(
        (index: number) => `${listboxId}-option-${index}`,
        [listboxId]
    );

    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Escape') {
                onDismiss?.();
                return;
            }
            if (!open || count === 0) return;

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                setActiveIndex((i) => (i + delta + count) % count);
                return;
            }
            if (event.key === 'Home') {
                event.preventDefault();
                setActiveIndex(0);
                return;
            }
            if (event.key === 'End') {
                event.preventDefault();
                setActiveIndex(count - 1);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                onSelect(activeIndex);
            }
        },
        [activeIndex, count, onDismiss, onSelect, open]
    );

    return {
        listboxId,
        optionId,
        activeId: open && count > 0 ? optionId(activeIndex) : undefined,
        activeIndex,
        setActiveIndex,
        onKeyDown
    };
}

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '../../utils';
import { Button } from './button';
import { InsetFloating } from './sidebar';

type SelectionBarProps = {
    /** Accessible name of the bar (it is a `group`), e.g. "Selection". */
    label: string;
    /** The count, as the reader should see it ("3 selected of 42"). */
    count: React.ReactNode;
    /** What to do with the selection: buttons, a ⋯ menu, a divider. */
    children?: React.ReactNode;
    /** Accessible name of the ✕ that clears the selection. */
    clearLabel: string;
    /** Clears the selection. */
    onClear: () => void;
    className?: string;
};

/**
 * The bar a list raises **while something is selected**: a light card that
 * floats at the bottom centre of the work area ({@link InsetFloating}) with the
 * count, the caller's bulk actions and a ✕ that clears. It floats rather than
 * sitting above the list so the list neither jumps when a row is ticked nor
 * loses its toolbar while the selection lasts.
 *
 * The ✕ is its own control, outside every menu, because it is the way *out* of
 * a state the reader may have entered by accident. The count is visual only —
 * the bar mounts and unmounts with the selection, so a spoken announcement
 * belongs in a persistent live region the page owns.
 *
 * It covers the bottom of the page, so the page pads whatever scrolls while
 * it is up (see {@link InsetFloating}).
 *
 * Actions inside are ordinary `ghost` buttons; a destructive one takes
 * `text-destructive`. Use {@link SelectionBarDivider} to set a group apart.
 * Copy-free: every string comes from the caller.
 */
function SelectionBar({
    label,
    count,
    children,
    clearLabel,
    onClear,
    className
}: SelectionBarProps) {
    return (
        <InsetFloating>
            <div
                role="group"
                aria-label={label}
                data-slot="selection-bar"
                className={cn(
                    'ds-item-enter pointer-events-auto flex min-h-11 max-w-full flex-wrap items-center gap-1 rounded-xl border bg-popover py-1.5 pl-4 pr-1.5 text-popover-foreground shadow-lg',
                    className
                )}
            >
                <span className="mr-1 flex items-baseline gap-1.5 text-sm">
                    {count}
                </span>
                <SelectionBarDivider />
                <div className="flex min-w-0 flex-wrap items-center gap-0.5">
                    {children}
                </div>
                <SelectionBarDivider />
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    onClick={onClear}
                    aria-label={clearLabel}
                >
                    <X aria-hidden />
                </Button>
            </div>
        </InsetFloating>
    );
}

/** A hairline between groups of actions in a {@link SelectionBar}. */
function SelectionBarDivider({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cn('mx-1 h-4 w-px shrink-0 bg-border', className)}
        />
    );
}

export { SelectionBar, SelectionBarDivider };

import type { ReactNode } from 'react';
import { cn } from '@ortha-cms/design-system';

type RailTooltipProps = {
    /** Label text shown in the flyout (also the trigger's `aria-label`). */
    label: string;
    /**
     * Hide the tooltip even on hover — used by the switcher so its tooltip
     * doesn't compete with its open popover.
     */
    suppressed?: boolean;
    /** The rail trigger (a `<button>`); the tooltip reveals on its hover/focus. */
    children: ReactNode;
};

/**
 * Wraps a rail item with the spec's fly-out label: a `--primary` chip that
 * slides out to the right on hover/focus, with a small rotated caret. The
 * tooltip is decorative (`aria-hidden`) — the label is duplicated in the
 * trigger's `aria-label`, so screen readers get it without the visual. Motion
 * is dropped under `prefers-reduced-motion`.
 */
export function RailTooltip({
    label,
    suppressed = false,
    children
}: RailTooltipProps) {
    return (
        <div className="group relative flex items-center">
            {children}
            <span
                aria-hidden
                className={cn(
                    'pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-[70] -translate-y-1/2',
                    'whitespace-nowrap rounded-md bg-primary px-[9px] py-[5px] text-xs font-medium text-primary-foreground shadow-md',
                    '-translate-x-1 opacity-0 transition-[opacity,transform] duration-[120ms] ease-out',
                    'motion-reduce:translate-x-0 motion-reduce:transition-none',
                    !suppressed &&
                        'group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100'
                )}
            >
                <span
                    aria-hidden
                    className="absolute -left-[3px] top-1/2 size-2 -translate-y-1/2 rotate-45 rounded-[1px] bg-primary"
                />
                {label}
            </span>
        </div>
    );
}

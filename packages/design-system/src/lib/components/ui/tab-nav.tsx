import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '../../utils';
import {
    mergeRefs,
    useActiveIndicator,
    type ActiveIndicatorRect
} from '../../hooks/use-active-indicator';

/**
 * The underline shared by a tab strip — `TabsList` and `TabNav` both draw one
 * and **slide** it to the active tab, so a change of tab reads as the same
 * marker moving rather than one underline vanishing and another appearing.
 *
 * Drawn as a 2px bottom *border*, not a filled box, so it survives
 * `forced-colors: active` (which discards backgrounds but keeps borders). It
 * sits exactly where the active tab's own `border-b-2` would, and the tab's
 * border turns transparent only while this one is live. The slide is gated on
 * `settled`, so on mount the underline is simply there.
 */
function TabIndicator({
    rect,
    settled
}: {
    rect: ActiveIndicatorRect | null;
    settled: boolean;
}) {
    if (!rect) return null;
    return (
        <span
            aria-hidden
            data-slot="tab-indicator"
            className={cn(
                'pointer-events-none absolute left-0 top-0 h-0 border-b-2 border-foreground',
                settled &&
                    'transition-[translate,width] duration-(--ds-duration-base) ease-(--ds-ease-out) motion-reduce:transition-none'
            )}
            style={{
                width: rect.width,
                translate: `${rect.x}px ${rect.y + rect.height - 2}px`
            }}
        />
    );
}

/**
 * Horizontal, underline-style tab navigation for **route-backed** tabs (each
 * "tab" is a link to a nested route). Visually identical to `TabsList`, but a
 * `<nav>` of links instead of a Radix tablist — use it when the active pane is
 * decided by the router, not component state. Pass an `aria-label`.
 */
const TabNav = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ className, children, ...props }, ref) => {
        const indicator = useActiveIndicator<HTMLElement>(
            '[aria-current=page]'
        );
        const navRef = React.useMemo(
            () => mergeRefs(ref, indicator.ref),
            [ref, indicator.ref]
        );
        return (
            <nav
                ref={navRef}
                data-indicator={indicator.rect ? 'live' : undefined}
                className={cn(
                    'group/tabs relative flex w-full items-center gap-5 overflow-x-auto overflow-y-hidden border-b border-border text-muted-foreground',
                    className
                )}
                {...props}
            >
                {children}
                <TabIndicator
                    rect={indicator.rect}
                    settled={indicator.settled}
                />
            </nav>
        );
    }
);
TabNav.displayName = 'TabNav';

export type TabNavLinkProps = React.HTMLAttributes<HTMLElement> & {
    /**
     * Render as the child element — pass a router `NavLink` so the router owns
     * navigation and sets `aria-current="page"` on the active tab (which is
     * what the underline styling keys off).
     */
    asChild?: boolean;
};

/**
 * One tab in a {@link TabNav}: an underlined link whose active state is driven
 * by `aria-current="page"` (react-router's `NavLink` sets it automatically).
 */
const TabNavLink = React.forwardRef<HTMLElement, TabNavLinkProps>(
    ({ className, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'a';
        return (
            <Comp
                ref={ref as React.Ref<HTMLAnchorElement>}
                className={cn(
                    '-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-1 pb-2 pt-1 text-sm font-medium transition-colors',
                    'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'aria-[current=page]:border-foreground aria-[current=page]:text-foreground',
                    // The nav's sliding underline draws it while live.
                    'group-data-[indicator=live]/tabs:aria-[current=page]:border-transparent',
                    className
                )}
                {...props}
            />
        );
    }
);
TabNavLink.displayName = 'TabNavLink';

export { TabNav, TabNavLink, TabIndicator };

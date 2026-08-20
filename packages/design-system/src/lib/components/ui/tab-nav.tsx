import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '../../utils';

/**
 * Horizontal, underline-style tab navigation for **route-backed** tabs (each
 * "tab" is a link to a nested route). Visually identical to `TabsList`, but a
 * `<nav>` of links instead of a Radix tablist — use it when the active pane is
 * decided by the router, not component state. Pass an `aria-label`.
 */
const TabNav = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
    ({ className, ...props }, ref) => (
        <nav
            ref={ref}
            className={cn(
                'flex w-full items-center gap-5 overflow-x-auto border-b border-border text-muted-foreground',
                className
            )}
            {...props}
        />
    )
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
                    className
                )}
                {...props}
            />
        );
    }
);
TabNavLink.displayName = 'TabNavLink';

export { TabNav, TabNavLink };

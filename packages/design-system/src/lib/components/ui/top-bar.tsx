import * as React from 'react';

import { cn } from '../../utils';
import { SidebarTrigger, useOptionalSidebar } from './sidebar';

/**
 * A slim, sticky page-context bar (incident.io-style): a colored icon tile
 * beside a breadcrumb, pinned to the top of the page or scroll pane it heads.
 * Compose with {@link TopBarIcon} and the `Breadcrumb` family.
 *
 * When rendered inside a `SidebarProvider` and the sidebar is hidden
 * (collapsed on desktop, or on mobile), the bar leads with an inline
 * `SidebarTrigger` — the reveal control lives in the bar instead of floating
 * over the page.
 */
const TopBar = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const sidebar = useOptionalSidebar();
    const showTrigger =
        !!sidebar && (sidebar.isMobile || sidebar.state === 'collapsed');

    return (
        <div
            ref={ref}
            data-slot="top-bar"
            className={cn(
                'sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2.5 border-b bg-background px-4',
                className
            )}
            {...props}
        >
            {showTrigger ? (
                <SidebarTrigger className="-ml-1 shrink-0 text-muted-foreground" />
            ) : null}
            {children}
        </div>
    );
});
TopBar.displayName = 'TopBar';

/**
 * The bar's leading icon tile. Pass a soft surface + matching foreground pair
 * via `className` (e.g. `bg-brand-soft text-brand-soft-foreground`) and a
 * lucide icon as the child; the tile sizes the icon. Falls back to a neutral
 * gray tile. Decorative — hidden from assistive tech (the breadcrumb carries
 * the context).
 */
const TopBarIcon = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
    <span
        ref={ref}
        aria-hidden
        className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/10 text-foreground [&>svg]:size-3.5',
            className
        )}
        {...props}
    />
));
TopBarIcon.displayName = 'TopBarIcon';

export { TopBar, TopBarIcon };

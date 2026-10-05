import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../utils';
import {
    SidebarTrigger,
    useInsetTabsHost,
    useInsetTopBarHost,
    useOptionalSidebar
} from './sidebar';

/**
 * A slim page-context bar (incident.io-style): a colored icon tile beside a
 * breadcrumb, heading the page. Compose with {@link TopBarIcon},
 * {@link TopBarActions} and the `Breadcrumb` family.
 *
 * Inside a `SidebarInset` the bar **hoists itself out of the scrollport** into
 * the inset's fixed strip, so the content scrolls under a bar that never moves
 * and the scrollbar starts below it rather than running the bar's full height
 * beside it. It is a portal, so the bar keeps its page's React context — a page
 * writes `<TopBar>` as the first thing in its tree and doesn't have to know. On
 * a page with no inset above it (a public screen) it just renders in place.
 *
 * When the surrounding sidebar is hidden (collapsed on desktop, or on mobile),
 * the bar leads with an inline `SidebarTrigger` — the reveal control lives in
 * the bar instead of floating over the page.
 */
const TopBar = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
    const sidebar = useOptionalSidebar();
    const host = useInsetTopBarHost();
    const showTrigger =
        !!sidebar && (sidebar.isMobile || sidebar.state === 'collapsed');

    const bar = (
        <div
            ref={ref}
            data-slot="top-bar"
            className={cn(
                'flex h-12 shrink-0 items-center gap-2.5 border-b bg-background px-4',
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

    // `undefined` = no inset above (render in place); `null` = the host mounts
    // one commit from now, so hold the bar back rather than flashing it in the
    // page's flow and then moving it.
    if (host === undefined) return bar;
    return host ? createPortal(bar, host) : null;
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

/**
 * The bar's trailing region: page-level actions, pushed to the right edge. Place
 * it as the **last** child of a {@link TopBar} — `ml-auto` is what separates it
 * from the breadcrumb, so anything after it would be pushed off the end.
 * Presentational; who fills it is the consumer's business.
 */
const TopBarActions = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        data-slot="top-bar-actions"
        className={cn('ml-auto flex shrink-0 items-center gap-2', className)}
        {...props}
    />
));
TopBarActions.displayName = 'TopBarActions';

/**
 * A page's **tabs, drawn as the top bar's second row** — under the
 * breadcrumb, inside the header band (incident.io-style), rather than as the
 * first thing in the page body. Wrap a `TabsList` or a `TabNav` in it; it
 * hoists them by portal into the inset's tabs row, so a Radix `Tabs` root
 * further down still owns them (a portal keeps the React tree), and the
 * band's rule moves from under the bar to under the tabs.
 *
 * The list's own bottom rule and margin give way to the row's: the row is
 * ruled edge to edge, and the active tab's underline sits on that rule. On a
 * page with no inset above it, it renders in place.
 */
function TopBarTabs({
    className,
    children
}: {
    className?: string;
    children: React.ReactNode;
}) {
    const host = useInsetTabsHost();
    const row = (
        <div
            data-slot="top-bar-tabs"
            className={cn(
                // A fixed 36px (`h-9`): the band is then always the bar's 48 plus
                // this, and a column beside it (the right panel's header) can
                // rule itself on the same line.
                'flex h-9 min-w-0 items-end overflow-x-auto border-b bg-background px-4',
                '[&>*]:mb-0 [&>*]:border-b-0',
                className
            )}
        >
            {children}
        </div>
    );

    if (host === undefined) return row;
    return host ? createPortal(row, host) : null;
}

export { TopBar, TopBarIcon, TopBarActions, TopBarTabs };

import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../utils';
import { useIsMobile } from '../../hooks/use-mobile';
import { DensityProvider } from './density';

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
    /**
     * `default` centres the body at the admin's one page measure (1120px) —
     * every list, form and settings page, tables included: a list of members
     * or webhooks reads better with its columns close together than spread
     * over a wide screen. `full` lets it run the width of the work area, and
     * belongs to **one** page: a collection's records table, whose columns
     * are the reader's own choice and can number a dozen.
     */
    width?: 'default' | 'full';
};

/** Page content wrapper: centers and pads the matched route's body. */
const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
    ({ className, width = 'default', ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                'mx-auto w-full px-4 py-8 sm:px-10',
                width === 'full' ? 'max-w-none' : 'max-w-[1120px]',
                className
            )}
            {...props}
        />
    )
);
Container.displayName = 'Container';

/**
 * Where a {@link ContainerHeader} sends its actions when the page has a top
 * bar: the bar's trailing region. `null` means there is no bar on this page
 * (or it has not mounted yet), and the header draws itself in full.
 */
const PageHeaderHostContext = React.createContext<HTMLElement | null>(null);

/**
 * Provided by the app shell, which owns the top bar's actions region. The
 * design system cannot reach the shell, so the shell hands the region down
 * rather than the header reaching up for it.
 */
function PageHeaderHost({
    host,
    children
}: {
    /** The top bar's actions container, or `null` while there is none. */
    host: HTMLElement | null;
    children: React.ReactNode;
}) {
    return (
        <PageHeaderHostContext.Provider value={host}>
            {children}
        </PageHeaderHostContext.Provider>
    );
}

type ContainerHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
    /** Page title, rendered as the `<h1>`. */
    title: React.ReactNode;
    /**
     * Optional mark leading the title — pass a sized icon element
     * (`<Table2 className="size-4" />`); the tile around it is drawn here.
     *
     * Decorative by construction: the tile is `aria-hidden`, because the
     * heading beside it already names the page and a screen reader repeating
     * "table" before it says nothing a reader can use.
     */
    icon?: React.ReactNode;
    /** Optional supporting copy beneath the title. */
    subtitle?: React.ReactNode;
    /** Optional trailing actions (e.g. a primary button). */
    actions?: React.ReactNode;
    /** Override classes for the `<h1>` (e.g. a smaller size on dense pages). */
    titleClassName?: string;
};

/**
 * Page header: the page's `<h1>` over one line of supporting copy, actions
 * trailing. Wraps to a stacked layout on narrow viewports so the actions never
 * crowd the title.
 *
 * **Every page in the admin gets its heading from here**, which is the point:
 * pages that drew their own had drifted to a different size and a different
 * tracking from everywhere else, and would have drifted again after the next
 * change to this file. Sections below it are `<h2>`.
 *
 * **The title stays on screen under a top bar.** It used to fold away there
 * (`sr-only`, the breadcrumb standing in for it), which left list pages
 * starting straight on a toolbar with nothing saying what the list was or why
 * it mattered. The bar's breadcrumb says where you are; the heading says what
 * the page is for. Only the **actions** move: on a desktop viewport with a
 * {@link PageHeaderHost} they portal into the bar at compact density. Below
 * the breakpoint the bar has no room for them, so they stay beside the title.
 */
const ContainerHeader = React.forwardRef<HTMLDivElement, ContainerHeaderProps>(
    (
        { className, title, icon, subtitle, actions, titleClassName, ...props },
        ref
    ) => {
        const host = React.useContext(PageHeaderHostContext);
        const isMobile = useIsMobile();

        return (
            <div
                ref={ref}
                className={cn(
                    'mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
                    className
                )}
                {...props}
            >
                <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex items-center gap-2.5">
                        {icon ? (
                            <span
                                aria-hidden
                                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
                            >
                                {icon}
                            </span>
                        ) : null}
                        <h1
                            className={cn(
                                'text-2xl font-semibold leading-8 tracking-[-0.01em]',
                                titleClassName
                            )}
                        >
                            {title}
                        </h1>
                    </div>
                    {subtitle ? (
                        <p className="max-w-[640px] text-[13px] text-muted-foreground">
                            {subtitle}
                        </p>
                    ) : null}
                </div>
                {actions && host && !isMobile ? (
                    createPortal(
                        <DensityProvider density="compact">
                            <div className="flex items-center gap-2">
                                {actions}
                            </div>
                        </DensityProvider>,
                        host
                    )
                ) : actions ? (
                    // Wraps rather than refusing to shrink: a header whose actions
                    // row has grown past two buttons used to push itself off the
                    // right edge on a narrow viewport instead of taking a second
                    // line.
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {actions}
                    </div>
                ) : null}
            </div>
        );
    }
);
ContainerHeader.displayName = 'ContainerHeader';

export { Container, ContainerHeader, PageHeaderHost };

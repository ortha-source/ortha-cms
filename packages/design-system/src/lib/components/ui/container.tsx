import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../../utils';
import { useIsMobile } from '../../hooks/use-mobile';
import { DensityProvider } from './density';

type ContainerProps = React.HTMLAttributes<HTMLDivElement> & {
    /**
     * `default` centres the body at a 6xl measure — right for forms, editors
     * and anything read line by line. `full` lets it run the width of the work
     * area, for pages that are one big table: a list gains columns, not
     * line length, and a measure only cut it off with empty gutters beside it.
     */
    width?: 'default' | 'full';
};

/** Page content wrapper: centers and pads the matched route's body. */
const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
    ({ className, width = 'default', ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                'mx-auto w-full px-4 py-6 sm:px-6 sm:py-8',
                width === 'full' ? 'max-w-none' : 'max-w-6xl',
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
    /**
     * Keep the subtitle on screen when the header folds into the top bar.
     * For a subtitle that is **data** (a webhook's URL) rather than a gloss
     * on the page; the default drops it to screen-reader-only with the title.
     */
    keepSubtitle?: boolean;
};

/**
 * Page header: title + optional subtitle on the leading side, actions trailing.
 * Wraps to a stacked layout on narrow viewports so the actions never crowd the
 * title.
 *
 * **Every page in the admin gets its heading from here**, which is the point:
 * the two pages that drew their own — the records list and the entry editor —
 * had drifted to a different size and a different tracking from everywhere
 * else, and would have drifted again after the next change to this file.
 *
 * **Under a top bar it folds away.** The bar already names the page, so on a
 * desktop viewport with a {@link PageHeaderHost} the header keeps its `<h1>`
 * (and subtitle) for assistive technology only, and portals its actions into
 * the bar at compact density — the page gets the vertical space back. Below
 * the breakpoint the bar has no room for a page's actions, so the header draws
 * itself in full there, as it does on a page with no bar at all.
 */
const ContainerHeader = React.forwardRef<HTMLDivElement, ContainerHeaderProps>(
    (
        {
            className,
            title,
            icon,
            subtitle,
            actions,
            titleClassName,
            keepSubtitle = false,
            ...props
        },
        ref
    ) => {
        const host = React.useContext(PageHeaderHostContext);
        const isMobile = useIsMobile();

        if (host && !isMobile) {
            return (
                <>
                    <div
                        ref={ref}
                        className={cn(
                            keepSubtitle && subtitle ? 'mb-4' : 'sr-only'
                        )}
                        {...props}
                    >
                        <h1 className="sr-only">{title}</h1>
                        {subtitle ? (
                            <p
                                className={cn(
                                    keepSubtitle
                                        ? 'max-w-2xl truncate text-sm text-muted-foreground'
                                        : 'sr-only'
                                )}
                            >
                                {subtitle}
                            </p>
                        ) : null}
                    </div>
                    {actions
                        ? createPortal(
                              <DensityProvider density="compact">
                                  <div className="flex items-center gap-2">
                                      {actions}
                                  </div>
                              </DensityProvider>,
                              host
                          )
                        : null}
                </>
            );
        }

        return (
            <div
                ref={ref}
                className={cn(
                    'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
                    className
                )}
                {...props}
            >
                <div className="flex flex-col gap-1">
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
                                'text-2xl font-semibold tracking-tight',
                                titleClassName
                            )}
                        >
                            {title}
                        </h1>
                    </div>
                    {subtitle ? (
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            {subtitle}
                        </p>
                    ) : null}
                </div>
                {actions ? (
                    // Wraps rather than refusing to shrink: a header whose actions
                    // row has grown past two buttons (the records table's, which
                    // also carries the saved-view switcher) used to push itself
                    // off the right edge on a narrow viewport instead of taking a
                    // second line.
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

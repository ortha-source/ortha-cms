import * as React from 'react';

import { cn } from '../../utils';

/** Page content wrapper: centers and pads the matched route's body. */
const Container = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8',
            className
        )}
        {...props}
    />
));
Container.displayName = 'Container';

type ContainerHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
    /** Page title, rendered as the `<h1>`. */
    title: React.ReactNode;
    /** Optional supporting copy beneath the title. */
    subtitle?: React.ReactNode;
    /** Optional trailing actions (e.g. a primary button). */
    actions?: React.ReactNode;
    /** Override classes for the `<h1>` (e.g. a smaller size on dense pages). */
    titleClassName?: string;
};

/**
 * Page header: title + optional subtitle on the leading side, actions trailing.
 * Wraps to a stacked layout on narrow viewports so the actions never crowd the
 * title.
 */
const ContainerHeader = React.forwardRef<HTMLDivElement, ContainerHeaderProps>(
    (
        { className, title, subtitle, actions, titleClassName, ...props },
        ref
    ) => (
        <div
            ref={ref}
            className={cn(
                'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
                className
            )}
            {...props}
        >
            <div className="flex flex-col gap-1">
                <h1
                    className={cn(
                        'text-2xl font-semibold tracking-tight',
                        titleClassName
                    )}
                >
                    {title}
                </h1>
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
    )
);
ContainerHeader.displayName = 'ContainerHeader';

export { Container, ContainerHeader };

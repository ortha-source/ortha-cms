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
};

/**
 * Page header: title + optional subtitle on the leading side, actions trailing.
 * Wraps to a stacked layout on narrow viewports so the actions never crowd the
 * title.
 */
const ContainerHeader = React.forwardRef<HTMLDivElement, ContainerHeaderProps>(
    ({ className, title, subtitle, actions, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                'mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
                className
            )}
            {...props}
        >
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {title}
                </h1>
                {subtitle ? (
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        {subtitle}
                    </p>
                ) : null}
            </div>
            {actions ? (
                <div className="flex shrink-0 items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </div>
    )
);
ContainerHeader.displayName = 'ContainerHeader';

export { Container, ContainerHeader };

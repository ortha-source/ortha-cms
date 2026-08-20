import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../utils';

function Empty({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="empty"
            className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center md:p-12',
                className
            )}
            {...props}
        />
    );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="empty-header"
            className={cn(
                'flex max-w-sm flex-col items-center gap-2 text-center',
                className
            )}
            {...props}
        />
    );
}

const emptyMediaVariants = cva(
    'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'bg-transparent',
                icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6"
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
);

function EmptyMedia({
    className,
    variant = 'default',
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
    return (
        <div
            data-slot="empty-icon"
            data-variant={variant}
            className={cn(emptyMediaVariants({ variant, className }))}
            {...props}
        />
    );
}

/**
 * The empty state's title line.
 *
 * A `<div>` by default, because most empty states sit *inside* a page that
 * already has its heading and adding a second one would be noise. Where the
 * empty state **is** the page — a route whose whole content is this — pass
 * `asChild` and supply the heading the page owes at the rank it needs, the way
 * `CardTitle` is used on the auth screens:
 *
 * ```tsx
 * <EmptyTitle asChild>
 *     <h1>Content Library</h1>
 * </EmptyTitle>
 * ```
 */
function EmptyTitle({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<'div'> & {
    /** Render as the child element (e.g. an `<h1>`) instead of a `<div>`. */
    asChild?: boolean;
}) {
    const Comp = asChild ? Slot : 'div';
    return (
        <Comp
            data-slot="empty-title"
            className={cn('text-lg font-medium tracking-tight', className)}
            {...props}
        />
    );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
    return (
        <div
            data-slot="empty-description"
            className={cn(
                'text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4',
                className
            )}
            {...props}
        />
    );
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="empty-content"
            className={cn(
                'flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm',
                className
            )}
            {...props}
        />
    );
}

export {
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
    EmptyMedia
};

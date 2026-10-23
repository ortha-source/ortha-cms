import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../utils';

const badgeVariants = cva(
    // `gap-1` is in the base, not left to each caller. A badge is an
    // icon-and-label chip as often as it is bare text, and every consumer that
    // put a glyph in one had to remember to re-add the spacing — the ones that
    // forgot rendered the icon touching the first letter. A gap costs nothing
    // on a text-only badge, which has a single child.
    // A 20px chip with a 6px radius — a label on a record, not a pill-shaped
    // button. `leading-none` and a fixed height (rather than vertical padding)
    // keep a badge with a dot or an icon the same height as one without.
    'inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap rounded-md border font-medium leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-primary text-primary-foreground shadow',
                secondary:
                    'border-transparent bg-secondary text-secondary-foreground',
                destructive:
                    'border-transparent bg-destructive text-destructive-foreground shadow',
                outline: 'text-foreground',
                /* Soft tinted chips: colored surface + dark text of the same
                   hue. For statuses/labels where a solid badge is too loud. */
                success:
                    'border-transparent bg-success-soft text-success-soft-foreground',
                warning:
                    'border-transparent bg-warning-soft text-warning-soft-foreground',
                info: 'border-transparent bg-info-soft text-info-soft-foreground',
                'destructive-soft':
                    'border-transparent bg-destructive-soft text-destructive-soft-foreground',
                'primary-soft':
                    'border-transparent bg-brand-soft text-brand-soft-foreground',
                /** Neutral tint: a quiet state ("Draft", "Superseded"). */
                muted: 'border-transparent bg-muted text-muted-foreground',
                /** Hairline only: a fact beside a state ("EN · English"). */
                line: 'border-border bg-transparent text-muted-foreground'
            },
            size: {
                default: 'h-5 px-[7px] text-xs',
                /** Inside a row or beside a label: "Changed", "Live". */
                xs: 'h-[18px] px-1.5 text-[11px]'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
    return (
        <div
            className={cn(badgeVariants({ variant, size }), className)}
            {...props}
        />
    );
}

/**
 * The 6px status dot a state badge leads with ("● Published") — in the
 * badge's own colour, so the state is carried by shape and word as well as
 * hue.
 */
function BadgeDot({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            aria-hidden
            className={cn(
                'size-1.5 shrink-0 rounded-full bg-current',
                className
            )}
            {...props}
        />
    );
}

export { Badge, BadgeDot, badgeVariants };

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../utils';

const badgeVariants = cva(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80',
                secondary:
                    'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
                destructive:
                    'border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80',
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
                    'border-transparent bg-primary-soft text-primary-soft-foreground'
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };

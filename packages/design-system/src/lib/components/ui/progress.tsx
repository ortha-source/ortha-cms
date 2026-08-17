import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '../../utils';

/**
 * A determinate progress bar. `value` is a 0–100 percentage; the primitive
 * renders `role="progressbar"` with the matching `aria-valuenow`, so give it an
 * `aria-label` (or `aria-labelledby`) naming what is progressing, and an
 * `aria-valuetext` when a bare percentage would read poorly ("3 of 5 files").
 * Height/width come from `className`.
 */
const Progress = React.forwardRef<
    React.ElementRef<typeof ProgressPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
    <ProgressPrimitive.Root
        ref={ref}
        className={cn(
            'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
            className
        )}
        {...props}
    >
        <ProgressPrimitive.Indicator
            className="h-full w-full flex-1 bg-primary transition-all"
            style={{
                // Clamped: an out-of-range `value` used to translate the fill
                // outside its own track in both directions.
                transform: `translateX(-${
                    100 - Math.min(100, Math.max(0, value || 0))
                }%)`
            }}
        />
    </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };

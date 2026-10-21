import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '../../utils';

/** Provides shared tooltip context (delay, skip-delay) to descendants. */
const TooltipProvider = TooltipPrimitive.Provider;

/** Root of a single tooltip. */
const Tooltip = TooltipPrimitive.Root;

/** The element that opens the tooltip on hover/focus. */
const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * The floating tooltip panel; portalled, and eased in by `ds-tooltip-motion`
 * (styles.css) on a delayed open only — hopping between tooltips is instant.
 */
const TooltipContent = React.forwardRef<
    React.ElementRef<typeof TooltipPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
    <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
            ref={ref}
            sideOffset={sideOffset}
            className={cn(
                'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground ds-tooltip-motion origin-(--radix-tooltip-content-transform-origin)',
                className
            )}
            {...props}
        />
    </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

import { cn } from '../../utils';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

/**
 * The part that opens and closes. Eases to its own height both ways through
 * `ds-collapsible-motion` (styles.css) — Radix publishes the measured height
 * and skips the animation on first render, so a section that starts open does
 * not unfold on page load. Off under reduced motion.
 */
const CollapsibleContent = React.forwardRef<
    React.ElementRef<typeof CollapsiblePrimitive.CollapsibleContent>,
    React.ComponentPropsWithoutRef<
        typeof CollapsiblePrimitive.CollapsibleContent
    >
>(({ className, ...props }, ref) => (
    <CollapsiblePrimitive.CollapsibleContent
        ref={ref}
        className={cn('ds-collapsible-motion', className)}
        {...props}
    />
));
CollapsibleContent.displayName =
    CollapsiblePrimitive.CollapsibleContent.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };

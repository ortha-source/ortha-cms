'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '../../utils';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

/** Extra prop: portal the content into `container` instead of `document.body`. */
type PopoverContentProps = React.ComponentPropsWithoutRef<
    typeof PopoverPrimitive.Content
> & {
    /**
     * Where to portal the content. Defaults to `document.body`. Pass the DOM
     * node of a **scroll-locking** ancestor (a vaul `Drawer` / Radix `Dialog`)
     * so the popover renders inside that ancestor's allow-listed subtree —
     * otherwise react-remove-scroll blocks the popover's mouse-wheel scrolling
     * (the scrollbar still drags, but the wheel does nothing).
     */
    container?: HTMLElement | null;
};

const PopoverContent = React.forwardRef<
    React.ElementRef<typeof PopoverPrimitive.Content>,
    PopoverContentProps
>(({ className, align = 'center', sideOffset = 4, container, ...props }, ref) => (
    <PopoverPrimitive.Portal container={container ?? undefined}>
        <PopoverPrimitive.Content
            ref={ref}
            align={align}
            sideOffset={sideOffset}
            className={cn(
                'z-50 w-72 rounded-xl border bg-popover p-4 text-popover-foreground shadow-md outline-none ds-dropdown-motion origin-[--radix-popover-content-transform-origin]',
                className
            )}
            {...props}
        />
    </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };

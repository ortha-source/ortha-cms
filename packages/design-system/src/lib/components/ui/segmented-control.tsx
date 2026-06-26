import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';

import { cn } from '../../utils';

/**
 * Segmented single-select container — a padded, bordered pill that visually
 * groups a small set of mutually exclusive options (e.g. an AND/OR toggle).
 * Wraps Radix `ToggleGroup.Root` so arrow-key navigation and radiogroup
 * semantics come for free. Use with {@link SegmentedControlItem}.
 */
type SegmentedControlProps = Omit<
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>,
    'type' | 'value' | 'onValueChange' | 'defaultValue'
> & {
    /** Currently selected item value. */
    value?: string;
    /** Called when the selected item changes. */
    onValueChange?: (value: string) => void;
    /** Initial selected item value (uncontrolled). */
    defaultValue?: string;
};

const SegmentedControl = React.forwardRef<
    React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
    SegmentedControlProps
>(({ className, ...props }, ref) => (
    <ToggleGroupPrimitive.Root
        ref={ref}
        type="single"
        className={cn(
            'inline-flex items-center gap-0.5 rounded-xl border bg-background p-1 aria-invalid:border-destructive',
            className
        )}
        {...props}
    />
));
SegmentedControl.displayName = 'SegmentedControl';

/**
 * Single option within a {@link SegmentedControl}. Must be passed a unique
 * `value`. Exposes itself as a Tailwind `group` so nested elements (e.g.
 * {@link SegmentedControlCount}) can react to the active state.
 */
const SegmentedControlItem = React.forwardRef<
    React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => (
    <ToggleGroupPrimitive.Item
        ref={ref}
        className={cn(
            'group inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors',
            'hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            // Active state pairs the primary fill with a weight bump so the
            // selection is distinguishable without relying on color alone.
            'data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground',
            'disabled:pointer-events-none disabled:opacity-50',
            className
        )}
        {...props}
    >
        {children}
    </ToggleGroupPrimitive.Item>
));
SegmentedControlItem.displayName = 'SegmentedControlItem';

/**
 * Small count chip intended to sit inside a {@link SegmentedControlItem}.
 * Background and text flip when the parent item is active so the chip stays
 * legible against the primary fill.
 */
function SegmentedControlCount({
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cn(
                'inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground',
                'group-data-[state=on]:bg-white/15 group-data-[state=on]:text-primary-foreground',
                className
            )}
            {...props}
        >
            {children}
        </span>
    );
}

export { SegmentedControl, SegmentedControlItem, SegmentedControlCount };

import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../utils';
import { useDensity } from './density';
import {
    mergeRefs,
    useActiveIndicator
} from '../../hooks/use-active-indicator';

/**
 * The two jobs this control does, which want different chrome.
 *
 * `toolbar` — a filter or view switch sitting beside buttons (AND/OR, an
 * Open/Rules tab strip). It is its own object on the page, and its rounder
 * `rounded-xl` and structural `border` say so.
 *
 * `field` — a form control in a column of form controls, which is the boolean
 * field in the entry editor. There it has to match `Input`, `Textarea` and
 * `SelectTrigger` exactly or it reads as a foreign object dropped into the form:
 * the same `rounded-lg`, the same `border-input` (a deliberately *darker* token
 * than `border`, so an editable surface is distinguishable from a card edge),
 * and the same 36px height — `h-9` on the box with `h-7` items inside its
 * `p-1`, since the default's 38px left the boolean field two pixels taller than
 * every field around it.
 */
const segmentedControlVariants = cva(
    'inline-flex items-center gap-0.5 border bg-background p-1 aria-invalid:border-destructive',
    {
        variants: {
            variant: {
                toolbar: 'rounded-xl',
                field: 'h-9 rounded-lg border-input [&>*]:h-7'
            }
        },
        defaultVariants: {
            variant: 'toolbar'
        }
    }
);

/**
 * Segmented single-select container — a padded, bordered pill that visually
 * groups a small set of mutually exclusive options (e.g. an AND/OR toggle).
 * Wraps Radix `ToggleGroup.Root` so arrow-key navigation and radiogroup
 * semantics come for free. Use with {@link SegmentedControlItem}.
 */
type SegmentedControlProps = Omit<
    React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>,
    'type' | 'value' | 'onValueChange' | 'defaultValue'
> &
    VariantProps<typeof segmentedControlVariants> & {
        /** Currently selected item value. */
        value?: string;
        /** Called when the selected item changes. */
        onValueChange?: (value: string) => void;
        /** Initial selected item value (uncontrolled). */
        defaultValue?: string;
        /**
         * Classes for the sliding selection pill. A caller that recolours the
         * selected item (`data-[state=on]:bg-…` on its items) passes the same
         * fill here: while the pill is live it *is* the selected fill, and the
         * item's own background is cleared.
         */
        indicatorClassName?: string;
    };

const SegmentedControl = React.forwardRef<
    React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
    SegmentedControlProps
>(({ className, variant, indicatorClassName, children, ...props }, ref) => {
    // Compact steps the toolbar variant down to the 32px line the buttons
    // beside it take there. The field variant is a form control and keeps
    // matching `Input`, whatever region it sits in.
    const compact = useDensity() === 'compact' && variant !== 'field';
    // The selected fill is one pill that slides between items, rather than
    // each item painting its own — see `useActiveIndicator`.
    const indicator = useActiveIndicator<HTMLDivElement>('[data-state=on]');
    const rootRef = React.useMemo(
        () => mergeRefs(ref, indicator.ref),
        [ref, indicator.ref]
    );
    const { rect, settled } = indicator;
    return (
        <ToggleGroupPrimitive.Root
            ref={rootRef}
            type="single"
            data-indicator={rect ? 'live' : undefined}
            className={cn(
                'group/segmented relative',
                segmentedControlVariants({ variant }),
                compact && 'h-8 p-[3px] [&>*]:h-6 [&>*]:px-2.5',
                className
            )}
            {...props}
        >
            {/* First in the DOM and the items `relative`, so they paint over
                it. A background, so `forced-colors` drops it — the selected
                item's `Highlight` border in styles.css carries that mode. */}
            {rect ? (
                <span
                    aria-hidden
                    data-slot="segmented-indicator"
                    className={cn(
                        'pointer-events-none absolute left-0 top-0 rounded-lg bg-primary',
                        settled &&
                            'transition-[translate,width,height] duration-(--ds-duration-base) ease-(--ds-ease-out) motion-reduce:transition-none',
                        indicatorClassName
                    )}
                    style={{
                        width: rect.width,
                        height: rect.height,
                        translate: `${rect.x}px ${rect.y}px`
                    }}
                />
            ) : null}
            {children}
        </ToggleGroupPrimitive.Root>
    );
});
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
            'group relative inline-flex h-7 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-muted-foreground transition-colors duration-(--ds-duration-base)',
            'hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            // Active state pairs the primary fill with a weight bump so the
            // selection is distinguishable without relying on color alone.
            'data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground',
            // While the root's sliding pill is live it is the fill.
            'group-data-[indicator=live]/segmented:data-[state=on]:bg-transparent',
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

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { ListFilter } from 'lucide-react';
import { Button, cn } from '@orthacms/design-system';

/** Props for {@link FiltersIconButton}. */
export type FiltersIconButtonProps = ComponentPropsWithoutRef<typeof Button> & {
    /** Applied-rule count, drawn as a corner badge when non-zero. */
    count: number;
    /** The localized accessible name — it carries the count as words. */
    label: string;
};

/**
 * The standard `QueryBuilderPopover` trigger: an icon-only outline button
 * (32px under a toolbar's compact density) whose applied-rule count sits on its
 * corner as a badge. Forwards its ref and props, because it is rendered through
 * `TooltipTrigger asChild` → `PopoverTrigger asChild`, which is how it receives
 * `aria-expanded`, `aria-controls` and its click handler.
 */
export const FiltersIconButton = forwardRef<
    HTMLButtonElement,
    FiltersIconButtonProps
>(({ count, label, className, ...props }, ref) => (
    <Button
        ref={ref}
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        className={cn('relative shadow-none', className)}
        {...props}
    >
        <ListFilter aria-hidden />
        {count > 0 ? (
            // The count is already in the accessible name ("Filters, 2
            // applied"); this is its visual twin, so it is hidden from
            // assistive tech rather than read twice.
            <span
                aria-hidden
                data-testid="qb-filter-count"
                className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums ring-2 ring-background"
            >
                {count}
            </span>
        ) : null}
    </Button>
));
FiltersIconButton.displayName = 'FiltersIconButton';

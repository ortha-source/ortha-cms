import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ListFilter } from 'lucide-react';
import { Button, cn } from '@orthacms/design-system';

/** Intl descriptors for {@link ActivityFilterButton}, co-located. */
const messages = defineMessages({
    text: { id: 'activity.filter.trigger', defaultMessage: 'Filter' },
    label: {
        id: 'activity.filter.triggerLabel',
        // Starts with the visible word, so the name a voice-control user reads
        // off the button is the name that activates it (WCAG 2.5.3); the count
        // rides along as words because the badge is hidden from AT.
        defaultMessage:
            '{count, plural, =0 {Filters} one {Filters, # applied} other {Filters, # applied}}'
    }
});

/**
 * The toolbar's "Filter" button — the trigger handed to `QueryBuilderPopover`.
 *
 * A labelled button rather than the popover's default icon-only one, because
 * this page's toolbar spells its controls out ("Last 7 days", "Filter"). Same
 * contract as the default: it forwards its ref and props (the popover renders
 * it through `PopoverTrigger asChild`, which is how it gets `aria-expanded`
 * and its click handler), and the applied-rule count sits on the corner as a
 * badge with the same test id.
 */
export const ActivityFilterButton = forwardRef<
    HTMLButtonElement,
    ComponentPropsWithoutRef<typeof Button> & { count: number }
>(({ count, className, ...props }, ref) => {
    const intl = useIntl();
    return (
        <Button
            ref={ref}
            type="button"
            variant="outline"
            aria-label={intl.formatMessage(messages.label, { count })}
            className={cn('relative shadow-none', className)}
            {...props}
        >
            <ListFilter aria-hidden />
            {intl.formatMessage(messages.text)}
            {count > 0 ? (
                <span
                    aria-hidden
                    data-testid="qb-filter-count"
                    className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums ring-2 ring-background"
                >
                    {count}
                </span>
            ) : null}
        </Button>
    );
});
ActivityFilterButton.displayName = 'ActivityFilterButton';

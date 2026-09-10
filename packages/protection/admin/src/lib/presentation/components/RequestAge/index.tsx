import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';

const messages = defineMessages({
    days: {
        id: 'protection.queue.age.days',
        defaultMessage: '{days, plural, one {# day} other {# days}} waiting'
    },
    hours: {
        id: 'protection.queue.age.hours',
        defaultMessage: '{hours, plural, one {# hour} other {# hours}} waiting'
    },
    fresh: { id: 'protection.queue.age.fresh', defaultMessage: 'Just now' },
    overdue: { id: 'protection.queue.age.overdue', defaultMessage: 'overdue' }
});

/** After how long a request reads as overdue. Matches the Insights card's cut. */
export const OVERDUE_AFTER_DAYS = 3;

/** Whole days between `iso` and `now`, floored; clock skew reads as 0. */
export function ageInDays(iso: string, now = Date.now()): number {
    const started = Date.parse(iso);
    if (Number.isNaN(started)) return 0;
    return Math.max(0, Math.floor((now - started) / 86_400_000));
}

/** Whole hours, for the under-a-day case. */
function ageInHours(iso: string, now = Date.now()): number {
    const started = Date.parse(iso);
    if (Number.isNaN(started)) return 0;
    return Math.max(0, Math.floor((now - started) / 3_600_000));
}

/**
 * How long an ask has been waiting.
 *
 * **The warning tone is never the only signal.** A request past
 * {@link OVERDUE_AFTER_DAYS} is coloured *and* carries the word "overdue" in
 * its text, so the fact survives a greyscale screen, a colour-blind reader and
 * a screen reader alike. It is the rule a queue gets wrong most easily, because
 * "this one is old" feels like something red says by itself.
 *
 * The exact moment rides `<time datetime>` rather than the rounded phrase, so
 * nothing is lost to the rounding.
 */
export function RequestAge({ createdAt }: { createdAt: string }) {
    const intl = useIntl();
    const days = ageInDays(createdAt);
    const hours = ageInHours(createdAt);
    const overdue = days >= OVERDUE_AFTER_DAYS;

    const waited = days
        ? intl.formatMessage(messages.days, { days })
        : hours
          ? intl.formatMessage(messages.hours, { hours })
          : intl.formatMessage(messages.fresh);

    return (
        <time
            dateTime={createdAt}
            className={cn(
                'text-sm',
                overdue
                    ? 'text-warning-soft-foreground'
                    : 'text-muted-foreground'
            )}
        >
            {overdue
                ? `${waited} — ${intl.formatMessage(messages.overdue)}`
                : waited}
        </time>
    );
}

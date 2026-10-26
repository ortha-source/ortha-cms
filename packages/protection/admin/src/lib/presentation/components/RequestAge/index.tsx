import { defineMessages, useIntl } from 'react-intl';
import { Badge } from '@orthacms/design-system';

const messages = defineMessages({
    days: {
        id: 'protection.queue.age.days',
        defaultMessage: '{days, plural, one {# day} other {# days}}'
    },
    hours: {
        id: 'protection.queue.age.hours',
        defaultMessage: '{hours, plural, one {# hour} other {# hours}}'
    },
    minutes: {
        id: 'protection.queue.age.minutes',
        defaultMessage: '{minutes} min'
    },
    fresh: { id: 'protection.queue.age.fresh', defaultMessage: 'Just now' },
    overdue: { id: 'protection.queue.age.overdue', defaultMessage: 'Overdue' }
});

/** Whole units of `unitMs` between `iso` and `now`, floored; skew reads as 0. */
function elapsed(iso: string, unitMs: number, now: number): number {
    const started = Date.parse(iso);
    if (Number.isNaN(started)) return 0;
    return Math.max(0, Math.floor((now - started) / unitMs));
}

/** Whole days between `iso` and `now`, floored; clock skew reads as 0. */
export function ageInDays(iso: string, now = Date.now()): number {
    return elapsed(iso, 86_400_000, now);
}

/**
 * Whether an ask opened at `iso` is past the server's overdue cut — the one
 * test the table's badge and the side panel's header both make.
 */
export function isOverdue(
    iso: string,
    overdueAfterDays: number,
    now = Date.now()
): boolean {
    return ageInDays(iso, now) >= overdueAfterDays;
}

/**
 * How long an ask has been waiting — "5 days", "3 hours", "20 min" — and,
 * once it is past the cut, an **Overdue** badge beside it.
 *
 * **The warning tone is never the only signal.** An overdue request carries
 * the word in a badge, so the fact survives a greyscale screen, a colour-blind
 * reader and a screen reader alike. It is the rule a queue gets wrong most
 * easily, because "this one is old" feels like something red says by itself.
 *
 * The exact moment rides `<time datetime>` rather than the rounded phrase, so
 * nothing is lost to the rounding; the column header ("Waiting") says what the
 * duration is of.
 */
export function RequestAge({
    createdAt,
    overdueAfterDays
}: {
    createdAt: string;
    /**
     * After how long an ask reads as overdue — **the server's threshold, sent
     * with the queue**, not a constant restated here.
     *
     * It used to be a `3` in this file and a `3` in
     * `protection-insights.query.ts`, which is two numbers that must agree and
     * nothing making them: changing the server's to 7 left this queue calling
     * five-day asks overdue while the Insights card said "waiting longer than 7
     * days", with every suite green. The card already takes its threshold off
     * the wire for exactly that reason; this is the same rule applied to the
     * page the card links to.
     */
    overdueAfterDays: number;
}) {
    const intl = useIntl();
    const now = Date.now();
    const days = ageInDays(createdAt, now);
    const hours = elapsed(createdAt, 3_600_000, now);
    const minutes = elapsed(createdAt, 60_000, now);
    const overdue = days >= overdueAfterDays;

    const waited = days
        ? intl.formatMessage(messages.days, { days })
        : hours
          ? intl.formatMessage(messages.hours, { hours })
          : minutes
            ? intl.formatMessage(messages.minutes, { minutes })
            : intl.formatMessage(messages.fresh);

    return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <time dateTime={createdAt} className="text-sm">
                {waited}
            </time>
            {overdue ? <OverdueBadge /> : null}
        </span>
    );
}

/** The word, in the destructive tint — never the tint alone. */
export function OverdueBadge() {
    const intl = useIntl();
    return (
        <Badge variant="destructive-soft" size="xs">
            {intl.formatMessage(messages.overdue)}
        </Badge>
    );
}

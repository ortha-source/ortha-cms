import { defineMessages, type MessageDescriptor } from 'react-intl';

/**
 * The time ranges the Activity page offers, as they travel in the URL
 * (`?range=`). Every one is anchored on a **calendar day** in the reader's own
 * timezone — "Last 7 days" is today and the six before it, from midnight — so
 * the computed `from` is the same instant for every render of a given day.
 * A sliding "now minus 24 hours" would change the request (and the query key)
 * every time the page re-rendered.
 */
export const ACTIVITY_RANGES = ['today', '7d', '30d', '90d', 'all'] as const;

/** One of {@link ACTIVITY_RANGES}. */
export type ActivityRange = (typeof ACTIVITY_RANGES)[number];

/**
 * The range the page opens on when the URL names none — the week, as the
 * page's subtitle says ("… in the last 7 days"). `all` is an explicit choice
 * (`?range=all`), so a deep link to the whole log stays one.
 */
export const DEFAULT_RANGE: ActivityRange = '7d';

/** How many calendar days each bounded range covers, today included. */
const DAYS: Record<Exclude<ActivityRange, 'all'>, number> = {
    today: 1,
    '7d': 7,
    '30d': 30,
    '90d': 90
};

/** The select's option labels, co-located with the vocabulary they name. */
export const RANGE_MESSAGES: Record<ActivityRange, MessageDescriptor> =
    defineMessages({
        today: { id: 'activity.range.today', defaultMessage: 'Today' },
        '7d': { id: 'activity.range.7d', defaultMessage: 'Last 7 days' },
        '30d': { id: 'activity.range.30d', defaultMessage: 'Last 30 days' },
        '90d': { id: 'activity.range.90d', defaultMessage: 'Last 90 days' },
        all: { id: 'activity.range.all', defaultMessage: 'All time' }
    });

/**
 * The URL's `range` as a known range — the default for an absent or unknown
 * value, so a hand-edited `?range=week` reads as the default rather than as no
 * bound at all.
 */
export function parseRange(raw: string | null | undefined): ActivityRange {
    return (ACTIVITY_RANGES as readonly string[]).includes(raw ?? '')
        ? (raw as ActivityRange)
        : DEFAULT_RANGE;
}

/**
 * The inclusive start of `range` relative to `now` — local midnight of the
 * range's first day — or `null` for `all`.
 */
export function rangeStart(range: ActivityRange, now: Date): Date | null {
    if (range === 'all') {
        return null;
    }
    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (DAYS[range] - 1)
    );
}

/** The number of days a bounded range covers, for "in the last N days". */
export function rangeDays(range: ActivityRange): number | null {
    return range === 'all' ? null : DAYS[range];
}

/**
 * How long ago something happened, bucketed the way the members roster and the
 * member page say it: "Now", "12 min ago", "1 h ago", "Yesterday",
 * "3 days ago", and past a week the date itself. Pure — the caller passes
 * `now`, and the presentation maps each bucket to a localized message.
 */
export type Recency =
    | { kind: 'now' }
    | { kind: 'minutes'; value: number }
    | { kind: 'hours'; value: number }
    | { kind: 'yesterday' }
    | { kind: 'days'; value: number }
    | { kind: 'date'; date: Date };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Calendar days between two instants, by local midnight. */
function calendarDaysBetween(earlier: Date, later: Date): number {
    const a = new Date(
        earlier.getFullYear(),
        earlier.getMonth(),
        earlier.getDate()
    );
    const b = new Date(later.getFullYear(), later.getMonth(), later.getDate());
    return Math.round((b.getTime() - a.getTime()) / (24 * HOUR));
}

/**
 * Buckets `date` relative to `now`.
 *
 * Under a minute is "now" (a session's `last_used_at` is refreshed on a
 * throttle, so second-level precision would be noise). Under an hour counts
 * minutes; the rest of **today** counts hours. Calendar days decide the rest,
 * so 23:50 last night seen at 08:00 is "Yesterday", not "8 h ago". A week or
 * more is the date. A timestamp in the future — clock skew between the server
 * and this browser — reads as "now" rather than as a negative age.
 */
export function recencyOf(date: Date, now: Date = new Date()): Recency {
    const elapsed = now.getTime() - date.getTime();
    if (elapsed < MINUTE) {
        return { kind: 'now' };
    }
    if (elapsed < HOUR) {
        return { kind: 'minutes', value: Math.floor(elapsed / MINUTE) };
    }
    const days = calendarDaysBetween(date, now);
    if (days <= 0) {
        return { kind: 'hours', value: Math.floor(elapsed / HOUR) };
    }
    if (days === 1) {
        return { kind: 'yesterday' };
    }
    if (days < 7) {
        return { kind: 'days', value: days };
    }
    return { kind: 'date', date };
}

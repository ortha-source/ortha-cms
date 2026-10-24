/** Which day heading an event falls under. */
export type ActivityDayKind = 'today' | 'yesterday' | 'date';

/** A run of events that share a calendar day, in the order they arrived. */
export type ActivityDayGroup<T> = {
    /** Stable key for the group: `YYYY-M-D` in the reader's timezone. */
    key: string;
    /** Today, yesterday, or an older date. */
    kind: ActivityDayKind;
    /** The day's date, for formatting an older heading. */
    date: Date;
    /** The events, in the order the server sorted them. */
    events: T[];
};

/** Calendar days between two instants, in the reader's own timezone. */
export function daysBetween(at: Date, now: Date): number {
    const day = (d: Date) =>
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
    return day(now) - day(at);
}

/**
 * Splits a list into runs of the same calendar day — the feed's "Today",
 * "Yesterday", "Oct 21" headings.
 *
 * **Runs, not buckets, and no re-sorting.** The server decides the order (newest
 * first by default) and the feed renders it as given; a new group starts
 * wherever the day changes. Sorting here would make the page disagree with the
 * export and with the next page.
 *
 * An event whose `at` is an `Invalid Date` (`activity:I-25`) gets a group of
 * its own kind `date` keyed `invalid` — it is rendered, never dropped and never
 * given an invented day.
 */
export function groupByDay<T extends { at: Date }>(
    events: readonly T[],
    now: Date
): ActivityDayGroup<T>[] {
    const groups: ActivityDayGroup<T>[] = [];
    for (const event of events) {
        const valid = !Number.isNaN(event.at.getTime());
        const key = valid
            ? `${event.at.getFullYear()}-${event.at.getMonth() + 1}-${event.at.getDate()}`
            : 'invalid';
        const last = groups[groups.length - 1];
        if (last?.key === key) {
            last.events.push(event);
            continue;
        }
        const days = valid ? daysBetween(event.at, now) : Number.NaN;
        groups.push({
            key,
            kind: days === 0 ? 'today' : days === 1 ? 'yesterday' : 'date',
            date: event.at,
            events: [event]
        });
    }
    return groups;
}

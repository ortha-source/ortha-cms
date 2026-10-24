import type {
    InsightsRecordTypeCountView,
    StaleAge
} from '../../types/content-insights-view';

/** Every {@link StaleAge}, in the order the panel offers them. */
export const STALE_AGES: readonly StaleAge[] = ['recent', 'months', 'year'];

/** Default rows a drill-down lists when the caller states no limit. */
export const DEFAULT_DRILL_LIMIT = 20;

/** Most rows a drill-down may list — it is a side panel, not a table. */
export const MAX_DRILL_LIMIT = 50;

/**
 * The last-edit window of an age band, in whole days before now.
 *
 * `fromDays` is the inclusive near edge (edited at least that long ago) and
 * `toDays` the exclusive far edge, or `null` for "and everything older". The
 * edges are the stale chart's own (30 / 90 / 365), so the panel's "Over a year"
 * holds exactly the records the chart's "Over a year" bar counts.
 */
export function staleAgeWindow(age: StaleAge): {
    fromDays: number;
    toDays: number | null;
} {
    switch (age) {
        case 'recent':
            return { fromDays: 30, toDays: 90 };
        case 'months':
            return { fromDays: 90, toDays: 365 };
        case 'year':
            return { fromDays: 365, toDays: null };
    }
}

/** Narrows a query-string value to a {@link StaleAge}, defaulting to `year`. */
export function toStaleAge(raw: string | undefined): StaleAge {
    return (STALE_AGES as readonly string[]).includes(raw ?? '')
        ? (raw as StaleAge)
        : 'year';
}

/** A query-string limit, clamped to `1..MAX_DRILL_LIMIT`. */
export function toDrillLimit(raw: string | number | undefined): number {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_DRILL_LIMIT;
    return Math.min(parsed, MAX_DRILL_LIMIT);
}

/**
 * The oldest `limit` candidates across every type, oldest first.
 *
 * Each type contributes its own oldest `limit` rows, so the union holds the
 * global oldest `limit` whatever the split — this is the merge step of that
 * k-way read. Ties break on id so the list is stable between two reads.
 */
export function oldestFirst<T extends { updatedAt: Date; id: string }>(
    candidates: readonly T[],
    limit: number
): T[] {
    return [...candidates]
        .sort(
            (a, b) =>
                a.updatedAt.getTime() - b.updatedAt.getTime() ||
                a.id.localeCompare(b.id)
        )
        .slice(0, limit);
}

/** Per-type counts biggest first, ties by label, empty types dropped. */
export function sortTypeCounts(
    counts: readonly InsightsRecordTypeCountView[]
): InsightsRecordTypeCountView[] {
    return counts
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * The weekday with the most events, or `null` when there were none. Ties go to
 * the earlier weekday so the answer does not depend on row order.
 */
export function busiestWeekday(
    counts: ReadonlyMap<number, number>
): number | null {
    let best: number | null = null;
    let bestCount = 0;
    for (const weekday of [...counts.keys()].sort((a, b) => a - b)) {
        const count = counts.get(weekday) ?? 0;
        if (count > bestCount) {
            best = weekday;
            bestCount = count;
        }
    }
    return best;
}

/** The zone a punchcard is grouped in when the caller names none usable. */
export const DEFAULT_TIME_ZONE = 'UTC';

/**
 * A caller's `?tz=` if it is a well-formed IANA zone this runtime knows, else
 * `UTC`.
 *
 * Checked here rather than left to Postgres: the zone is bound into the query,
 * and an unknown name there is an error rather than a fallback. A garbled value
 * from a hand-edited link should still draw the grid, in a zone the caption
 * then names honestly.
 */
export function normaliseTimeZone(raw: string | undefined): string {
    if (!raw || raw.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(raw)) {
        return DEFAULT_TIME_ZONE;
    }
    try {
        return new Intl.DateTimeFormat('en-US', { timeZone: raw })
            .resolvedOptions()
            .timeZone;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
}

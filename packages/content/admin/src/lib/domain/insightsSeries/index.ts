/** A bucket width the server groups a time series by. */
export type SeriesGranularity = 'day' | 'week' | 'month';

/** One point of a time series, keyed by its bucket start (`YYYY-MM-DD`). */
export type SeriesPoint = { bucket: string; value: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` of a UTC instant. */
function isoDay(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/** The start of the bucket holding `date`, in UTC — `date_trunc` client-side. */
function bucketStart(date: Date, granularity: SeriesGranularity): Date {
    const day = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    if (granularity === 'day') return day;
    if (granularity === 'month') {
        return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
    }
    // ISO weeks start on Monday, as Postgres' `date_trunc('week', …)` does.
    const sinceMonday = (day.getUTCDay() + 6) % 7;
    return new Date(day.getTime() - sinceMonday * DAY_MS);
}

/** The start of the bucket after `start`. */
function nextBucket(start: Date, granularity: SeriesGranularity): Date {
    if (granularity === 'day') return new Date(start.getTime() + DAY_MS);
    if (granularity === 'week') return new Date(start.getTime() + 7 * DAY_MS);
    return new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)
    );
}

/**
 * The window's series with **every bucket present**, empty ones at zero.
 *
 * The server sends only the buckets something happened in, so a quiet week
 * simply isn't in the list — and a column chart drawn from that list closes the
 * gap, putting Monday's column beside Thursday's as if they were neighbours.
 * A day with no publishes is a column of zero, not a missing one.
 *
 * Buckets run from the one holding `now - days` to the one holding `now`, in
 * UTC — the server's own `date_trunc` — and any server bucket outside that
 * span is kept rather than dropped, so the total can never disagree with it.
 */
export function denseSeries(
    points: readonly SeriesPoint[],
    granularity: SeriesGranularity,
    days: number,
    now: Date = new Date()
): SeriesPoint[] {
    const values = new Map(points.map((point) => [point.bucket, point.value]));
    const out: SeriesPoint[] = [];
    const last = bucketStart(now, granularity).getTime();
    let cursor = bucketStart(new Date(now.getTime() - days * DAY_MS), granularity);
    // Bounded: a 365-day window is at most 366 daily buckets, and the server
    // never picks `day` for one.
    for (let guard = 0; cursor.getTime() <= last && guard < 400; guard++) {
        const bucket = isoDay(cursor);
        out.push({ bucket, value: values.get(bucket) ?? 0 });
        values.delete(bucket);
        cursor = nextBucket(cursor, granularity);
    }
    for (const [bucket, value] of values) out.push({ bucket, value });
    return out.sort((a, b) => a.bucket.localeCompare(b.bucket));
}

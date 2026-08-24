/**
 * The Insights time window as a value — the range set, the days each covers,
 * and the query-string round-trip.
 *
 * Split out of `useInsightsRange` so the parsing rules are reachable without a
 * browser: the hook is React and router plumbing, and the questions worth
 * pinning down (what an unknown `?range=` does, whether the default appears in
 * the URL) are pure. Same reason `resolveInsightsLayout` lives here.
 */

/** The time windows the Insights page offers. */
export const INSIGHTS_RANGES = ['7d', '30d', '90d', '12m'] as const;

/** A selected Insights time window. */
export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

/** Day count each range covers — what widgets send to their endpoint. */
export const RANGE_DAYS: Record<InsightsRange, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '12m': 365
};

/** The default window — long enough to show a trend, short enough to be current. */
export const DEFAULT_RANGE: InsightsRange = '30d';

/** The query param carrying the selection (`/insights?range=90d`). */
export const INSIGHTS_RANGE_PARAM = 'range';

/**
 * Reads a range off the query string.
 *
 * Anything unrecognised — a typo, a hand-edited URL, a link written against a
 * range this version dropped — falls back to the default rather than throwing
 * or rendering an empty dashboard. The page has no way to tell a user their URL
 * is wrong, so the useful behaviour is the one that still shows numbers.
 */
export function parseInsightsRange(
    raw: string | null | undefined
): InsightsRange {
    if (!raw) return DEFAULT_RANGE;
    return (INSIGHTS_RANGES as readonly string[]).includes(raw)
        ? (raw as InsightsRange)
        : DEFAULT_RANGE;
}

/**
 * The query-param value for a selection, or `undefined` when it is the default.
 *
 * The default is left **out** of the URL on purpose. A bare `/insights` link
 * saved today should keep meaning "whatever the current default window is"; if
 * selecting 30d wrote `?range=30d`, every bookmark taken from the page would
 * pin itself to today's default forever, and changing that default later would
 * silently not reach any of them.
 */
export function insightsRangeParam(range: InsightsRange): string | undefined {
    return range === DEFAULT_RANGE ? undefined : range;
}

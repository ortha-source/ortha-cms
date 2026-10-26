/**
 * Which tab of the Insights page is showing and which drill-down is open, as
 * values — and their query-string round-trip.
 *
 * Both live in the URL, for the reason the range does: a view someone is
 * describing has to be the view they can paste. `?tab=content` opens on the
 * Content tab; `?signal=content.stale` opens on the "Gone quiet" records. The
 * rules mirror `insightsRange`'s and are pinned the same way, without a
 * browser.
 */

/** The query param carrying the selected tab (a section id). */
export const INSIGHTS_TAB_PARAM = 'tab';

/** The query param carrying the open drill-down (a signal id). */
export const INSIGHTS_SIGNAL_PARAM = 'signal';

/**
 * The tab to show: the one the URL names when it is among `available`, else
 * the first one.
 *
 * An unknown or forbidden tab — a stale link, a band whose every widget this
 * reader may not see — falls back to the first tab rather than an empty page,
 * for the same reason an unknown range falls back to the default.
 */
export function resolveInsightsTab(
    raw: string | null | undefined,
    available: readonly string[]
): string | undefined {
    if (raw && available.includes(raw)) return raw;
    return available[0];
}

/**
 * The query-param value for a tab, or `undefined` for the first one.
 *
 * The first tab stays **out** of the URL, as the default range does: a bare
 * `/insights` link keeps meaning "the page as it opens".
 */
export function insightsTabParam(
    tab: string,
    available: readonly string[]
): string | undefined {
    return tab === available[0] ? undefined : tab;
}

/**
 * The open drill-down: the signal the URL names when the reader may see it,
 * else none. A link to a line this reader cannot see opens nothing rather than
 * a panel about something they were not shown.
 */
export function resolveInsightsSignal(
    raw: string | null | undefined,
    available: readonly string[]
): string | null {
    return raw && available.includes(raw) ? raw : null;
}

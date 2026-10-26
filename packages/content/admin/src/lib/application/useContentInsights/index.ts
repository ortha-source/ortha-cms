import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@orthacms/utils-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useInsightsRange } from '@orthacms/insights-admin';
import { CONTENT_READ } from '../../domain/constants';
import { contentInsightsKeys } from '../../infrastructure/contentInsightsKeys';
import { httpContentInsightsGateway } from '../../infrastructure/httpContentInsightsGateway';
import type { StaleAge } from '../../infrastructure/contentInsightsGateway';

/**
 * Loads the headline content counts for the stat tiles.
 *
 * All three content stat widgets call this. They stay **separate widgets** —
 * each renders its own pending and error state — but they share one query key,
 * so TanStack Query dedupes them into a single request. Independent loaders
 * without three round-trips for one aggregate.
 */
export function useContentTotals() {
    const workspace = useCurrentWorkspace();
    const { days } = useInsightsRange();
    const canRead = useHasPermission(CONTENT_READ);

    return useQuery({
        queryKey: contentInsightsKeys.totals(workspace.id, days),
        queryFn: () => httpContentInsightsGateway.totals(days),
        staleTime: STALE_TIME.Standard,
        // One retry, not TanStack's default three. A widget that cannot load
        // must SAY so, and three attempts with exponential backoff leave it
        // sitting on a skeleton for about seven seconds first — on a page whose
        // whole premise is that one failing card degrades alone, that reads as
        // a hang rather than a failure. One retry still covers a transient blip.
        retry: 1,
        enabled: canRead
    });
}

/**
 * Loads published entries bucketed by how long ago they were last edited.
 *
 * Takes no range — the buckets are the time axis, and they are fixed so the
 * answer means the same thing whatever the page's range is set to.
 */
export function useContentStale() {
    const workspace = useCurrentWorkspace();
    const canRead = useHasPermission(CONTENT_READ);

    return useQuery({
        queryKey: contentInsightsKeys.stale(workspace.id),
        queryFn: () => httpContentInsightsGateway.stale(),
        staleTime: STALE_TIME.Standard,
        // One retry, not TanStack's default three. A widget that cannot load
        // must SAY so, and three attempts with exponential backoff leave it
        // sitting on a skeleton for about seven seconds first — on a page whose
        // whole premise is that one failing card degrades alone, that reads as
        // a hang rather than a failure. One retry still covers a transient blip.
        retry: 1,
        enabled: canRead
    });
}

/** Loads the draft/published split per content type. A snapshot, not a window. */
export function useContentPipeline() {
    const workspace = useCurrentWorkspace();
    const canRead = useHasPermission(CONTENT_READ);

    return useQuery({
        queryKey: contentInsightsKeys.pipeline(workspace.id),
        queryFn: () => httpContentInsightsGateway.pipeline(),
        staleTime: STALE_TIME.Standard,
        // One retry, not TanStack's default three. A widget that cannot load
        // must SAY so, and three attempts with exponential backoff leave it
        // sitting on a skeleton for about seven seconds first — on a page whose
        // whole premise is that one failing card degrades alone, that reads as
        // a hang rather than a failure. One retry still covers a transient blip.
        retry: 1,
        enabled: canRead
    });
}

/**
 * Loads live entries carrying unpublished edits, per type and in total.
 *
 * Takes no range, like `stale`: a pending edit is pending whether it was made
 * this morning or last spring, so a window could only hide part of the backlog.
 */
export function useContentUnshipped() {
    const workspace = useCurrentWorkspace();
    const canRead = useHasPermission(CONTENT_READ);

    return useQuery({
        queryKey: contentInsightsKeys.unshipped(workspace.id),
        queryFn: () => httpContentInsightsGateway.unshipped(),
        staleTime: STALE_TIME.Standard,
        // One retry, not TanStack's default three. A widget that cannot load
        // must SAY so, and three attempts with exponential backoff leave it
        // sitting on a skeleton for about seven seconds first — on a page whose
        // whole premise is that one failing card degrades alone, that reads as
        // a hang rather than a failure. One retry still covers a transient blip.
        retry: 1,
        enabled: canRead
    });
}

/** Loads entries published per time bucket across the selected range. */
export function useContentVelocity() {
    const workspace = useCurrentWorkspace();
    const { days } = useInsightsRange();
    const canRead = useHasPermission(CONTENT_READ);

    return useQuery({
        queryKey: contentInsightsKeys.velocity(workspace.id, days),
        queryFn: () => httpContentInsightsGateway.velocity(days),
        staleTime: STALE_TIME.Standard,
        // One retry, not TanStack's default three. A widget that cannot load
        // must SAY so, and three attempts with exponential backoff leave it
        // sitting on a skeleton for about seven seconds first — on a page whose
        // whole premise is that one failing card degrades alone, that reads as
        // a hang rather than a failure. One retry still covers a transient blip.
        retry: 1,
        enabled: canRead
    });
}

/** The viewer's IANA time zone, or `UTC` when the runtime cannot say. */
export function viewerTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
}

/**
 * Loads editing activity by weekday and hour across the selected range,
 * grouped in the viewer's own time zone — "Tuesday at 9" is their Tuesday.
 */
export function useContentPunchcard() {
    const workspace = useCurrentWorkspace();
    const { days } = useInsightsRange();
    const canRead = useHasPermission(CONTENT_READ);
    const timeZone = viewerTimeZone();

    return useQuery({
        queryKey: contentInsightsKeys.punchcard(workspace.id, days, timeZone),
        queryFn: () => httpContentInsightsGateway.punchcard(days, timeZone),
        staleTime: STALE_TIME.Standard,
        // One retry, not TanStack's default three. A widget that cannot load
        // must SAY so, and three attempts with exponential backoff leave it
        // sitting on a skeleton for about seven seconds first — on a page whose
        // whole premise is that one failing card degrades alone, that reads as
        // a hang rather than a failure. One retry still covers a transient blip.
        retry: 1,
        enabled: canRead
    });
}

/** How many records a drill-down panel lists. */
export const DRILL_LIMIT = 20;

/**
 * Loads the published records in one age band — the "Gone quiet" panel.
 * Mounted only while the panel is open, so it costs nothing until asked.
 */
export function useContentStaleRecords(age: StaleAge) {
    const workspace = useCurrentWorkspace();
    const canRead = useHasPermission(CONTENT_READ);

    return useQuery({
        queryKey: contentInsightsKeys.staleRecords(workspace.id, age),
        queryFn: () => httpContentInsightsGateway.staleRecords(age, DRILL_LIMIT),
        staleTime: STALE_TIME.Standard,
        // One retry, as every Insights read (`[insights:I-16]`).
        retry: 1,
        enabled: canRead
    });
}

/** Loads the live records carrying unpublished edits — "Waiting to go live". */
export function useContentUnshippedRecords() {
    const workspace = useCurrentWorkspace();
    const canRead = useHasPermission(CONTENT_READ);

    return useQuery({
        queryKey: contentInsightsKeys.unshippedRecords(workspace.id),
        queryFn: () => httpContentInsightsGateway.unshippedRecords(DRILL_LIMIT),
        staleTime: STALE_TIME.Standard,
        // One retry, as every Insights read (`[insights:I-16]`).
        retry: 1,
        enabled: canRead
    });
}

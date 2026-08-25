import { ALARM_SEVERITIES, type AlarmSeverity } from '../domain/alarm-severity';
import type { AlarmFindingView } from '../types/alarm-views';

/**
 * One finding as the tool returns it.
 *
 * Deliberately **not** `AlarmFindingView`. That type is the admin's wire
 * contract and carries `detail` — an open jsonb bag whose shape belongs to the
 * rule that wrote it — plus `firstSeenAt`/`lastSeenAt` as raw ISO strings. A
 * model reading this needs neither: an opaque payload it cannot interpret is
 * tokens spent on noise, and two timestamps invite it to do date arithmetic
 * badly. What it needs is what is wrong, on which record, and how long that has
 * been true.
 */
export interface FindingToolItem {
    /** What the editor is told, e.g. "Author is not published". */
    title: string;
    /** The alarm that produced it, in the language of editorial policy. */
    rule: string;
    severity: AlarmSeverity;
    contentType: string;
    /** The entry id, so a follow-up `admin_content_get` can open it. */
    entryId: string;
    /** Whole days since the finding first appeared. */
    openForDays: number;
}

/** What `admin_alarms_findings` returns. */
export interface FindingsToolOutput {
    /**
     * Findings matching the query. Named `items` on purpose: the run engine's
     * `summarizeToolOutput` is shape-driven, so `{ items, total }` yields
     * "14 results" in the transcript with no tool-specific code.
     */
    items: FindingToolItem[];
    /** How many match in total, not just on this page. */
    total: number;
    /**
     * The same set broken down by severity.
     *
     * Carried alongside the page rather than derived from it: a page of ten out
     * of fourteen would otherwise let both the model and the rendered strip
     * describe the shape of a sample as though it were the whole.
     */
    bySeverity: Record<AlarmSeverity, number>;
    /**
     * Restated in the payload because a model reads the result, not the request
     * — without it, "14" and a list of ten look like a contradiction.
     */
    page: number;
    pageSize: number;
}

/** Milliseconds in a day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days between `since` and `now`, floored at zero.
 *
 * Floored rather than rounded: a finding four hours old is "0 days", which
 * reads as *today*. Rounding would make it "1 day" and quietly age everything
 * by up to twelve hours — small, and exactly the kind of thing a model then
 * states as fact.
 */
export function daysSince(since: string, now: Date): number {
    const started = Date.parse(since);
    if (Number.isNaN(started)) return 0;
    return Math.max(0, Math.floor((now.getTime() - started) / DAY_MS));
}

/** Projects one stored finding into the tool's shape. */
export function toFindingToolItem(
    finding: AlarmFindingView,
    now: Date
): FindingToolItem {
    return {
        title: finding.title,
        rule: finding.ruleName,
        severity: finding.severity,
        contentType: finding.contentType,
        entryId: finding.entryId,
        openForDays: daysSince(finding.firstSeenAt, now)
    };
}

/**
 * Assembles the tool's whole result.
 *
 * A pure function over already-fetched data, so the interesting part — the
 * projection, the day arithmetic, the ordering — is unit-testable without a
 * database, a registry, or a model.
 */
export function buildFindingsToolOutput(input: {
    findings: readonly AlarmFindingView[];
    total: number;
    bySeverity: Record<AlarmSeverity, number>;
    page: number;
    pageSize: number;
    now: Date;
}): FindingsToolOutput {
    return {
        items: input.findings.map((finding) =>
            toFindingToolItem(finding, input.now)
        ),
        total: input.total,
        bySeverity: input.bySeverity,
        page: input.page,
        pageSize: input.pageSize
    };
}

/**
 * A one-line tally, most severe first — "2 errors, 5 warnings".
 *
 * Used in the tool's own description and by the rendered strip's accessible
 * summary, so the two cannot describe the same numbers differently. Empty
 * severities are dropped: "0 errors" is a fact nobody asked for, and listing
 * all three every time buries the one that matters.
 */
export function severityTally(counts: Record<AlarmSeverity, number>): string {
    const labels: Record<AlarmSeverity, [string, string]> = {
        error: ['error', 'errors'],
        warn: ['warning', 'warnings'],
        info: ['note', 'notes']
    };
    const parts = ALARM_SEVERITIES.filter(
        (severity) => counts[severity] > 0
    ).map((severity) => {
        const n = counts[severity];
        const [one, many] = labels[severity];
        return `${n} ${n === 1 ? one : many}`;
    });
    return parts.length > 0 ? parts.join(', ') : 'nothing flagged';
}

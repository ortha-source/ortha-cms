import {
    COMBINATOR,
    OP,
    newId,
    treeToJsonFilter,
    type FilterGroup,
    type FilterRule
} from '@orthacms/query-builder-admin';
import { CONTENT_SEGMENT } from '../../domain/constants';
import { QUICK_STATUS, quickStatusRules } from '../statusQuickFilter';
import type { StaleAge } from '../../infrastructure/contentInsightsGateway';

/** The edges of each "Gone quiet" band, in days before now (server's own). */
const STALE_EDGES: Record<StaleAge, { from: number; to: number | null }> = {
    recent: { from: 30, to: 90 },
    months: { from: 90, to: 365 },
    year: { from: 365, to: null }
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD`, `days` before `now`. */
function dayBefore(now: Date, days: number): string {
    return new Date(now.getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

/** A rule with a fresh id. */
function rule(shape: Omit<FilterRule, 'id'>): FilterRule {
    return { ...shape, id: newId() };
}

/** The filter behind a Needs-attention line, as the records table reads it. */
export type InsightsRecordsFilter =
    | { kind: 'modified' }
    | { kind: 'stale'; age: StaleAge };

/**
 * The filter tree for a drill-down's "open all in Records" — the same
 * conditions the records table's own chips and builder write, so the link
 * lands on a table whose filter reads, edits and saves like any other.
 *
 * - `modified` is the **Modified** status chip, exactly.
 * - `stale` is the **Published** chip plus the band's edges on `updatedAt`.
 *   The edges are dates, not instants — the filter UI edits dates — so a
 *   record edited on the edge day can land either side of it.
 */
export function insightsRecordsTree(
    filter: InsightsRecordsFilter,
    now: Date = new Date()
): FilterGroup {
    const rules: FilterRule[] = [];
    if (filter.kind === 'modified') {
        rules.push(...quickStatusRules(QUICK_STATUS.Modified).map(rule));
    } else {
        const edges = STALE_EDGES[filter.age];
        rules.push(...quickStatusRules(QUICK_STATUS.Published).map(rule));
        rules.push(
            rule({
                fieldId: 'updatedAt',
                op: OP.Lte,
                value: dayBefore(now, edges.from)
            })
        );
        if (edges.to !== null) {
            rules.push(
                rule({
                    fieldId: 'updatedAt',
                    op: OP.Gt,
                    value: dayBefore(now, edges.to)
                })
            );
        }
    }
    return { id: newId(), combinator: COMBINATOR.And, children: rules };
}

/**
 * Where "open all in Records" goes for one content type: that type's records
 * table, relative to the Insights route, with the line's filter applied.
 *
 * There is no cross-type records table, so a drill-down spanning three types
 * links each one — the closest the admin has to "all of them".
 */
export function insightsRecordsLink(
    typeName: string,
    filter: InsightsRecordsFilter,
    now: Date = new Date()
): string {
    const json = treeToJsonFilter(insightsRecordsTree(filter, now), now);
    const search = json ? `?${new URLSearchParams({ filter: json })}` : '';
    return `../${CONTENT_SEGMENT}/${typeName}${search}`;
}

/** Where one record goes, relative to the Insights route. */
export function insightsRecordLink(typeName: string, id: string): string {
    return `../${CONTENT_SEGMENT}/${typeName}/${id}`;
}

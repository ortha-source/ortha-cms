import { Injectable } from '@nestjs/common';
import {
    CONDITION_MODE,
    DENIAL_REASON,
    evaluate,
    segmentIdsForTags,
    type AccessDecision,
    type ResolvedConditionGroup,
    type SegmentTag
} from '@orthacms/segments-domain';
import { AccessResolutionService } from './access-resolution.service';
import { SegmentCatalogService } from './segment-catalog.service';

/** One line of the explanation. */
export interface ExplainStep {
    /** `exclusions`, `window`, or `group 1`. */
    label: string;
    /** Whether this step admitted the reader. */
    passed: boolean;
    /** Why, in the vocabulary of the model rather than of SQL. */
    detail: string;
}

/** The whole answer for one reader on one entry. */
export interface ExplainResult {
    visible: boolean;
    /** Which group let them through; `-1` when the rule restricts nothing. */
    matchedGroup: number;
    /** Absent when the reader got in. */
    reason?: string;
    /** What a refused reader is served. */
    fallback?: string;
    /** The segments the reader's tags resolved to, by segment type. */
    readerSegments: Record<string, string[]>;
    /** The levels that contributed to the rule. */
    contributors: readonly string[];
    /** One step per check, in the order they were made. */
    steps: ExplainStep[];
}

/**
 * "Who sees this, and why" — the decision rendered as a flat list.
 *
 * The list is flat because the model is: exclusions, then the window, then the
 * groups, OR-ed. That is the whole return on refusing an expression language —
 * an arbitrary boolean tree would have to be explained as a proof, and nobody
 * reads a proof to find out why their article is hidden.
 *
 * It re-runs the real `evaluate` rather than describing what it thinks the
 * rule does. A second implementation of the decision, written to explain the
 * first, is a second implementation that can disagree with it.
 */
@Injectable()
export class ExplainService {
    constructor(
        private readonly catalog: SegmentCatalogService,
        private readonly resolution: AccessResolutionService
    ) {}

    /** Explain one reader's access to one entry. */
    async explain(input: {
        workspaceId: string;
        typeSlug: string;
        entryId: string;
        tags: readonly SegmentTag[];
        now?: Date;
    }): Promise<ExplainResult> {
        const now = input.now ?? new Date();
        const { segments } = this.catalog.snapshot();
        const callerSegmentIds = segmentIdsForTags(segments, input.tags);
        const resolved = await this.resolution.resolveEntry({
            workspaceId: input.workspaceId,
            typeSlug: input.typeSlug,
            entryId: input.entryId
        });
        const decision = evaluate({
            rule: resolved.rule,
            callerSegmentIds,
            now
        });

        const label = (id: string) =>
            segments.find((segment) => segment.id === id)?.label ?? id;

        const steps: ExplainStep[] = [];

        const excluded = Object.entries(resolved.rule.exclusions).flatMap(
            ([typeKey, ids]) =>
                ids
                    .filter((id) => callerSegmentIds.has(id))
                    .map((id) => `${typeKey}: ${label(id)}`)
        );
        steps.push({
            label: 'exclusions',
            passed: excluded.length === 0,
            detail: excluded.length
                ? `matched ${excluded.join(', ')}`
                : 'no exclusion matched this reader'
        });

        const windowOpen =
            (!resolved.rule.startsAt || resolved.rule.startsAt <= now) &&
            (!resolved.rule.endsAt || resolved.rule.endsAt > now);
        steps.push({
            label: 'window',
            passed: windowOpen,
            detail: describeWindow(resolved.rule.startsAt, resolved.rule.endsAt)
        });

        resolved.rule.groups.forEach((group, index) => {
            const failed = failingTypes(group, callerSegmentIds);
            steps.push({
                label: `group ${index + 1}`,
                passed: failed.length === 0,
                detail: describeGroup(group, failed, label)
            });
        });

        return {
            ...toOutcome(decision),
            readerSegments: groupByType(segments, callerSegmentIds),
            contributors: resolved.contributors,
            steps
        };
    }
}

/** Which of a group's conditions refused the reader. */
function failingTypes(
    group: ResolvedConditionGroup,
    callerSegmentIds: ReadonlySet<string>
): string[] {
    const failed: string[] = [];
    for (const [typeKey, condition] of Object.entries(group.conditions)) {
        const intersects = condition.segmentIds.some((id) =>
            callerSegmentIds.has(id)
        );
        const admits =
            condition.mode === CONDITION_MODE.All
                ? true
                : condition.mode === CONDITION_MODE.Only
                  ? intersects
                  : !intersects;
        if (!admits) failed.push(typeKey);
    }
    return failed;
}

/** One group, in words. */
function describeGroup(
    group: ResolvedConditionGroup,
    failed: readonly string[],
    label: (id: string) => string
): string {
    const parts = Object.entries(group.conditions).map(
        ([typeKey, condition]) => {
            const names = condition.segmentIds.map(label).join(', ');
            const clause =
                condition.mode === CONDITION_MODE.All
                    ? 'any'
                    : condition.mode === CONDITION_MODE.Only
                      ? `only ${names || '(nobody)'}`
                      : `all except ${names}`;
            return `${typeKey}: ${clause}`;
        }
    );
    const inherited = group.source ? ` — from ${group.source}` : '';
    const verdict = failed.length ? ` · failed on ${failed.join(', ')}` : '';
    return `${parts.join(' AND ') || 'no condition'}${inherited}${verdict}`;
}

/** The window, in words. */
function describeWindow(from: Date | null, to: Date | null): string {
    if (!from && !to) return 'no date bounds';
    const parts: string[] = [];
    if (from) parts.push(`from ${from.toISOString()}`);
    if (to) parts.push(`until ${to.toISOString()}`);
    return parts.join(' ');
}

/** The decision, as the wire reports it. */
function toOutcome(decision: AccessDecision) {
    if (decision.visible) {
        return { visible: true as const, matchedGroup: decision.matchedGroup };
    }
    return {
        visible: false as const,
        matchedGroup: -1,
        reason: decision.reason,
        fallback: decision.fallback,
        ...(decision.reason === DENIAL_REASON.NoGroup && decision.closest
            ? {
                  closestGroup: decision.closest.index + 1,
                  requires: decision.closest.requires
              }
            : {})
    };
}

/** Reader segments, grouped by type, as labels rather than ids. */
function groupByType(
    segments: readonly { id: string; typeKey: string; label: string }[],
    ids: ReadonlySet<string>
): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const segment of segments) {
        if (!ids.has(segment.id)) continue;
        (out[segment.typeKey] ??= []).push(segment.label);
    }
    return out;
}

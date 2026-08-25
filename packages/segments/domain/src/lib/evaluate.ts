/**
 * The access decision — the single place that answers "may this reader see
 * this?".
 *
 * A domain service in the strict sense: no database, no framework, no clock of
 * its own. That is what lets the same function run in the SQL compiler's tests,
 * in the admin's "who sees this" panel, and on a client rendering a paywall,
 * and give all three the same answer.
 *
 * The order of the checks is not interchangeable:
 *
 * 1. **Exclusions**, absolutely and first. "Everyone except Globex" must not be
 *    reopened by a group that happens to match — a denied reader is denied
 *    however good their plan is.
 * 2. **The window**, before any group. An embargoed entry is invisible to
 *    everyone, so evaluating groups first would only produce a match nobody is
 *    allowed to act on.
 * 3. **The groups**, OR-ed. One match is enough, and the rest are not even
 *    reported as failures — which is what keeps the explanation short.
 */

import {
    ACCESS_FALLBACK,
    CONDITION_MODE,
    type ResolvedAccessRule,
    type ResolvedCondition,
    type ResolvedConditionGroup
} from './access-rule';
import type { SegmentTypeKey } from './segment-type';

/** Why a reader was refused. */
export const DENIAL_REASON = {
    /** Matched a rule-level exclusion. */
    Excluded: 'excluded',
    /** The visibility window is not open. */
    Window: 'window',
    /** No condition group matched. */
    NoGroup: 'no-group'
} as const;

/** @see DENIAL_REASON */
export type DenialReason = (typeof DENIAL_REASON)[keyof typeof DENIAL_REASON];

/** The group a refused reader came closest to, and what stopped them. */
export interface ClosestGroup {
    /** Index into {@link ResolvedAccessRule.groups}. */
    readonly index: number;
    /** Segment type keys whose condition failed, in declaration order. */
    readonly failed: readonly SegmentTypeKey[];
    /** Segment ids that would have satisfied those failing conditions. */
    readonly requires: Readonly<Record<SegmentTypeKey, readonly string[]>>;
}

/** The verdict for one reader on one entry. */
export type AccessDecision =
    | {
          readonly visible: true;
          /**
           * Which group let them through — `-1` when the rule restricts
           * nothing, so "unrestricted" and "matched group 0" stay
           * distinguishable in an explanation.
           */
          readonly matchedGroup: number;
      }
    | {
          readonly visible: false;
          readonly reason: DenialReason;
          readonly fallback: ResolvedAccessRule['fallback'];
          /** Absent when the refusal was an exclusion or the window. */
          readonly closest?: ClosestGroup;
      };

/** What {@link evaluate} is asked about. */
export interface EvaluationInput {
    /** The entry's rule, after inheritance. */
    readonly rule: ResolvedAccessRule;
    /** The reader's segment ids, already resolved from their tags. */
    readonly callerSegmentIds: ReadonlySet<string>;
    /** The instant the decision is made at — passed in, never read here. */
    readonly now: Date;
}

/** Whether the caller holds any of `segmentIds`. */
function intersects(
    callerSegmentIds: ReadonlySet<string>,
    segmentIds: readonly string[]
): boolean {
    for (const id of segmentIds) {
        if (callerSegmentIds.has(id)) return true;
    }
    return false;
}

/** Whether one type's condition admits the caller. */
function conditionAdmits(
    condition: ResolvedCondition,
    callerSegmentIds: ReadonlySet<string>
): boolean {
    switch (condition.mode) {
        case CONDITION_MODE.All:
            return true;
        case CONDITION_MODE.Only:
            // An empty `only` admits nobody. That is not a degenerate case to
            // paper over: it is what a rule reads like the moment its last
            // segment is removed, and quietly turning it into `all` would open
            // the content instead of closing it.
            return intersects(callerSegmentIds, condition.segmentIds);
        case CONDITION_MODE.AllExcept:
            return !intersects(callerSegmentIds, condition.segmentIds);
    }
}

/** Which of a group's conditions refused the caller. */
function failingTypes(
    group: ResolvedConditionGroup,
    callerSegmentIds: ReadonlySet<string>
): SegmentTypeKey[] {
    const failed: SegmentTypeKey[] = [];
    for (const [typeKey, condition] of Object.entries(group.conditions)) {
        if (!conditionAdmits(condition, callerSegmentIds)) {
            failed.push(typeKey);
        }
    }
    return failed;
}

/** Whether any exclusion catches the caller. */
function isExcluded(
    rule: ResolvedAccessRule,
    callerSegmentIds: ReadonlySet<string>
): boolean {
    for (const segmentIds of Object.values(rule.exclusions)) {
        if (intersects(callerSegmentIds, segmentIds)) return true;
    }
    return false;
}

/** Whether the visibility window is open at `now`. */
function windowIsOpen(rule: ResolvedAccessRule, now: Date): boolean {
    if (rule.startsAt && rule.startsAt.getTime() > now.getTime()) return false;
    if (rule.endsAt && rule.endsAt.getTime() <= now.getTime()) return false;
    return true;
}

/**
 * The group a refused reader came closest to — the one with the fewest failing
 * conditions, ties broken by declaration order.
 *
 * It exists so a client can say "you need Pro" instead of "no". Computed in the
 * same pass as the decision, not by a second walk: the failures are already in
 * hand by the time the last group is rejected.
 */
function closestOf(
    failures: readonly { index: number; failed: SegmentTypeKey[] }[],
    groups: readonly ResolvedConditionGroup[]
): ClosestGroup | undefined {
    let best: { index: number; failed: SegmentTypeKey[] } | undefined;
    for (const failure of failures) {
        if (!best || failure.failed.length < best.failed.length) {
            best = failure;
        }
    }
    if (!best) return undefined;
    const requires: Record<SegmentTypeKey, readonly string[]> = {};
    for (const typeKey of best.failed) {
        const condition = groups[best.index]?.conditions[typeKey];
        // Only an `only` names what would have helped; failing an `all-except`
        // means the reader must *not* be someone, which is not a requirement a
        // client can offer to satisfy.
        if (condition?.mode === CONDITION_MODE.Only) {
            requires[typeKey] = condition.segmentIds;
        }
    }
    return { index: best.index, failed: best.failed, requires };
}

/**
 * Decide whether one reader may see one entry.
 *
 * **An empty `groups` means unrestricted**, not "matches nothing". A rule with
 * no conditions is what every entry starts life with, and reading it as a
 * closed door would black out an installation the moment the plugin is
 * enabled. Exclusions and the window still apply on their own, so
 * "everyone except Globex" needs no group at all.
 */
export function evaluate(input: EvaluationInput): AccessDecision {
    const { rule, callerSegmentIds, now } = input;

    if (isExcluded(rule, callerSegmentIds)) {
        return {
            visible: false,
            reason: DENIAL_REASON.Excluded,
            fallback: rule.fallback ?? ACCESS_FALLBACK.Teaser
        };
    }

    if (!windowIsOpen(rule, now)) {
        return {
            visible: false,
            reason: DENIAL_REASON.Window,
            fallback: rule.fallback ?? ACCESS_FALLBACK.Teaser
        };
    }

    if (!rule.groups.length) {
        return { visible: true, matchedGroup: -1 };
    }

    const failures: { index: number; failed: SegmentTypeKey[] }[] = [];
    for (let index = 0; index < rule.groups.length; index += 1) {
        const failed = failingTypes(rule.groups[index], callerSegmentIds);
        if (!failed.length) {
            return { visible: true, matchedGroup: index };
        }
        failures.push({ index, failed });
    }

    return {
        visible: false,
        reason: DENIAL_REASON.NoGroup,
        fallback: rule.fallback ?? ACCESS_FALLBACK.Teaser,
        closest: closestOf(failures, rule.groups)
    };
}

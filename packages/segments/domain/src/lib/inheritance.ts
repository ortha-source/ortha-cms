/**
 * Inheritance — turning the chain of levels an entry sits under into the one
 * rule {@link evaluate} reads.
 *
 * The chain runs installation → workspace → type → slice → entry, and the rule
 * for merging it is the answer to a question the plan leaves open on purpose:
 * a lower level **adds** its groups to what it inherited rather than replacing
 * them. Replacement as the default loses a type's restriction the moment
 * somebody edits one entry — the failure is silent and the content is already
 * public by the time anyone notices. Detaching stays possible, but it has to be
 * asked for ({@link AuthoredAccessRule.detachInherited}).
 *
 * Exclusions never merge downward the other way: they are unioned across the
 * whole chain and a lower level cannot lift one. That is the same "deny wins"
 * rule {@link evaluate} enforces within a single rule, applied across levels.
 */

import {
    ACCESS_FALLBACK,
    INHERIT,
    OPEN_ACCESS,
    type AccessFallback,
    type AccessLevelName,
    type AuthoredAccessRule,
    type AuthoredConditionGroup,
    type Exclusions,
    type ResolvedAccessRule,
    type ResolvedCondition,
    type ResolvedConditionGroup
} from './access-rule';
import type { SegmentTypeKey } from './segment-type';

/** One link in the chain: where the rule was authored, and what it says. */
export interface AccessLevel {
    /** Which level this is. Used to label an inherited group in the editor. */
    readonly name: AccessLevelName;
    /** The rule authored there, or `null`/absent when the level says nothing. */
    readonly rule?: AuthoredAccessRule | null;
}

/** A resolved rule plus what it was assembled from. */
export interface ResolvedAccess {
    /** What {@link evaluate} takes. */
    readonly rule: ResolvedAccessRule;
    /** Levels that contributed anything, outermost first. */
    readonly contributors: readonly AccessLevelName[];
    /** The level whose `detachInherited` dropped the chain above it, if any. */
    readonly detachedAt?: AccessLevelName;
}

/** Union two exclusion maps, keeping each type's ids unique. */
function unionExclusions(base: Exclusions, extra: Exclusions): Exclusions {
    const out: Record<SegmentTypeKey, string[]> = {};
    for (const [typeKey, ids] of Object.entries(base)) {
        out[typeKey] = [...ids];
    }
    for (const [typeKey, ids] of Object.entries(extra)) {
        const bucket = (out[typeKey] ??= []);
        for (const id of ids) {
            if (!bucket.includes(id)) bucket.push(id);
        }
    }
    return out;
}

/**
 * Resolve one authored group against the type conditions it inherits.
 *
 * A condition set to `inherit` takes the value the same segment type held in
 * the group being extended; with nothing to inherit it collapses to `all`,
 * which is the only reading that keeps "this type is not mentioned" and "this
 * type defers" behaving the same way.
 */
function resolveGroup(
    group: AuthoredConditionGroup,
    source: AccessLevelName,
    inheritFrom?: ResolvedConditionGroup
): ResolvedConditionGroup {
    const conditions: Record<SegmentTypeKey, ResolvedCondition> = {};
    for (const [typeKey, condition] of Object.entries(group)) {
        if (condition.mode === INHERIT) {
            const inherited = inheritFrom?.conditions[typeKey];
            if (inherited) conditions[typeKey] = inherited;
            continue;
        }
        conditions[typeKey] = {
            mode: condition.mode,
            segmentIds: [...condition.segmentIds]
        };
    }
    return { conditions, source };
}

/**
 * Collapse the chain into a single rule.
 *
 * Levels are read outermost-first and each may add groups, add exclusions, set
 * the window, set the fallback, or detach. The **nearest** level that states a
 * window or a fallback wins, because those are single-valued — unlike groups,
 * which accumulate.
 */
export function resolveAccess(levels: readonly AccessLevel[]): ResolvedAccess {
    let groups: ResolvedConditionGroup[] = [];
    let exclusions: Exclusions = {};
    let startsAt: Date | null = OPEN_ACCESS.startsAt;
    let endsAt: Date | null = OPEN_ACCESS.endsAt;
    let fallback: AccessFallback = ACCESS_FALLBACK.Teaser;
    const contributors: AccessLevelName[] = [];
    let detachedAt: AccessLevelName | undefined;

    for (const level of levels) {
        const rule = level.rule;
        if (!rule) continue;

        let contributed = false;

        if (rule.detachInherited) {
            groups = [];
            detachedAt = level.name;
            contributed = true;
            // Exclusions deliberately survive a detach: "this reader never sees
            // our content" is a decision taken above, and letting one entry
            // shrug it off would make the guarantee unenforceable.
        }

        if (rule.exclusions && Object.keys(rule.exclusions).length) {
            exclusions = unionExclusions(exclusions, rule.exclusions);
            contributed = true;
        }

        if (rule.groups?.length) {
            const inheritFrom = groups[groups.length - 1];
            for (const group of rule.groups) {
                groups.push(resolveGroup(group, level.name, inheritFrom));
            }
            contributed = true;
        }

        if (rule.startsAt !== undefined) {
            startsAt = rule.startsAt;
            contributed = true;
        }
        if (rule.endsAt !== undefined) {
            endsAt = rule.endsAt;
            contributed = true;
        }
        if (rule.fallback !== undefined) {
            fallback = rule.fallback;
            contributed = true;
        }

        if (contributed) contributors.push(level.name);
    }

    return {
        rule: { exclusions, groups, startsAt, endsAt, fallback },
        contributors,
        ...(detachedAt ? { detachedAt } : {})
    };
}

/**
 * The **access rule** — what an entry, a type or a workspace declares about who
 * may read it.
 *
 * The shape is deliberately fixed rather than an expression language, and the
 * three constraints below are what buy the whole design its legibility:
 *
 * 1. **Groups are OR-ed, types inside a group are AND-ed.** Disjunctive normal
 *    form, and nothing else. `(Acme) OR (EU AND Pro)` is expressible;
 *    arbitrary nesting is not.
 * 2. **No nesting.** A group holds conditions, never other groups.
 * 3. **One negation.** Rule-level {@link AccessRule.exclusions} are absolute and
 *    sit above every group; a group's own `all-except` narrows only that group.
 *
 * Lift any of them and "why can this reader see this?" stops being a flat list
 * and becomes a proof tree — which is exactly the failure mode this kernel
 * exists to avoid.
 */

import type { SegmentTypeKey } from './segment-type';

/** How one segment type constrains one group. */
export const CONDITION_MODE = {
    /** Does not constrain — the type is open in this group. */
    All: 'all',
    /** Everyone in the type except the named segments. */
    AllExcept: 'all-except',
    /** Only the named segments. */
    Only: 'only'
} as const;

/** @see CONDITION_MODE */
export type ConditionMode =
    (typeof CONDITION_MODE)[keyof typeof CONDITION_MODE];

/** The authored-only mode: take this level's value from the level above. */
export const INHERIT = 'inherit' as const;

/** A condition as **authored**, which may still defer to the level above. */
export interface AuthoredCondition {
    readonly mode: ConditionMode | typeof INHERIT;
    /** Segment ids the mode refers to. Empty for `all` and `inherit`. */
    readonly segmentIds: readonly string[];
}

/**
 * A condition after inheritance has run: every `inherit` is gone.
 *
 * The two types are kept apart on purpose. {@link evaluate} takes only resolved
 * conditions, so "did anyone forget to run inheritance?" is a compile error
 * rather than a silently permissive decision at runtime.
 */
export interface ResolvedCondition {
    readonly mode: ConditionMode;
    readonly segmentIds: readonly string[];
}

/** One AND-group, as authored: segment type key → condition. */
export type AuthoredConditionGroup = Readonly<
    Record<SegmentTypeKey, AuthoredCondition>
>;

/** One AND-group, after inheritance. */
export interface ResolvedConditionGroup {
    /** Segment type key → condition. A type absent here does not constrain. */
    readonly conditions: Readonly<Record<SegmentTypeKey, ResolvedCondition>>;
    /**
     * Which level contributed this group — what the editor is shown as
     * "inherited from type article". Absent for a group authored on the entry
     * itself.
     */
    readonly source?: AccessLevelName;
}

/** What a reader who matched no group is served. */
export const ACCESS_FALLBACK = {
    /** Absent from listings, 404 on a direct read — existence stays secret. */
    Hidden: 'hidden',
    /** Returned with a teaser and `requires`, so the client can upsell. */
    Teaser: 'teaser',
    /** As `teaser`, plus whatever paywall treatment the client renders. */
    Paywall: 'paywall'
} as const;

/** @see ACCESS_FALLBACK */
export type AccessFallback =
    (typeof ACCESS_FALLBACK)[keyof typeof ACCESS_FALLBACK];

/** The levels a rule can be attached to, outermost first. */
export const ACCESS_LEVEL = {
    Installation: 'installation',
    Workspace: 'workspace',
    Type: 'type',
    Slice: 'slice',
    Entry: 'entry'
} as const;

/** @see ACCESS_LEVEL */
export type AccessLevelName = (typeof ACCESS_LEVEL)[keyof typeof ACCESS_LEVEL];

/** Exclusions, by segment type key. Absolute: they outrank every group. */
export type Exclusions = Readonly<Record<SegmentTypeKey, readonly string[]>>;

/** A rule as authored at one level. */
export interface AuthoredAccessRule {
    /** Segments that never see the content, whatever any group says. */
    readonly exclusions?: Exclusions;
    /** Condition groups, OR-ed. Empty means this level adds no condition. */
    readonly groups?: readonly AuthoredConditionGroup[];
    /**
     * Drop everything inherited from the levels above instead of adding to it.
     *
     * Merging is the default because replacing silently loses a type's own
     * restriction the moment someone edits one entry — but "this one article is
     * genuinely public" has to remain expressible, and this is how.
     */
    readonly detachInherited?: boolean;
    /** Start of the visibility window. `null`/absent = no lower bound. */
    readonly startsAt?: Date | null;
    /** End of the visibility window. `null`/absent = no upper bound. */
    readonly endsAt?: Date | null;
    /** What a reader who matched no group gets. */
    readonly fallback?: AccessFallback;
}

/** A rule after inheritance: what {@link evaluate} actually reads. */
export interface ResolvedAccessRule {
    readonly exclusions: Exclusions;
    /** OR-ed groups. **Empty means unrestricted** — see {@link evaluate}. */
    readonly groups: readonly ResolvedConditionGroup[];
    readonly startsAt: Date | null;
    readonly endsAt: Date | null;
    readonly fallback: AccessFallback;
}

/** A rule that restricts nothing — the installation default. */
export const OPEN_ACCESS: ResolvedAccessRule = {
    exclusions: {},
    groups: [],
    startsAt: null,
    endsAt: null,
    fallback: ACCESS_FALLBACK.Teaser
};

/** Whether a resolved rule constrains anything at all. */
export function isUnrestricted(rule: ResolvedAccessRule): boolean {
    return (
        rule.groups.length === 0 &&
        rule.startsAt === null &&
        rule.endsAt === null &&
        Object.values(rule.exclusions).every((ids) => ids.length === 0)
    );
}

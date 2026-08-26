/**
 * What a refused reader is served: nothing at all, or the entry with the
 * missing segments named so a client can offer it.
 */
export type AccessFallback = 'hidden' | 'teaser' | 'paywall';

/**
 * One segment type's condition inside one group, as *authored*. `inherit` is
 * the authored-only mode — it resolves against the level above and never
 * reaches the projection.
 */
export type ConditionMode = 'all' | 'only' | 'all-except' | 'inherit';

/** One type's condition: a mode, and the segments it refers to. */
export type Condition = {
    /** How the named segments are read. */
    mode: ConditionMode;
    /**
     * Segment ids the mode refers to. Empty for `all` and `inherit` — and note
     * an empty `only` admits nobody, which is what a rule reads like once its
     * last segment is removed.
     */
    segmentIds: string[];
};

/**
 * One AND-group: segment type key → condition. A type absent from a group does
 * not constrain it. Groups are OR-ed, which is the whole expressiveness of the
 * model — disjunctive normal form, no nesting.
 */
export type ConditionGroup = {
    conditions: Record<string, Condition>;
};

/** One rule as the library renders it. */
export type AccessRule = {
    /** Stable id. */
    id: string;
    /** `null` for an installation-wide rule; this workspace's id otherwise. */
    workspaceId: string | null;
    /** Url-safe key, unique within its scope. */
    key: string;
    /** Human-readable name. */
    label: string;
    /**
     * Segment type key → segment ids that never see the content, whatever any
     * group says. Checked before the window and before every group.
     */
    exclusions: Record<string, string[]>;
    /** OR-ed condition groups; empty means the rule adds no condition. */
    groups: ConditionGroup[];
    /** Start of the visibility window, or `null` for no lower bound. */
    startsAt: Date | null;
    /** End of the visibility window, or `null` for no upper bound. */
    endsAt: Date | null;
    /** What a refused reader is served. */
    fallback: AccessFallback;
    /** Assignments naming this rule — "used in 3 places". */
    assignmentCount: number;
};

/** A rule the workspace may use but not edit: one declared above it. */
export function isGlobal(rule: AccessRule): boolean {
    return rule.workspaceId === null;
}

/**
 * Whether a rule can be deleted, and why not.
 *
 * The UX mirror of the server's two refusals: a global rule is a decision taken
 * above this workspace, and an assigned rule cannot be dropped without silently
 * opening everything it governs.
 */
export function canBeDeleted(
    rule: AccessRule
): { ok: true } | { ok: false; reason: 'global' | 'assigned' } {
    if (isGlobal(rule)) return { ok: false, reason: 'global' };
    if (rule.assignmentCount > 0) return { ok: false, reason: 'assigned' };
    return { ok: true };
}

/**
 * Whether a rule actually restricts anything.
 *
 * A rule with no groups, no exclusions and no window is a rule that admits
 * everyone — which is a real state (someone cleared it), and is exactly what
 * the entry chip must not report as "restricted". It is the admin's mirror of
 * the kernel's `isUnrestricted`, over the *authored* shape rather than the
 * resolved one.
 */
export function restrictsAnyone(rule: AccessRule): boolean {
    if (rule.startsAt || rule.endsAt) return true;
    if (Object.values(rule.exclusions).some((ids) => ids.length > 0)) {
        return true;
    }
    return rule.groups.some((group) =>
        Object.values(group.conditions).some(
            (condition) => condition.mode !== 'all'
        )
    );
}

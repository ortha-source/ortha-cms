/** The three levels a rule or a grant attaches to. */
export type TargetKind = 'workspace' | 'type' | 'entry';

/** Where a rule or a grant applies. */
export type AccessTarget = {
    /** The level this attaches to. */
    kind: TargetKind;
    /** Content type slug — required for `type` and `entry`. */
    typeSlug?: string;
    /** Entry id — required for `entry`. */
    entryId?: string;
};

/** One assignment: a rule attached to a level, from the content side. */
export type Assignment = {
    /** Stable id (the unassign handle). */
    id: string;
    /** The rule being applied. */
    ruleId: string;
    /** The rule's label, so a list needs no second query. */
    ruleLabel: string;
    /** The workspace the assignment lives in. */
    workspaceId: string;
    /** Where it applies. */
    target: AccessTarget;
};

/** One grant: a segment attached to a level, from the segment side. */
export type Grant = {
    /** Stable id (the revoke handle). */
    id: string;
    /** The segment being granted. */
    segmentId: string;
    /** The segment's label. */
    segmentLabel: string;
    /** The workspace the grant lives in. */
    workspaceId: string;
    /** What it reaches. */
    target: AccessTarget;
    /** When the grant lapses, or `null` for open-ended. */
    expiresAt: Date | null;
};

/** Whether two targets name the same level — the assignment lookup's key. */
export function sameTarget(a: AccessTarget, b: AccessTarget): boolean {
    return (
        a.kind === b.kind &&
        (a.typeSlug ?? null) === (b.typeSlug ?? null) &&
        (a.entryId ?? null) === (b.entryId ?? null)
    );
}

/**
 * A lapsed grant is kept rather than deleted, so who had access when stays
 * answerable — which means the list has to say which ones are inert.
 */
export function hasLapsed(grant: Grant, now: Date = new Date()): boolean {
    return grant.expiresAt !== null && grant.expiresAt <= now;
}

/** One audience, as the admin renders it. */
export type Segment = {
    /** Stable id — what an entry's lists hold. */
    id: string;
    /** Url-safe key, unique in the installation. */
    key: string;
    /** Human-readable name. */
    label: string;
    /** The reader tags it answers to — any one is enough. */
    tags: string[];
    /**
     * The workspaces it is offered in. **Empty means every one** — the same
     * reading as an entry's empty allow list, and the state every segment
     * starts in.
     */
    workspaceIds: string[];
    /** How many entries name it, either way. */
    usageCount: number;
};

/** One entry's two lists. */
export type EntryAccess = {
    /** Segments that may read it. **Empty means everyone.** */
    allow: string[];
    /** Segments that may not, whatever `allow` says. */
    deny: string[];
};

/**
 * What one segment is set to on one entry, as a control reads it.
 *
 * Three states, not two, and the third is the one that carries the model: a
 * segment nobody mentioned is **unset**, which is not "denied". On an entry
 * with no allow list it still reads; on an entry that allows somebody else it
 * does not. Collapsing it into a checkbox would make those two outcomes
 * indistinguishable on screen.
 */
export const SEGMENT_STATE = {
    /** Not mentioned. What every segment is on every entry to begin with. */
    Unset: 'unset',
    /** Named in the allow list. */
    Allow: 'allow',
    /** Named in the deny list. */
    Deny: 'deny'
} as const;

/** One value of {@link SEGMENT_STATE}. */
export type SegmentState = (typeof SEGMENT_STATE)[keyof typeof SEGMENT_STATE];

/** Nothing set. */
export const OPEN_ACCESS: EntryAccess = { allow: [], deny: [] };

/** What one segment is set to on this entry. */
export function stateOf(access: EntryAccess, segmentId: string): SegmentState {
    if (access.deny.includes(segmentId)) return SEGMENT_STATE.Deny;
    if (access.allow.includes(segmentId)) return SEGMENT_STATE.Allow;
    return SEGMENT_STATE.Unset;
}

/**
 * The lists with one segment moved to a new state.
 *
 * Pure, and it always removes before it adds, so a segment can never end up in
 * both lists — a state the server would accept and the reader would resolve as
 * denied, with the editor's screen saying "allowed".
 */
export function withState(
    access: EntryAccess,
    segmentId: string,
    state: SegmentState
): EntryAccess {
    const allow = access.allow.filter((id) => id !== segmentId);
    const deny = access.deny.filter((id) => id !== segmentId);
    if (state === SEGMENT_STATE.Allow) allow.push(segmentId);
    if (state === SEGMENT_STATE.Deny) deny.push(segmentId);
    return { allow, deny };
}

/**
 * The lists with **many** segments moved to one state — what "set every audience
 * to Can see" produces.
 *
 * Not a fold of {@link withState} over the ids, though it agrees with one: it
 * removes every named id from both lists first and appends once, so applying it
 * to two hundred audiences is two filters rather than four hundred.
 *
 * Segments **not** named are untouched, which is what makes the control safe to
 * offer beside a search: setting everything matching "acme" leaves the rest of
 * the entry's decisions exactly as they were.
 */
export function withStates(
    access: EntryAccess,
    segmentIds: readonly string[],
    state: SegmentState
): EntryAccess {
    if (!segmentIds.length) return access;
    const named = new Set(segmentIds);
    const allow = access.allow.filter((id) => !named.has(id));
    const deny = access.deny.filter((id) => !named.has(id));
    // Deduplicated and in the caller's order, so the stored list reads the way
    // the directory does rather than in whatever order the entry was edited.
    const added = [...new Set(segmentIds)];
    if (state === SEGMENT_STATE.Allow) allow.push(...added);
    if (state === SEGMENT_STATE.Deny) deny.push(...added);
    return { allow, deny };
}

/** Whether the entry is readable by everyone. */
export function isOpen(access: EntryAccess): boolean {
    return access.allow.length === 0 && access.deny.length === 0;
}

/**
 * The Access tab's staging, mounted above the editor and reached back down
 * through `EntryTabContext.presave`.
 *
 * Editor tabs are **routes**, so the Access panel unmounts the moment the user
 * switches tab — and a decision they made there has to survive that, because it
 * is not written until they press Save. It lives in the presave hook for exactly
 * the reason the media plugin's staged uploads do.
 */
export type EntryAccessStaging = {
    /**
     * What the next save will write, or `null` when nothing is staged — which is
     * not the same as `OPEN_ACCESS`: nothing staged means the save leaves the
     * entry's audiences alone, while open access means it opens them to
     * everyone.
     */
    draft: EntryAccess | null;
    /** Stage a change, or clear the staging with `null`. */
    stage: (next: EntryAccess | null) => void;
};

/** Whether two sets of lists say the same thing, order ignored. */
export function sameAccess(a: EntryAccess, b: EntryAccess): boolean {
    const same = (left: string[], right: string[]) =>
        left.length === right.length &&
        [...left].sort().join() === [...right].sort().join();
    return same(a.allow, b.allow) && same(a.deny, b.deny);
}

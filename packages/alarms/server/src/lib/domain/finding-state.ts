/**
 * The state of one finding — a single (rule, entry) pair.
 *
 * Three values, and the third is the reason this is a state machine rather
 * than a row that is deleted when it stops applying: `resolved` keeps
 * `firstSeenAt`, so an entry that starts matching again is the *same* finding
 * with its history intact instead of a fresh one that looks like it appeared
 * today.
 */
export const FINDING_STATE = {
    /** Matches the rule and nobody has silenced it. */
    Open: 'open',
    /** Matches the rule, but someone said it is fine here. */
    Muted: 'muted',
    /** Stopped matching. Kept for its history; invisible in every surface. */
    Resolved: 'resolved'
} as const;

/** One of the {@link FINDING_STATE} values. */
export type FindingState = (typeof FINDING_STATE)[keyof typeof FINDING_STATE];

/** Every state — the DTO's enum and the list filter's whitelist. */
export const FINDING_STATES: readonly FindingState[] = [
    FINDING_STATE.Open,
    FINDING_STATE.Muted,
    FINDING_STATE.Resolved
];

/** Narrowing guard for a value arriving from the database or the wire. */
export function isFindingState(value: unknown): value is FindingState {
    return FINDING_STATES.includes(value as FindingState);
}

/**
 * The state a finding takes after an evaluation, given whether the entry
 * matches the rule now and whether someone has muted this pair.
 *
 * Muting is stored as its own timestamp rather than being *only* a state, and
 * this function is why: a muted finding that stops matching resolves like any
 * other, and when it matches again it must come back **muted**, not open. If
 * mute lived only in `state` it would be erased by the first resolution, and
 * every silenced finding would come back shouting the next time its entry was
 * edited — which is precisely the behaviour that gets an alarms feature turned
 * off.
 */
export function nextFindingState(
    matches: boolean,
    muted: boolean
): FindingState {
    if (!matches) return FINDING_STATE.Resolved;
    return muted ? FINDING_STATE.Muted : FINDING_STATE.Open;
}

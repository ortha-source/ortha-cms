/**
 * The state of one finding — a single (rule, entry) pair.
 *
 * Two values, and the second is the reason this is a state machine rather than
 * a row that is deleted when it stops applying: `resolved` keeps
 * `firstSeenAt`, so an entry that starts matching again is the *same* finding
 * with its history intact instead of a fresh one that looks like it appeared
 * today.
 *
 * There was a third, `muted`, with a `muted_at` timestamp beside it so a mute
 * survived the finding resolving and re-opening. The whole idea is gone: an
 * alarm is either right about a record or it is wrong about it, and silencing
 * one record at a time is a way of living with a bad condition instead of
 * fixing it. Disabling the alarm, or narrowing its filter, says the same thing
 * where the next person can see it.
 */
export const FINDING_STATE = {
    /** Matches the rule. */
    Open: 'open',
    /** Stopped matching. Kept for its history; invisible in every surface. */
    Resolved: 'resolved'
} as const;

/** One of the {@link FINDING_STATE} values. */
export type FindingState = (typeof FINDING_STATE)[keyof typeof FINDING_STATE];

/** Every state — the DTO's enum and the list filter's whitelist. */
export const FINDING_STATES: readonly FindingState[] = [
    FINDING_STATE.Open,
    FINDING_STATE.Resolved
];

/** Narrowing guard for a value arriving from the database or the wire. */
export function isFindingState(value: unknown): value is FindingState {
    return FINDING_STATES.includes(value as FindingState);
}

/**
 * The state a finding takes after an evaluation, given whether the entry
 * matches the rule now.
 *
 * Trivial today, and still the one place the rule lives: `reconcile` writes
 * this value in an upsert's conflict clause, where getting it wrong is a
 * silent data bug rather than a failed request.
 */
export function nextFindingState(matches: boolean): FindingState {
    return matches ? FINDING_STATE.Open : FINDING_STATE.Resolved;
}

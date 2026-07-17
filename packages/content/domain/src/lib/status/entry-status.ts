/**
 * The entry **publish-status state machine** — the legal lifecycle transitions
 * of a publishable entry, expressed as pure functions so both runtimes
 * (`content-server` at write time, `content-admin` in its UI) gate a transition
 * against the same rules.
 *
 * The status set is the two values a publishable content type stores in its
 * `status` envelope column — `draft` and `published`. There is deliberately no
 * separate `unpublished` or `archived` status value in this milestone:
 * **unpublish** is simply the `published → draft` transition (the entry reverts
 * to a draft), and archival is modelled by the paranoid soft-delete tombstone,
 * not by a status. The values here mirror `content-server`'s `ENTRY_STATUS`
 * (which drives the generated column enum) one-for-one.
 */

/**
 * Publish state of an entry on a publishable content type. The runtime object
 * is the source of truth; the {@link EntryStatus} union is derived from it.
 */
export const ENTRY_STATUS = {
    Draft: 'draft',
    Published: 'published'
} as const;

/** Publish state of an entry on a publishable type. */
export type EntryStatus = (typeof ENTRY_STATUS)[keyof typeof ENTRY_STATUS];

/**
 * The legal transitions, keyed by the current status. `draft → published` is a
 * publish; `published → draft` is an unpublish. A same-state pair (e.g.
 * `draft → draft`) is intentionally **absent** — it is not a transition, so
 * callers treat it as an idempotent no-op rather than routing it through
 * {@link assertTransition}.
 */
const ENTRY_STATUS_TRANSITIONS: Readonly<
    Record<EntryStatus, readonly EntryStatus[]>
> = {
    [ENTRY_STATUS.Draft]: [ENTRY_STATUS.Published],
    [ENTRY_STATUS.Published]: [ENTRY_STATUS.Draft]
};

/**
 * Whether moving an entry from `from` to `to` is a legal, state-changing
 * transition. Returns `false` for a same-state pair (not a transition) and for
 * any unknown status.
 */
export function canTransition(from: EntryStatus, to: EntryStatus): boolean {
    return ENTRY_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Raised by {@link assertTransition} when a status change is not one of the
 * legal transitions. Transport-agnostic (a plain `Error`) — the application
 * layer maps it to an HTTP status.
 */
export class EntryStatusTransitionError extends Error {
    constructor(
        public readonly from: EntryStatus,
        public readonly to: EntryStatus
    ) {
        super(`Illegal entry status transition: ${from} → ${to}.`);
        this.name = 'EntryStatusTransitionError';
    }
}

/**
 * Asserts that `from → to` is a legal transition, throwing
 * {@link EntryStatusTransitionError} otherwise. Callers that want to allow an
 * idempotent same-state operation should short-circuit on `from === to` before
 * calling this.
 */
export function assertTransition(from: EntryStatus, to: EntryStatus): void {
    if (!canTransition(from, to)) {
        throw new EntryStatusTransitionError(from, to);
    }
}

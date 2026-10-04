/**
 * How risky one change is.
 * - `safe` — nothing existing can break.
 * - `data` — existing entries may no longer fit; the review shows how many.
 * - `destructive` — data is deleted; confirmed change by change.
 * - `blocked` — not applied by this version of the builder; the review says why.
 */
export type Safety = 'safe' | 'data' | 'destructive' | 'blocked';

/** Why a change got its verdict — a key the admin turns into a sentence. */
export type ClassifyReason =
    | 'new-type'
    | 'code-only'
    | 'nullable-column'
    | 'trash-column'
    | 'required-on-live-type'
    | 'constraint-tightened'
    | 'not-null-toggle'
    | 'relation-constraint'
    | 'drops-data'
    | 'type-in-use'
    | 'rename-unsupported'
    | 'retype-unsupported'
    | 'flag-needs-data-migration';

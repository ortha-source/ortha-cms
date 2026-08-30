import type { ActivityKind } from '../activityKinds';

/** Open per-kind payload — the admin reads known fields loosely. */
export type ActivityMeta = Record<string, unknown>;

/**
 * Who performed an action. `null` means a system-initiated event (no actor) —
 * the table renders it as "System". The email is a frozen snapshot and may be
 * `null` if it was never captured.
 */
export type ActivityActor = {
    /** The actor's id — a user id, or an API token id (see {@link type}). */
    id: string;
    /**
     * Frozen email snapshot at record time. For an `api_token` actor this
     * carries the **token's label** instead: a token has no address, and a row
     * showing a bare uuid names nothing a reader recognises.
     */
    email: string | null;
    /**
     * What {@link id} names — `'user'` for a person, `'api_token'` for an
     * external credential.
     *
     * A client needs it: the two ids come from different tables and lead to
     * different pages, and without it a token's label is indistinguishable
     * from a colleague's email address. Optional because a row written before
     * the column existed carries none, and those are all people.
     */
    type?: string;
} | null;

/** One audit event — a row of the Activity Log table. */
export type ActivityEvent = {
    /** Stable event id. */
    id: string;
    /** The `domain.action` kind (see `ACTIVITY_KINDS`). */
    kind: ActivityKind;
    /** The kind of entity acted upon (e.g. `'user'`). */
    subjectType: string;
    /** The acted-upon entity's id. */
    subjectId: string;
    /** Who performed it, or `null` for a system event. */
    actor: ActivityActor;
    /** Per-kind extra payload, or `null` when the kind carries none. */
    meta: ActivityMeta | null;
    /**
     * The workspace the action happened in, or `null` when it belongs to none
     * (an invite, a role change, the creation of a workspace itself).
     */
    workspaceId: string | null;
    /** When it happened. */
    at: Date;
};

/** One page of audit events plus the pagination envelope. */
export type ActivityList = {
    /** The events on this page. */
    items: ActivityEvent[];
    /** Total events matching the filters, across all pages. */
    total: number;
    /** 1-based page number. */
    page: number;
    /** Rows per page. */
    pageSize: number;
};

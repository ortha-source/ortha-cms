import type { ActivityKind, ActivityMeta } from '@ortha-cms/activity-contract';

/**
 * Who performed an action. `null` means a system-initiated event (no actor) —
 * the table renders it as "System". The email is a frozen snapshot and may be
 * `null` if it was never captured.
 */
export type ActivityActor = {
    /** The actor's user id (no FK — the user may since have been deleted). */
    id: string;
    /** Frozen email snapshot at record time. */
    email: string | null;
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

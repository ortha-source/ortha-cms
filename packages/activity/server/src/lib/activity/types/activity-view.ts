/**
 * One audit event as returned by `GET /api/activity`. Mirrors the
 * `activity_events` row minus `createdAt` (the immutable write time is an
 * internal detail and never reaches the wire). `kind` is an open string and
 * `meta` an open record — each emitting plugin owns its own kinds/shapes, and
 * the admin restates the ones it renders.
 */
export interface ActivityEventView {
    /** Event primary key. */
    id: string;
    /** The `domain.action` kind, owned by the emitting plugin. */
    kind: string;
    /** The kind of entity acted upon (e.g. `'user'`). */
    subjectType: string;
    /** The acted-upon entity's id (text). */
    subjectId: string;
    /** Who performed it, or `null` for a system-initiated event. */
    actorId: string | null;
    /** Frozen email snapshot of the actor, or `null`. */
    actorEmail: string | null;
    /** Open per-kind payload, or `null`. */
    meta: Record<string, unknown> | null;
    /** Logical event time. */
    at: Date;
}

/** One page of audit events, as returned by `GET /api/activity`. */
export interface ActivityListView {
    /** The events on this page. */
    items: ActivityEventView[];
    /** Total events matching the filters, across all pages. */
    total: number;
    /** 1-based page number echoed back. */
    page: number;
    /** Page size echoed back. */
    pageSize: number;
}

import type { RevisionStatus } from '../domain/revision-status';

/**
 * The immutable document a revision captures — everything the editor submits,
 * plus the link sets that don't travel in the values bag. Reconstructs a version
 * independently of the live row.
 */
export interface RevisionSnapshot {
    /**
     * Every field value keyed by field name: scalars, localized + shared fields,
     * and single-relation FK ids (which the editor carries in `values`).
     */
    values: Record<string, unknown>;
    /**
     * The ordered target-id list of each **join-backed** relation field (owning
     * many-to-many and the inverse of one) keyed by field name — the links that
     * never travel in {@link values}.
     */
    relations: Record<string, string[]>;
}

/**
 * One revision as served to the admin timeline — the metadata, without the
 * (potentially large) snapshot body. `author` is resolved from `created_by`.
 */
export interface RevisionSummary {
    /** Revision id. */
    id: string;
    /** Monotonic version number within the entry (1-based). */
    number: number;
    /** Lifecycle state. */
    status: RevisionStatus;
    /** Whether this is the entry's current live version. */
    isPublished: boolean;
    /** Whether this is the newest revision (the only one publishable). */
    isLatest: boolean;
    /** ISO capture timestamp. */
    createdAt: string;
    /** ISO publish timestamp, when published. */
    publishedAt?: string;
    /** The acting user's id, when known. */
    authorId?: string;
}

/** One revision with its full snapshot body — for preview / restore. */
export interface RevisionDetail extends RevisionSummary {
    /** The captured document. */
    snapshot: RevisionSnapshot;
}

/** The paginated timeline envelope, matching the list-page convention. */
export interface RevisionListView {
    items: RevisionSummary[];
    total: number;
}

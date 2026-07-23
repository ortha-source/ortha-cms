import type { RevisionStatus } from '../domain/revision-status';
import type { RelationRef } from '../../entries/types/entry-list-view';

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
    /**
     * Each relation field's snapshot ids resolved to display refs (title / slug /
     * status), keyed by field name — so the preview shows the actual linked
     * records, not raw uuids. Owning-single fields resolve their FK id from
     * `snapshot.values`; join-backed fields resolve their id list from
     * `snapshot.relations`. **Capped per field** (`relationTotals` carries the
     * true count for a "+N more"), and present only on this detail read — the
     * timeline summaries stay lean.
     */
    relationRefs?: Record<string, RelationRef[]>;
    /** The true link count per relation field (may exceed the capped refs). */
    relationTotals?: Record<string, number>;
}

/** The paginated timeline envelope, matching the list-page convention. */
export interface RevisionListView {
    items: RevisionSummary[];
    total: number;
}

import type { RevisionStatus } from '../domain/revision-status';
import type {
    MediaRef,
    RelationRef
} from '../../entries/types/entry-list-view';

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
    /**
     * What each bound **entry-write extension** held for the entry at capture
     * time, keyed by its `key` — state a different plugin owns in a table this
     * package knows nothing about (`segments` records who could read the entry).
     *
     * Opaque here: content-server stores it, hands it back on a restore, and
     * never looks inside. Absent on an installation with no extensions, and on
     * every version captured before one was installed — so a reader must treat
     * a missing bag as "nothing is known", never as "the entry had none".
     */
    extra?: Record<string, unknown>;
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
    /**
     * Each media field's snapshot asset ids resolved to display refs (name /
     * thumbnail url / kind), keyed by field name — so the preview shows the
     * actual assets, not raw uuids. A single field resolves its id from
     * `snapshot.values`; a `multiple` field its ordered id list. An asset that
     * can't be resolved (deleted / out of workspace) is an id-only `missing` ref.
     * Present only when a media resolver is bound.
     */
    mediaRefs?: Record<string, MediaRef[]>;
}

/** The paginated timeline envelope, matching the list-page convention. */
export interface RevisionListView {
    items: RevisionSummary[];
    total: number;
}

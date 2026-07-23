import { Inject } from '@nestjs/common';
import type { Database } from '@ortha-cms/database';
import type { DbTransaction } from '../../../entries/infrastructure/persistence/relation-link.service';
import type { Revision } from '../../domain/revision';
import type {
    RevisionDetail,
    RevisionListView,
    RevisionSummary
} from '../../types/revision-view';

/** An executor that may be the base connection or an ambient transaction. */
export type RevisionExecutor = Database | DbTransaction;

/**
 * The persistence port for entry revisions. Write primitives are
 * **executor-parameterized** so `EntryWriterService` can append a revision on
 * its own save transaction (atomic with the row + relation writes); reads run on
 * the base connection.
 */
export interface RevisionStore {
    /**
     * The next version number for an entry: `max(revision_number) + 1`, else 1.
     * Runs on the write executor so it sees the entry's own uncommitted rows.
     * The caller serializes concurrent savers with an advisory lock so two
     * appends can't allocate the same number.
     */
    nextNumber(exec: RevisionExecutor, entryId: string): Promise<number>;

    /**
     * Take the entry's transaction-scoped append lock, so concurrent saves of the
     * same entry allocate distinct version numbers instead of colliding.
     */
    lockEntry(exec: RevisionExecutor, entryId: string): Promise<void>;

    /** Insert a revision on `exec`, returning its summary view. */
    append(
        exec: RevisionExecutor,
        revision: Revision
    ): Promise<RevisionSummary>;

    /**
     * Promote the entry's **latest** revision to `published` (stamping
     * `published_at`) and demote any previously-published revision to
     * `superseded`, on `exec`. This is the publish transition the
     * snapshot-on-save defers — every revision is born a `draft`, so without it
     * the timeline never shows a version as live. The latest revision is exactly
     * the just-published live row (every save appends one). Idempotent, and a
     * no-op for an entry with no revisions.
     */
    markPublished(
        exec: RevisionExecutor,
        entryId: string,
        workspaceId: string
    ): Promise<void>;

    /**
     * Demote the entry's currently-published revision back to `draft` (clearing
     * `published_at`) on `exec` — the unpublish counterpart. At most one
     * revision is published, so this transitions exactly that one; a no-op if
     * none is.
     */
    markUnpublished(
        exec: RevisionExecutor,
        entryId: string,
        workspaceId: string
    ): Promise<void>;

    /** One page of an entry's revisions, newest first, scoped to the workspace. */
    list(
        entryId: string,
        workspaceId: string,
        page: number,
        pageSize: number
    ): Promise<RevisionListView>;

    /**
     * One revision (with its snapshot) by version number, scoped to the entry +
     * workspace — or undefined if absent.
     */
    get(
        entryId: string,
        workspaceId: string,
        number: number
    ): Promise<RevisionDetail | undefined>;
}

/** DI token the {@link RevisionStore} is bound under. */
export const REVISION_STORE = Symbol('REVISION_STORE');

/** Injects the {@link RevisionStore}. */
export const InjectRevisionStore = (): ParameterDecorator =>
    Inject(REVISION_STORE);

import { REVISION_STATUS, type RevisionStatus } from './revision-status';
import type { RevisionSnapshot } from '../types/revision-view';

/** The data a new revision is minted from — everything but the store-owned id. */
export interface NewRevisionParams {
    /** The registry content-type machine name. */
    contentType: string;
    /** The live `content_<name>` row (per-locale) the revision belongs to. */
    entryId: string;
    /** Owning workspace. */
    workspaceId: string;
    /** Translation-group id — null on non-i18n types. */
    localeGroupId: string | null;
    /** The row's locale — null on non-i18n types. */
    locale: string | null;
    /** Monotonic version number within the entry (allocated by the store). */
    number: number;
    /** The captured document. */
    snapshot: RevisionSnapshot;
    /** The acting user's id, or null when unknown. */
    createdBy: string | null;
}

/**
 * The **focused domain model** for a content revision. Like {@link Entry}, the
 * revision engine is generic and registry-driven — one store backs every content
 * type — so this models the small piece with real invariants (a new revision is
 * always born a `draft`, carrying a complete snapshot) and leaves the heavy
 * persistence to the infrastructure store.
 *
 * Framework-free (ADR-0003's one hard rule): imports nothing from `@nestjs/*`,
 * `drizzle-orm`, `class-validator`, or the infrastructure layer — only sibling
 * domain types.
 *
 * Event emission (`entry.revision.created`) is intentionally deferred: Phase-1
 * snapshotting runs inside the `EntryWriterService` save transaction, not the
 * `UnitOfWork`, so there is no atomic outbox to append to yet — the same reason
 * `entry.created`/`entry.updated` are still unemitted (see content-server
 * `AGENTS.md`). The model stays event-ready for when those writes move onto the
 * `UnitOfWork`.
 */
export class Revision {
    private constructor(
        private readonly _contentType: string,
        private readonly _entryId: string,
        private readonly _workspaceId: string,
        private readonly _localeGroupId: string | null,
        private readonly _locale: string | null,
        private readonly _number: number,
        private readonly _status: RevisionStatus,
        private readonly _snapshot: RevisionSnapshot,
        private readonly _createdBy: string | null
    ) {}

    /**
     * Mint a new **draft** revision from a just-saved document. A revision is
     * never born published: publishing is a separate, deliberate transition that
     * promotes the entry's latest draft to `published`
     * (`RevisionStore.markPublished`, driven by the publish use-case), and a
     * restore appends a fresh draft rather than rewriting history.
     */
    static createDraft(params: NewRevisionParams): Revision {
        if (!Number.isInteger(params.number) || params.number < 1) {
            throw new Error(
                `Revision number must be a positive integer, got ${params.number}.`
            );
        }
        return new Revision(
            params.contentType,
            params.entryId,
            params.workspaceId,
            params.localeGroupId,
            params.locale,
            params.number,
            REVISION_STATUS.Draft,
            params.snapshot,
            params.createdBy
        );
    }

    /** The version number within the entry. */
    get number(): number {
        return this._number;
    }

    /** The lifecycle state (always `draft` for a freshly-created revision). */
    get status(): RevisionStatus {
        return this._status;
    }

    /**
     * The row to insert — the store adds only the DB-defaulted `id`/`created_at`.
     * Kept here so the persisted shape and the invariants that produced it stay
     * in one place.
     */
    toPersistence(): {
        contentType: string;
        entryId: string;
        workspaceId: string;
        localeGroupId: string | null;
        locale: string | null;
        revisionNumber: number;
        status: RevisionStatus;
        snapshot: RevisionSnapshot;
        createdBy: string | null;
    } {
        return {
            contentType: this._contentType,
            entryId: this._entryId,
            workspaceId: this._workspaceId,
            localeGroupId: this._localeGroupId,
            locale: this._locale,
            revisionNumber: this._number,
            status: this._status,
            snapshot: this._snapshot,
            createdBy: this._createdBy
        };
    }
}

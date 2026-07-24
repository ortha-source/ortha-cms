import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
    Optional,
    UnprocessableEntityException
} from '@nestjs/common';
import {
    and,
    eq,
    inArray,
    isNotNull,
    isNull,
    type AnyColumn,
    type SQL
} from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { lockWorkspaceShared } from '@ortha-cms/workspaces-server';
import { isUniqueViolation } from '@ortha-cms/utils-server';
import {
    CONTENT_ENTRY_EXTENSION,
    type ContentEntryExtension
} from '../../../extension/entry-extension';
import {
    InjectMediaAssetResolver,
    type MediaAssetResolver
} from '../../../extension/media-asset-resolver';
import { acceptsAsset, describeAccept } from './media-accept';
import type { AnyContentType } from '../../../types/content-type';
import { ENTRY_STATUS } from '../../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../../types/fields';
import {
    EntryValidationService,
    type ValidationIssue
} from '../../../validation/services/entry-validation.service';
import type {
    EntryRecord,
    RelationDelta,
    RelationFieldView
} from '../../types/entry-list-view';
import type { BulkActionResult } from '../../types/bulk-publish';
import { coerceValues, toColumns, toRecord } from './entry-row';
import {
    RelationLinkService,
    type DbTransaction
} from './relation-link.service';
import {
    InjectRevisionStore,
    type RevisionStore
} from '../../../revisions/application/ports/revision-store';
import { Revision } from '../../../revisions/domain/revision';
import { buildSnapshot } from '../../../revisions/infrastructure/persistence/revision-snapshot';

/** A generated content table seen as a bag of values / columns by property name. */
type Row = Record<string, unknown>;

/**
 * The infrastructure persistence engine for entry writes — create / read-one /
 * update / delete / restore / purge, plus their bulk variants, plus the small
 * status read/write primitives the **publish-lifecycle use-cases** compose
 * (`findLive`, `markPublished`/`markDraft`, the bulk selectors, and
 * `requiredRelationIssues`). Generic over the content type (like
 * {@link EntriesService}): the physical table and its envelope columns are
 * derived from `type` at request time, so one engine backs every collection.
 *
 * Layering note (ADR-0003): the entries engine is generic and registry-driven —
 * one service backs every content type, with no per-aggregate table — so the
 * heavy, battle-tested column/relation/extension persistence stays here as
 * infrastructure rather than being forced into a row⇄aggregate mapper. The
 * publish **lifecycle** (the part with real invariants) is modelled by the
 * `Entry` domain object and driven by application use-cases, which call the
 * status primitives below through the {@link UnitOfWork} so the write and its
 * outbox events commit atomically. {@link EntryValidationService} remains the
 * gate — nothing is written or published without passing it.
 */
@Injectable()
export class EntryWriterService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly validation: EntryValidationService,
        private readonly relations: RelationLinkService,
        // The generic revision store — every save appends an immutable snapshot
        // inside the same transaction, so the version and the write commit as one.
        @InjectRevisionStore()
        private readonly revisionStore: RevisionStore,
        // The entries extension port (e.g. the i18n plugin's locale stamping
        // and sibling sync) — absent unless a plugin binds it, hence optional.
        @Optional()
        @Inject(CONTENT_ENTRY_EXTENSION)
        private readonly extension?: ContentEntryExtension,
        // The media-asset resolver — bound by the media plugin so a media field's
        // ids can be checked for existence + `accept` in the workspace. Absent
        // when media isn't registered, in which case media fields shape-validate
        // and store only (no existence/restriction check).
        @Optional()
        @InjectMediaAssetResolver()
        private readonly mediaResolver?: MediaAssetResolver
    ) {}

    /**
     * Append an immutable **draft** revision for a just-saved row, on the save's
     * own transaction so the snapshot commits atomically with it. Captures the
     * whole document — the field `values` bag plus the full ordered link sets of
     * every join-backed relation (read back inside `tx`, so it reflects the
     * committed state). The entry's append lock serializes concurrent savers so
     * each allocates a distinct version number.
     */
    private async appendRevision(
        tx: DbTransaction,
        type: AnyContentType,
        row: Row,
        workspaceId: string,
        actorId: string | null
    ): Promise<void> {
        const id = row['id'] as string;
        const links = await this.relations.snapshotLinks(tx, type, row);
        await this.revisionStore.lockEntry(tx, id);
        const number = await this.revisionStore.nextNumber(tx, id);
        const revision = Revision.createDraft({
            contentType: type.name,
            entryId: id,
            workspaceId,
            localeGroupId: (row['localeGroupId'] as string | undefined) ?? null,
            locale: (row['locale'] as string | undefined) ?? null,
            number,
            snapshot: buildSnapshot(type, row, links),
            createdBy: actorId
        });
        await this.revisionStore.append(tx, revision);
    }

    /**
     * Append a revision for each row an extension changed as a side-effect of
     * this save — the locale siblings a shared (non-localized) field is synced
     * to, today.
     *
     * Without this their stored values move while their timeline doesn't, so
     * the history claims a change that never happened to them and hides one
     * that did. Rows are sorted by id before appending: each takes a per-entry
     * advisory lock, and a stable order across concurrent savers is what keeps
     * two of them from deadlocking on the pair.
     */
    private async appendRevisionsFor(
        tx: DbTransaction,
        type: AnyContentType,
        rows: Record<string, unknown>[] | void,
        workspaceId: string,
        actorId: string | null
    ): Promise<void> {
        if (!rows?.length) return;
        const ordered = [...rows].sort((a, b) =>
            String(a['id']).localeCompare(String(b['id']))
        );
        for (const row of ordered) {
            await this.appendRevision(
                tx,
                type,
                row as Row,
                workspaceId,
                actorId
            );
        }
    }

    /**
     * Create an entry **owned by `workspaceId`** (stamped onto the row so the
     * reader's workspace filter and every later scoped write see it). A
     * publishable type starts as a **draft** and may be incomplete — validation
     * is deferred to publish. A non-publishable type is always live, so its
     * values must validate now.
     *
     * The insert runs in a transaction that first takes the workspace's *shared*
     * content lock ({@link lockWorkspaceShared}): it coordinates with the
     * workspace delete / content-revoke guards (which take the lock exclusively),
     * so a new entry can't land between their emptiness check and their mutation
     * and be orphaned. Shared mode keeps concurrent creates non-blocking.
     *
     * `locale` / `localeGroupId` are opaque, extension-owned params: the bound
     * extension validates them and stamps the envelope columns (a
     * `localeGroupId` makes the row a **sibling** in that translation group). A
     * duplicate `(group, locale)` surfaces as a **409** via {@link uniqueGuarded}.
     */
    async create(
        type: AnyContentType,
        values: Record<string, unknown>,
        workspaceId: string,
        relations?: Record<string, RelationDelta>,
        locale?: string,
        localeGroupId?: string,
        actorId?: string | null
    ): Promise<EntryRecord> {
        const coerced = coerceValues(type, values);
        await this.assertRelationTargets(type, coerced, workspaceId);
        await this.assertMediaTargets(type, coerced, workspaceId);
        if (!type.publishable) this.assertValid(type, coerced);
        // Extension-stamped envelope columns (e.g. the validated locale + group
        // id). Resolved before the transaction so an invalid param — unknown
        // locale, or a group id that names no group in the workspace — fails
        // fast. May read the DB (the group check), hence awaited.
        const extensionColumns =
            (await this.extension?.createColumns(type, workspaceId, {
                locale,
                localeGroupId
            })) ?? {};
        // One transaction: take the workspace's shared content lock (coordinates
        // with the delete / content-revoke guards so a new entry can't be
        // orphaned), then write the row, its whole-set join-table links (a
        // many-relation submitted in `values`), and the staged relation deltas —
        // all together, so a failed link write never leaves a half-linked entry.
        // Wrapped in uniqueGuarded so a duplicate (group, locale) on an i18n
        // type is a clean 409 rather than a 500.
        const row = await this.uniqueGuarded(
            () =>
                this.db.transaction(async (tx) => {
                    await lockWorkspaceShared(tx, workspaceId);
                    const [inserted] = await tx
                        .insert(type.table)
                        .values({
                            ...toColumns(type, coerced),
                            workspaceId,
                            ...extensionColumns
                        } as never)
                        .returning();
                    const id = (inserted as Row)['id'] as string;
                    await this.relations.writeLinks(
                        tx,
                        type,
                        id,
                        coerced,
                        workspaceId
                    );
                    await this.applyRelationDeltas(
                        tx,
                        type,
                        id,
                        relations,
                        workspaceId
                    );
                    // A non-publishable type is always live, so — like its scalar
                    // values — a required link-managed relation must be satisfied now.
                    // Checked after the links are written (inside the txn, so it sees
                    // them), so a 422 rolls the whole create back.
                    if (!type.publishable)
                        await this.assertRequiredRelations(
                            tx,
                            type,
                            inserted as Row,
                            workspaceId
                        );
                    // Same side-effects as an update (e.g. syncing shared fields
                    // to locale siblings): a sibling created into an existing
                    // group must land consistent with the group's shared values.
                    // A no-op for a fresh, sibling-less group.
                    const touched = await this.extension?.afterUpdate(
                        tx,
                        type,
                        inserted as Row,
                        coerced,
                        workspaceId
                    );
                    // Snapshot the just-created document as its first revision,
                    // inside this same transaction.
                    await this.appendRevision(
                        tx,
                        type,
                        inserted as Row,
                        workspaceId,
                        actorId ?? null
                    );
                    // …and one for every sibling the extension rewrote, so a
                    // shared value landing on them is in their history too.
                    await this.appendRevisionsFor(
                        tx,
                        type,
                        touched,
                        workspaceId,
                        actorId ?? null
                    );
                    return inserted as Row;
                }),
            type
        );
        return toRecord(type, row);
    }

    /**
     * First page (+ total) of every relation field's links for one live entry,
     * keyed by field name — what the editor loads on open. Each field is
     * paginated, so a relation with many links contributes only its first page.
     * 404 if the entry is missing (or soft-deleted) in this workspace.
     */
    async getRelations(
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<Record<string, RelationFieldView>> {
        const row = await this.findLive(type, id, workspaceId);
        if (!row) throw this.notFound(type, id);
        return this.relations.readAll(type, row, workspaceId);
    }

    /**
     * One page of a single relation field's links (infinite-scroll for a
     * many/inverse relation). 404 if the entry is missing; 400 if `field` isn't a
     * relation on the type.
     */
    async getRelationField(
        type: AnyContentType,
        id: string,
        field: string,
        page: number,
        pageSize: number,
        workspaceId: string
    ): Promise<RelationFieldView> {
        const spec = this.relationSpec(type, field);
        const row = await this.findLive(type, id, workspaceId);
        if (!row) throw this.notFound(type, id);
        return this.relations.readField(
            type,
            row,
            field,
            spec,
            page,
            pageSize,
            workspaceId
        );
    }

    /**
     * Apply the staged per-field relation deltas of a save, inside the entry's
     * transaction — so the row and every link change commit or roll back as one.
     * Each field must be a **many/inverse** relation (a single relation is set
     * through `values`); a single-relation or unknown key is a 400. `applyDelta`
     * validates the linked ids against the workspace (422 on a bad target).
     */
    private async applyRelationDeltas(
        tx: DbTransaction,
        type: AnyContentType,
        id: string,
        relations: Record<string, RelationDelta> | undefined,
        workspaceId: string
    ): Promise<void> {
        if (!relations) return;
        for (const [field, delta] of Object.entries(relations)) {
            const spec = this.relationSpec(type, field);
            const rel = spec.relation;
            // Only a join-backed relation this side owns can persist a delta: an
            // owning many-to-many, or the inverse of a many-to-many (it reuses
            // the owning join table). A single relation (set via `values`) — and,
            // crucially, the inverse of a *single* relation (one-to-many), which
            // owns no writable link from this side — must be rejected here, else
            // `applyDelta` would silently no-op and the save would drop the edit.
            const writable = rel?.inverse
                ? !!rel.to().fields[rel.inverse.field]?.relation?.many
                : !!rel?.many;
            if (!writable) {
                throw new BadRequestException(
                    `Relation "${type.name}.${field}" owns no writable links from this side — ` +
                        `set a single relation via the entry's values; the inverse of a single relation is read-only.`
                );
            }
            await this.relations.applyDelta(
                tx,
                type,
                id,
                field,
                delta,
                workspaceId
            );
        }
    }

    /** Resolve a relation field spec on the type, or 400 if it isn't one. */
    private relationSpec(type: AnyContentType, field: string) {
        const spec = type.fields[field];
        if (spec?.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation) {
            throw new BadRequestException(
                `"${field}" is not a relation field on content type "${type.name}".`
            );
        }
        return spec;
    }

    /** Read one live entry in the workspace, or 404. */
    async getOne(
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<EntryRecord> {
        const row = await this.findLive(type, id, workspaceId);
        if (!row) throw this.notFound(type, id);
        return toRecord(type, row);
    }

    /**
     * Replace a live entry's values, or 404. As with {@link create}, a
     * publishable type's values aren't validated here (a draft may be saved
     * incomplete; publish enforces the rules) — a non-publishable, always-live
     * type validates now.
     */
    async update(
        type: AnyContentType,
        id: string,
        values: Record<string, unknown>,
        workspaceId: string,
        relations?: Record<string, RelationDelta>,
        actorId?: string | null
    ): Promise<EntryRecord> {
        const coerced = coerceValues(type, values);
        await this.assertRelationTargets(type, coerced, workspaceId);
        await this.assertMediaTargets(type, coerced, workspaceId);
        // Whether this write must satisfy the type's required rules now (its
        // scalar values up front, its link-managed relations after the links are
        // written). A **publishable** type's save always produces a **draft**
        // working copy: a draft may be incomplete, so it isn't eagerly validated,
        // and editing an already-published entry moves it back to draft (its
        // previously-published *version* stays live in history until the next
        // publish). A non-publishable type is always live, so every write must
        // validate now.
        const enforceRequired = !type.publishable;
        if (!type.publishable) {
            this.assertValid(type, coerced);
        }
        // One transaction: replace the row's columns, re-sync a whole-set
        // many-relation submitted in `values`, and apply the staged relation
        // deltas — so a save is all-or-nothing.
        const row = await this.db.transaction(async (tx) => {
            const [updated] = await tx
                .update(type.table)
                .set({
                    ...toColumns(type, coerced),
                    // Editing a publishable entry produces a draft working copy —
                    // a published entry moves back to draft (its live version
                    // stays published in history until the next publish).
                    ...(type.publishable
                        ? {
                              status: ENTRY_STATUS.Draft,
                              publishedAt: null
                          }
                        : {}),
                    updatedAt: new Date()
                } as never)
                .where(this.liveWhere(type, id, workspaceId))
                .returning();
            if (!updated) throw this.notFound(type, id);
            await this.relations.writeLinks(tx, type, id, coerced, workspaceId);
            await this.applyRelationDeltas(
                tx,
                type,
                id,
                relations,
                workspaceId
            );
            // Enforce required link-managed relations against the post-delta
            // link set (inside the txn, so it sees the just-written rows); a
            // 422 rolls the whole update back.
            if (enforceRequired)
                await this.assertRequiredRelations(
                    tx,
                    type,
                    updated as Row,
                    workspaceId
                );
            // Extension side-effects of a save (e.g. syncing shared fields to
            // locale siblings) run inside the same transaction — a failure
            // rolls the whole save back.
            const touched = await this.extension?.afterUpdate(
                tx,
                type,
                updated as Row,
                coerced,
                workspaceId
            );
            // Snapshot the updated document as a new draft revision, inside this
            // same transaction.
            await this.appendRevision(
                tx,
                type,
                updated as Row,
                workspaceId,
                actorId ?? null
            );
            // …and one for every sibling the extension rewrote.
            await this.appendRevisionsFor(
                tx,
                type,
                touched,
                workspaceId,
                actorId ?? null
            );
            return updated as Row;
        });
        return toRecord(type, row);
    }

    // ---- publish-lifecycle status primitives -------------------------------
    // These are the SQL the publish/unpublish/bulk use-cases compose; they run
    // on the executor the caller passes (the active unit-of-work transaction),
    // so the status write and its outbox event commit atomically. The
    // validation gate + status transition + event raising live in the `Entry`
    // domain model and its use-cases, not here.

    /**
     * Stamp `status='published'` + `published_at`/`updated_at` on one live row,
     * returning the updated row (or undefined if none matched, i.e. a 404).
     */
    async markPublished(
        exec: Database | DbTransaction,
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<Row | undefined> {
        const [row] = await exec
            .update(type.table)
            .set({
                status: ENTRY_STATUS.Published,
                publishedAt: new Date(),
                updatedAt: new Date()
            } as never)
            .where(this.liveWhere(type, id, workspaceId))
            .returning();
        return row as Row | undefined;
    }

    /**
     * Transition the entry's **revision history** to reflect a publish: its
     * latest revision becomes the live (`published`) version and any prior
     * published one is `superseded`. Runs on the publish transaction's executor
     * (the active unit of work) so the row's status and its history commit as
     * one. Delegates to the revision store — every revision is minted a draft, so
     * this is what makes a published entry read as "Live" in the timeline.
     */
    async markRevisionPublished(
        exec: Database | DbTransaction,
        entryId: string,
        workspaceId: string
    ): Promise<void> {
        await this.revisionStore.markPublished(exec, entryId, workspaceId);
    }

    /**
     * Revert the entry's published revision back to `draft` on `exec` — the
     * unpublish counterpart to {@link markRevisionPublished}.
     */
    async markRevisionUnpublished(
        exec: Database | DbTransaction,
        entryId: string,
        workspaceId: string
    ): Promise<void> {
        await this.revisionStore.markUnpublished(exec, entryId, workspaceId);
    }

    /** Revert one live row to `status='draft'` (clearing `published_at`) on `exec`. */
    async markDraft(
        exec: Database | DbTransaction,
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<Row | undefined> {
        const [row] = await exec
            .update(type.table)
            .set({
                status: ENTRY_STATUS.Draft,
                publishedAt: null,
                updatedAt: new Date()
            } as never)
            .where(this.liveWhere(type, id, workspaceId))
            .returning();
        return row as Row | undefined;
    }

    /**
     * Load the workspace's live rows for `ids` **`FOR UPDATE`** on `exec`, keyed
     * by id — the locked candidate set a bulk publish re-validates inside its
     * transaction (closing the preview→commit TOCTOU window the comments on the
     * original single-transaction bulk publish defended).
     */
    async loadLiveByIdsForUpdate(
        exec: Database | DbTransaction,
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<Map<string, Row>> {
        if (!ids.length) return new Map();
        const t = this.columns(type);
        const deletedGuard = type.paranoid ? isNull(t['deletedAt']) : undefined;
        const rows = (await exec
            .select()
            .from(type.table)
            .where(
                and(
                    inArray(t['id'], ids),
                    this.scope(type, workspaceId),
                    deletedGuard
                )
            )
            .for('update')) as Row[];
        return new Map(rows.map((row) => [row['id'] as string, row]));
    }

    /** Publish a set of ids in one statement on `exec` (the caller pre-filtered them). */
    async markPublishedBulk(
        exec: Database | DbTransaction,
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<void> {
        if (!ids.length) return;
        const t = this.columns(type);
        const deletedGuard = type.paranoid ? isNull(t['deletedAt']) : undefined;
        await exec
            .update(type.table)
            .set({
                status: ENTRY_STATUS.Published,
                publishedAt: new Date(),
                updatedAt: new Date()
            } as never)
            .where(
                and(
                    inArray(t['id'], ids),
                    this.scope(type, workspaceId),
                    deletedGuard
                )
            );
    }

    /**
     * Which of `ids` are currently `published` and live in the workspace, on
     * `exec` — the set a bulk unpublish actually transitions, so it raises one
     * `entry.unpublished` per real change rather than per matched row.
     */
    async publishedIdsAmong(
        exec: Database | DbTransaction,
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<string[]> {
        if (!ids.length) return [];
        const t = this.columns(type);
        const deletedGuard = type.paranoid ? isNull(t['deletedAt']) : undefined;
        const rows = (await exec
            .select()
            .from(type.table)
            .where(
                and(
                    inArray(t['id'], ids),
                    this.scope(type, workspaceId),
                    eq(t['status'], ENTRY_STATUS.Published),
                    deletedGuard
                )
            )) as Row[];
        return rows.map((row) => row['id'] as string);
    }

    /**
     * Revert every live row in `ids` to draft on `exec`, returning how many rows
     * matched — the `{ count }` the bulk endpoint reports, unchanged from the
     * single-statement original (count = live matching rows, not just those that
     * were published).
     */
    async markDraftBulk(
        exec: Database | DbTransaction,
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<number> {
        if (!ids.length) return 0;
        const t = this.columns(type);
        const rows = await exec
            .update(type.table)
            .set({
                status: ENTRY_STATUS.Draft,
                publishedAt: null,
                updatedAt: new Date()
            } as never)
            .where(
                and(
                    inArray(t['id'], ids),
                    this.scope(type, workspaceId),
                    type.paranoid ? isNull(t['deletedAt']) : undefined
                )
            )
            .returning();
        return rows.length;
    }

    /**
     * Delete an entry: soft (stamp `deleted_at`) for a paranoid type, hard
     * `DELETE` otherwise. 404 if there's no live row to remove **in this
     * workspace** — an id from another workspace is indistinguishable from a
     * missing one.
     */
    async remove(
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<void> {
        const t = this.columns(type);
        const scope = this.scope(type, workspaceId);
        const [row] = type.paranoid
            ? await this.db
                  .update(type.table)
                  .set({
                      deletedAt: new Date(),
                      updatedAt: new Date()
                  } as never)
                  .where(and(eq(t['id'], id), scope, isNull(t['deletedAt'])))
                  .returning()
            : await this.db
                  .delete(type.table)
                  .where(and(eq(t['id'], id), scope))
                  .returning();
        if (!row) throw this.notFound(type, id);
    }

    /**
     * Clear a soft-deleted entry's tombstone (paranoid types only), or 404.
     * On an i18n type the restore can collide with a row created in the same
     * (locale group, locale) slot after the soft delete — the partial unique
     * index rejects it, surfaced as a 409 rather than a 500.
     */
    async restore(
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<EntryRecord> {
        this.assertParanoid(type);
        const t = this.columns(type);
        const [row] = await this.uniqueGuarded(
            () =>
                this.db
                    .update(type.table)
                    .set({ deletedAt: null, updatedAt: new Date() } as never)
                    .where(
                        and(
                            eq(t['id'], id),
                            this.scope(type, workspaceId),
                            isNotNull(t['deletedAt'])
                        )
                    )
                    .returning(),
            type
        );
        if (!row) throw this.notFound(type, id);
        return toRecord(type, row as Row);
    }

    /** Permanently delete a tombstoned entry (paranoid types only), or 404. */
    async purge(
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<void> {
        this.assertParanoid(type);
        const t = this.columns(type);
        const [row] = await this.db
            .delete(type.table)
            .where(
                and(
                    eq(t['id'], id),
                    this.scope(type, workspaceId),
                    isNotNull(t['deletedAt'])
                )
            )
            .returning();
        if (!row) throw this.notFound(type, id);
    }

    /** Delete a set of entries: soft for paranoid types, hard otherwise. */
    async bulkRemove(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<BulkActionResult> {
        if (!ids.length) return { count: 0 };
        const t = this.columns(type);
        const scope = this.scope(type, workspaceId);
        const rows = type.paranoid
            ? await this.db
                  .update(type.table)
                  .set({
                      deletedAt: new Date(),
                      updatedAt: new Date()
                  } as never)
                  .where(
                      and(inArray(t['id'], ids), scope, isNull(t['deletedAt']))
                  )
                  .returning()
            : await this.db
                  .delete(type.table)
                  .where(and(inArray(t['id'], ids), scope))
                  .returning();
        return { count: rows.length };
    }

    /** Permanently delete a set of tombstoned entries (paranoid types only). */
    async bulkPurge(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<BulkActionResult> {
        this.assertParanoid(type);
        if (!ids.length) return { count: 0 };
        const t = this.columns(type);
        const rows = await this.db
            .delete(type.table)
            .where(
                and(
                    inArray(t['id'], ids),
                    this.scope(type, workspaceId),
                    isNotNull(t['deletedAt'])
                )
            )
            .returning();
        return { count: rows.length };
    }

    /**
     * Restore a set of soft-deleted entries (paranoid types only). As with
     * {@link restore}, a restored row colliding with a live sibling in its
     * (locale group, locale) slot is a 409 — the whole batch rolls back
     * (single statement), so the caller can retry without the conflicting id.
     */
    async bulkRestore(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<BulkActionResult> {
        this.assertParanoid(type);
        if (!ids.length) return { count: 0 };
        const t = this.columns(type);
        const rows = await this.uniqueGuarded(
            () =>
                this.db
                    .update(type.table)
                    .set({ deletedAt: null, updatedAt: new Date() } as never)
                    .where(
                        and(
                            inArray(t['id'], ids),
                            this.scope(type, workspaceId),
                            isNotNull(t['deletedAt'])
                        )
                    )
                    .returning(),
            type
        );
        return { count: rows.length };
    }

    /**
     * Run a write, translating a Postgres unique violation (23505) into a 409.
     * Only i18n types carry a restore-relevant unique index — the partial
     * `(locale_group_id, locale)` one — so the mapping is scoped to them and
     * any other type's violation still surfaces as the bug it is.
     */
    private async uniqueGuarded<T>(
        write: () => Promise<T>,
        type: AnyContentType
    ): Promise<T> {
        try {
            return await write();
        } catch (error) {
            if (type.i18n && isUniqueViolation(error)) {
                throw new ConflictException(
                    `An entry already occupies this locale in its translation group on "${type.name}".`
                );
            }
            throw error;
        }
    }

    /** The type's generated table seen as a column bag (envelope + fields). */
    private columns(type: AnyContentType): Record<string, AnyColumn> {
        return type.table as unknown as Record<string, AnyColumn>;
    }

    /**
     * `workspace_id = :workspaceId` — the ownership predicate every read and
     * write AND-s in, so a request scoped to one workspace can neither see nor
     * mutate another's rows.
     */
    private scope(type: AnyContentType, workspaceId: string): SQL {
        return eq(this.columns(type)['workspaceId'], workspaceId);
    }

    /**
     * `id = :id` AND the workspace scope AND (for paranoid types)
     * `deleted_at IS NULL`.
     */
    private liveWhere(
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): SQL | undefined {
        const t = this.columns(type);
        return and(
            eq(t['id'], id),
            this.scope(type, workspaceId),
            type.paranoid ? isNull(t['deletedAt']) : undefined
        );
    }

    /**
     * Fetch one live row by id in the workspace, or undefined. Public + executor
     * parameterized so the publish-lifecycle use-cases can read it under the
     * active unit of work; internal callers use the default (base connection).
     */
    async findLive(
        type: AnyContentType,
        id: string,
        workspaceId: string,
        exec: Database | DbTransaction = this.db
    ): Promise<Row | undefined> {
        const [row] = await exec
            .select()
            .from(type.table)
            .where(this.liveWhere(type, id, workspaceId))
            .limit(1);
        return row as Row | undefined;
    }

    /**
     * Fetch the workspace's live rows for a set of ids, keyed by id — the
     * bulk-publish **dry run** (no `FOR UPDATE`; the committed path uses
     * {@link loadLiveByIdsForUpdate}).
     */
    async loadLiveByIds(
        type: AnyContentType,
        ids: string[],
        workspaceId: string,
        exec: Database | DbTransaction = this.db
    ): Promise<Map<string, Row>> {
        if (!ids.length) return new Map();
        const t = this.columns(type);
        const rows = (await exec
            .select()
            .from(type.table)
            .where(
                and(
                    inArray(t['id'], ids),
                    this.scope(type, workspaceId),
                    type.paranoid ? isNull(t['deletedAt']) : undefined
                )
            )) as Row[];
        return new Map(rows.map((row) => [row['id'] as string, row]));
    }

    /**
     * Verify every referenced relation target exists **in the same workspace** —
     * single FKs, many-to-many links, and the inverse (back-reference) side of a
     * two-way relation. Neither the FK column nor the join table has a workspace
     * constraint of its own (the target table is workspace-scoped only at the app
     * layer), so without this a caller could reference — or probe the existence
     * of — an entry in another workspace. Batched one existence query per
     * referenced target type; a missing or cross-workspace target surfaces as a
     * uniform 422 validation issue (indistinguishable from a plain "invalid id",
     * so no not-found-vs-forbidden enumeration signal). Runs on every
     * create/update, draft or not, because links are written eagerly either way.
     * An inverse-of-single (one-to-many) field owns no writable link from this
     * side, so it's skipped.
     */
    private async assertRelationTargets(
        type: AnyContentType,
        values: Record<string, unknown>,
        workspaceId: string
    ): Promise<void> {
        // Group referenced ids by target content type so each type is probed once.
        const byTarget = new Map<
            AnyContentType,
            { field: string; id: string }[]
        >();
        for (const [name, spec] of Object.entries(type.fields)) {
            if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation)
                continue;
            const relation = spec.relation;
            // An owning many-to-many array submitted in `values` is re-validated
            // in-transaction by `writeLinks` (the same uniform 422), so skip it
            // here to avoid a duplicate existence probe. The inverse array and
            // owning single FKs aren't checked in-tx, so they stay validated here.
            if (relation.many && !relation.inverse) continue;
            if (relation.inverse) {
                // Inverse of a single relation writes nothing from this side;
                // only the inverse of a many-to-many links (its ids are owner
                // rows of the referenced type).
                const owningField =
                    relation.to().fields[relation.inverse.field];
                if (!owningField?.relation?.many) continue;
            }
            const ids =
                relation.many || relation.inverse
                    ? Array.isArray(values[name])
                        ? (values[name] as unknown[])
                        : []
                    : [values[name]];
            const target = relation.to();
            const refs = byTarget.get(target) ?? [];
            for (const id of ids) {
                if (typeof id !== 'string' || !id) continue;
                refs.push({ field: name, id });
            }
            if (refs.length) byTarget.set(target, refs);
        }
        if (!byTarget.size) return;

        const issues: ValidationIssue[] = [];
        for (const [target, refs] of byTarget) {
            const t = target.table as unknown as Record<string, AnyColumn>;
            const ids = [...new Set(refs.map((ref) => ref.id))];
            const rows = (await this.db
                .select()
                .from(target.table)
                .where(
                    and(
                        inArray(t['id'], ids),
                        eq(t['workspaceId'], workspaceId)
                    )
                )) as Row[];
            const present = new Set(rows.map((row) => row['id'] as string));
            for (const ref of refs) {
                if (!present.has(ref.id))
                    issues.push({
                        field: ref.field,
                        message: 'must reference an existing entry'
                    });
            }
        }
        if (issues.length) {
            throw new UnprocessableEntityException({
                message: 'Entry validation failed',
                issues
            });
        }
    }

    /**
     * Validate every media field's asset ids: each must reference an asset that
     * **exists in the same workspace** and whose kind/MIME satisfies the field's
     * `accept` restriction. Mirrors {@link assertRelationTargets} — asset ids are
     * plain uuids with no FK (the assets live in the media plugin's schema), so
     * without this a caller could reference — or probe — an asset in another
     * workspace, or attach a disallowed file type. Batched: one resolver lookup
     * across every media id on the entry.
     *
     * A **missing** asset and a **cross-workspace** one both read as the same
     * uniform 422 (the resolver simply omits them from its map — no
     * not-found-vs-forbidden enumeration signal). When no resolver is bound (the
     * media plugin isn't registered) this is a no-op: media fields shape-validate
     * and store their ids, but existence/restriction aren't enforced.
     */
    private async assertMediaTargets(
        type: AnyContentType,
        values: Record<string, unknown>,
        workspaceId: string
    ): Promise<void> {
        if (!this.mediaResolver) return;
        // Collect every referenced asset id, remembering which field each came
        // from so a violation names the right field.
        const refs: { field: string; id: string }[] = [];
        for (const [name, spec] of Object.entries(type.fields)) {
            if (spec.type !== CONTENT_FIELD_TYPE.Media) continue;
            const value = values[name];
            const ids = Array.isArray(value)
                ? value
                : typeof value === 'string' && value
                  ? [value]
                  : [];
            for (const id of ids) {
                if (typeof id === 'string' && id) refs.push({ field: name, id });
            }
        }
        if (!refs.length) return;

        const resolved = await this.mediaResolver.resolve(
            [...new Set(refs.map((ref) => ref.id))],
            workspaceId
        );
        const issues: ValidationIssue[] = [];
        for (const ref of refs) {
            const asset = resolved.get(ref.id);
            if (!asset) {
                issues.push({
                    field: ref.field,
                    message: 'must reference an existing asset'
                });
                continue;
            }
            const spec = type.fields[ref.field];
            if (!acceptsAsset(spec.accept, asset)) {
                issues.push({
                    field: ref.field,
                    message: `must be ${describeAccept(spec.accept)}`
                });
            }
        }
        if (issues.length) {
            throw new UnprocessableEntityException({
                message: 'Entry validation failed',
                issues
            });
        }
    }

    /**
     * Enforce required **link-managed** relations (an owning many-to-many, or the
     * inverse of one) against the entry's actual link set — the check
     * {@link EntryValidationService} can't make, because those links never travel
     * in the `values` bag it sees. A required such relation with zero links is a
     * 422 `is required`, matching how a required scalar field reads. A single FK
     * relation is validated in `values` already; an inverse-of-single owns no
     * writable link from this side, so it's skipped (it can't be satisfied here).
     * `exec` is the write transaction on create/update (so it counts the
     * just-written, uncommitted rows) or the root client on publish (committed).
     */
    private async assertRequiredRelations(
        exec: Database | DbTransaction,
        type: AnyContentType,
        row: Row,
        workspaceId: string
    ): Promise<void> {
        const issues = await this.requiredRelationIssues(
            exec,
            type,
            row,
            workspaceId
        );
        if (issues.length) {
            throw new UnprocessableEntityException({
                message: 'Entry validation failed',
                issues
            });
        }
    }

    /**
     * The `is required` issues for required **link-managed** relations (an owning
     * many-to-many, or the inverse of one) whose link set is empty — the check
     * {@link EntryValidationService} can't make, since those links never travel
     * in the `values` bag. Returns the issues rather than throwing, so the
     * publish use-case can fold them into the `Entry` domain publish gate. `exec`
     * is the write transaction (counting just-written rows) on create/update, or
     * the unit-of-work transaction on publish.
     */
    async requiredRelationIssues(
        exec: Database | DbTransaction,
        type: AnyContentType,
        row: Row,
        workspaceId: string
    ): Promise<ValidationIssue[]> {
        const issues: ValidationIssue[] = [];
        for (const [name, spec] of Object.entries(type.fields)) {
            if (
                spec.type !== CONTENT_FIELD_TYPE.Relation ||
                !spec.relation ||
                !spec.required
            )
                continue;
            const rel = spec.relation;
            // Only relations this side owns writable links for are counted:
            // an owning many-to-many, or the inverse of a many-to-many.
            const writable = rel.inverse
                ? !!rel.to().fields[rel.inverse.field]?.relation?.many
                : !!rel.many;
            if (!writable) continue;
            const total = await this.relations.countLinks(
                exec,
                type,
                row,
                name,
                spec,
                workspaceId
            );
            if (total === 0)
                issues.push({ field: name, message: 'is required' });
        }
        return issues;
    }

    /** Throw 422 with the issue list when the values fail validation. */
    private assertValid(
        type: AnyContentType,
        values: Record<string, unknown>
    ): void {
        const result = this.validation.validate(type, values);
        if (!result.valid) {
            throw new UnprocessableEntityException({
                message: 'Entry validation failed',
                issues: result.issues
            });
        }
    }

    /** Reject restore/purge on a type without soft delete. */
    private assertParanoid(type: AnyContentType): void {
        if (!type.paranoid) {
            throw new BadRequestException(
                `Content type "${type.name}" does not support trash/restore.`
            );
        }
    }

    private notFound(type: AnyContentType, id: string): NotFoundException {
        return new NotFoundException(
            `No entry "${id}" on content type "${type.name}".`
        );
    }
}

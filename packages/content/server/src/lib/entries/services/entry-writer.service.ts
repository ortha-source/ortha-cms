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
import { lockWorkspaceShared } from '@ortha-cms/identity-server';
import { isUniqueViolation } from '@ortha-cms/utils-server';
import {
    CONTENT_ENTRY_EXTENSION,
    type ContentEntryExtension
} from '../../extension/entry-extension';
import type { AnyContentType, EntryStatus } from '../../types/content-type';
import { ENTRY_STATUS } from '../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../types/fields';
import {
    EntryValidationService,
    type ValidationIssue
} from '../../validation/services/entry-validation.service';
import type {
    EntryRecord,
    RelationDelta,
    RelationFieldView
} from '../types/entry-list-view';
import {
    BULK_VERDICT,
    type BulkActionResult,
    type BulkPublishCheck,
    type BulkPublishPreview,
    type BulkPublishResult,
    type BulkPublishVerdict
} from '../types/bulk-publish';
import { coerceValues, entryTitle, toColumns, toRecord } from './entry-row';
import { RelationLinkService } from './relation-link.service';

/** A generated content table seen as a bag of values / columns by property name. */
type Row = Record<string, unknown>;

/**
 * The write half of the entries pipeline — create / read-one / update / publish
 * / unpublish / delete / restore / purge, plus their bulk variants. Generic over
 * the content type (like {@link EntriesService}): the physical table and its
 * envelope columns are derived from `type` at request time, so one service backs
 * every collection. {@link EntryValidationService} is the gate — nothing is
 * written or published without passing it.
 */
@Injectable()
export class EntryWriterService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly validation: EntryValidationService,
        private readonly relations: RelationLinkService,
        // The entries extension port (e.g. the i18n plugin's locale stamping
        // and sibling sync) — absent unless a plugin binds it, hence optional.
        @Optional()
        @Inject(CONTENT_ENTRY_EXTENSION)
        private readonly extension?: ContentEntryExtension
    ) {}

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
     */
    async create(
        type: AnyContentType,
        values: Record<string, unknown>,
        workspaceId: string,
        relations?: Record<string, RelationDelta>,
        locale?: string
    ): Promise<EntryRecord> {
        const coerced = coerceValues(type, values);
        await this.assertRelationTargets(type, coerced, workspaceId);
        if (!type.publishable) this.assertValid(type, coerced);
        // Extension-stamped envelope columns (e.g. the validated locale).
        // Resolved before the transaction so an invalid param fails fast.
        const extensionColumns =
            this.extension?.createColumns(type, workspaceId, { locale }) ?? {};
        // One transaction: take the workspace's shared content lock (coordinates
        // with the delete / content-revoke guards so a new entry can't be
        // orphaned), then write the row, its whole-set join-table links (a
        // many-relation submitted in `values`), and the staged relation deltas —
        // all together, so a failed link write never leaves a half-linked entry.
        const row = await this.db.transaction(async (tx) => {
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
            await this.relations.writeLinks(tx, type, id, coerced, workspaceId);
            await this.applyRelationDeltas(
                tx,
                type,
                id,
                relations,
                workspaceId
            );
            return inserted as Row;
        });
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
        tx: Parameters<Parameters<Database['transaction']>[0]>[0],
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
        relations?: Record<string, RelationDelta>
    ): Promise<EntryRecord> {
        const coerced = coerceValues(type, values);
        await this.assertRelationTargets(type, coerced, workspaceId);
        if (!type.publishable) {
            // Always-live type: every write must validate.
            this.assertValid(type, coerced);
        } else {
            // A draft may be saved incomplete, but a **published** row must stay
            // valid — you can't null out a required field on live content
            // without unpublishing first.
            const current = await this.findLive(type, id, workspaceId);
            if (!current) throw this.notFound(type, id);
            if (current['status'] === ENTRY_STATUS.Published) {
                this.assertValid(type, coerced);
            }
        }
        // One transaction: replace the row's columns, re-sync a whole-set
        // many-relation submitted in `values`, and apply the staged relation
        // deltas — so a save is all-or-nothing.
        const row = await this.db.transaction(async (tx) => {
            const [updated] = await tx
                .update(type.table)
                .set({
                    ...toColumns(type, coerced),
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
            // Extension side-effects of a save (e.g. syncing shared fields to
            // locale siblings) run inside the same transaction — a failure
            // rolls the whole save back.
            await this.extension?.afterUpdate(
                tx,
                type,
                updated as Row,
                coerced,
                workspaceId
            );
            return updated as Row;
        });
        return toRecord(type, row);
    }

    /** Validate the stored row, then mark it published (publishable types only). */
    async publish(
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<EntryRecord> {
        this.assertPublishable(type);
        const current = await this.findLive(type, id, workspaceId);
        if (!current) throw this.notFound(type, id);
        // Re-validate stored values: a row saved as a draft before its schema
        // tightened must not slip through to published.
        this.assertValid(type, toRecord(type, current).values);
        const [row] = await this.db
            .update(type.table)
            .set({
                status: ENTRY_STATUS.Published,
                publishedAt: new Date(),
                updatedAt: new Date()
            } as never)
            .where(this.liveWhere(type, id, workspaceId))
            .returning();
        if (!row) throw this.notFound(type, id);
        return toRecord(type, row as Row);
    }

    /** Revert a live entry to draft (publishable types only). */
    async unpublish(
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<EntryRecord> {
        this.assertPublishable(type);
        const [row] = await this.db
            .update(type.table)
            .set({
                status: ENTRY_STATUS.Draft,
                publishedAt: null,
                updatedAt: new Date()
            } as never)
            .where(this.liveWhere(type, id, workspaceId))
            .returning();
        if (!row) throw this.notFound(type, id);
        return toRecord(type, row as Row);
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

    /**
     * Dry-run a publish over a set of ids: validate each live row and report a
     * verdict (will-publish / already-published / blocked / not-found) in
     * request order. Writes nothing.
     */
    async previewBulkPublish(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<BulkPublishPreview> {
        this.assertPublishable(type);
        const byId = await this.loadLiveByIds(type, ids, workspaceId);
        return { items: this.verdictsFor(type, ids, byId) };
    }

    /**
     * Commit a bulk publish. The validation gate is **locked**: the candidate
     * rows are selected `FOR UPDATE` and re-validated inside one transaction, so
     * a concurrent edit can't invalidate a row between the dry run and the write
     * (the single-statement preview-then-update split had that TOCTOU window).
     * Publishes only the `publishable` ids, reporting which were skipped and why.
     */
    async bulkPublish(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<BulkPublishResult> {
        this.assertPublishable(type);
        if (!ids.length) return { published: [], skipped: [] };
        const t = this.columns(type);
        const scope = this.scope(type, workspaceId);
        const deletedGuard = type.paranoid ? isNull(t['deletedAt']) : undefined;
        return this.db.transaction(async (tx) => {
            const rows = (await tx
                .select()
                .from(type.table)
                .where(and(inArray(t['id'], ids), scope, deletedGuard))
                .for('update')) as Row[];
            const byId = new Map(rows.map((row) => [row['id'] as string, row]));
            const items = this.verdictsFor(type, ids, byId);
            const published = items
                .filter((item) => item.verdict === BULK_VERDICT.Publishable)
                .map((item) => item.id);
            if (published.length) {
                await tx
                    .update(type.table)
                    .set({
                        status: ENTRY_STATUS.Published,
                        publishedAt: new Date(),
                        updatedAt: new Date()
                    } as never)
                    .where(
                        and(inArray(t['id'], published), scope, deletedGuard)
                    );
            }
            const skipped = items
                .filter((item) => item.verdict !== BULK_VERDICT.Publishable)
                .map((item) => ({ id: item.id, reason: item.verdict }));
            return { published, skipped };
        });
    }

    /**
     * Compute the per-entry publish verdict (will-publish / already-published /
     * blocked / not-found) for `ids` in request order, given the live rows keyed
     * by id. Pure — the dry run and the committed {@link bulkPublish} share it so
     * they can't disagree on what's publishable.
     */
    private verdictsFor(
        type: AnyContentType,
        ids: string[],
        byId: Map<string, Row>
    ): BulkPublishVerdict[] {
        return ids.map((id): BulkPublishVerdict => {
            const row = byId.get(id);
            if (!row) {
                return {
                    id,
                    title: id,
                    status: null,
                    verdict: BULK_VERDICT.NotFound,
                    issues: [],
                    checks: []
                };
            }
            const title = entryTitle(type, row);
            const status = row['status'] as EntryStatus;
            if (status === ENTRY_STATUS.Published) {
                // Already published, so nothing will change — but still surface
                // its per-field gate (an already-published row is valid, so the
                // checks all pass) so the dialog can expand it like every other
                // row instead of leaving it a dead, non-collapsible entry.
                const result = this.validation.validate(
                    type,
                    toRecord(type, row).values
                );
                return {
                    id,
                    title,
                    status,
                    verdict: BULK_VERDICT.AlreadyPublished,
                    issues: [],
                    checks: this.buildChecks(type, result.issues)
                };
            }
            const result = this.validation.validate(
                type,
                toRecord(type, row).values
            );
            return {
                id,
                title,
                status,
                verdict: result.valid
                    ? BULK_VERDICT.Publishable
                    : BULK_VERDICT.Blocked,
                issues: result.issues,
                checks: this.buildChecks(type, result.issues)
            };
        });
    }

    /**
     * The per-field publish-gate checklist for one record: every required field
     * plus any field that has an issue, each marked pass/fail. Mirrors the
     * editor's Publish Gate so a row can show its passed fields, not just the
     * failures.
     */
    private buildChecks(
        type: AnyContentType,
        issues: ValidationIssue[]
    ): BulkPublishCheck[] {
        const byField = new Map<string, string>();
        for (const issue of issues) {
            if (!byField.has(issue.field))
                byField.set(issue.field, issue.message);
        }
        return Object.entries(type.fields)
            .filter(([name, spec]) => spec.required || byField.has(name))
            .map(([name, spec]) => ({
                field: name,
                label: spec.admin.label ?? name,
                ok: !byField.has(name),
                message: byField.get(name)
            }));
    }

    /** Revert a set of live entries to draft. */
    async bulkUnpublish(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<BulkActionResult> {
        this.assertPublishable(type);
        if (!ids.length) return { count: 0 };
        const t = this.columns(type);
        const rows = await this.db
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
        return { count: rows.length };
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

    /** Fetch one live row by id in the workspace, or undefined. */
    private async findLive(
        type: AnyContentType,
        id: string,
        workspaceId: string
    ): Promise<Row | undefined> {
        const [row] = await this.db
            .select()
            .from(type.table)
            .where(this.liveWhere(type, id, workspaceId))
            .limit(1);
        return row as Row | undefined;
    }

    /** Fetch the workspace's live rows for a set of ids, keyed by id. */
    private async loadLiveByIds(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<Map<string, Row>> {
        if (!ids.length) return new Map();
        const t = this.columns(type);
        const rows = (await this.db
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
                    and(inArray(t['id'], ids), eq(t['workspaceId'], workspaceId))
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

    /** Reject publish/unpublish on a type with no publish workflow. */
    private assertPublishable(type: AnyContentType): void {
        if (!type.publishable) {
            throw new BadRequestException(
                `Content type "${type.name}" is not publishable.`
            );
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

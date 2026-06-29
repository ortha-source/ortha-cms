import {
    BadRequestException,
    Injectable,
    NotFoundException,
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
import type { AnyContentType, EntryStatus } from '../../types/content-type';
import { ENTRY_STATUS } from '../../types/content-type';
import { EntryValidationService } from '../../validation/services/entry-validation.service';
import type { EntryRecord } from '../types/entry-list-view';
import {
    BULK_VERDICT,
    type BulkActionResult,
    type BulkPublishPreview,
    type BulkPublishResult,
    type BulkPublishVerdict
} from '../types/bulk-publish';
import { coerceValues, entryTitle, toColumns, toRecord } from './entry-row';

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
        private readonly validation: EntryValidationService
    ) {}

    /**
     * Create an entry. A publishable type starts as a **draft** and may be
     * incomplete — validation is deferred to publish. A non-publishable type is
     * always live, so its values must validate now.
     */
    async create(
        type: AnyContentType,
        values: Record<string, unknown>
    ): Promise<EntryRecord> {
        const coerced = coerceValues(type, values);
        if (!type.publishable) this.assertValid(type, coerced);
        const [row] = await this.db
            .insert(type.table)
            .values(toColumns(type, coerced) as never)
            .returning();
        return toRecord(type, row as Row);
    }

    /** Read one live entry, or 404. */
    async getOne(type: AnyContentType, id: string): Promise<EntryRecord> {
        const row = await this.findLive(type, id);
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
        values: Record<string, unknown>
    ): Promise<EntryRecord> {
        const coerced = coerceValues(type, values);
        if (!type.publishable) {
            // Always-live type: every write must validate.
            this.assertValid(type, coerced);
        } else {
            // A draft may be saved incomplete, but a **published** row must stay
            // valid — you can't null out a required field on live content
            // without unpublishing first.
            const current = await this.findLive(type, id);
            if (!current) throw this.notFound(type, id);
            if (current['status'] === ENTRY_STATUS.Published) {
                this.assertValid(type, coerced);
            }
        }
        const [row] = await this.db
            .update(type.table)
            .set({ ...toColumns(type, coerced), updatedAt: new Date() } as never)
            .where(this.liveWhere(type, id))
            .returning();
        if (!row) throw this.notFound(type, id);
        return toRecord(type, row as Row);
    }

    /** Validate the stored row, then mark it published (publishable types only). */
    async publish(type: AnyContentType, id: string): Promise<EntryRecord> {
        this.assertPublishable(type);
        const current = await this.findLive(type, id);
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
            .where(this.liveWhere(type, id))
            .returning();
        if (!row) throw this.notFound(type, id);
        return toRecord(type, row as Row);
    }

    /** Revert a live entry to draft (publishable types only). */
    async unpublish(type: AnyContentType, id: string): Promise<EntryRecord> {
        this.assertPublishable(type);
        const [row] = await this.db
            .update(type.table)
            .set({
                status: ENTRY_STATUS.Draft,
                publishedAt: null,
                updatedAt: new Date()
            } as never)
            .where(this.liveWhere(type, id))
            .returning();
        if (!row) throw this.notFound(type, id);
        return toRecord(type, row as Row);
    }

    /**
     * Delete an entry: soft (stamp `deleted_at`) for a paranoid type, hard
     * `DELETE` otherwise. 404 if there's no live row to remove.
     */
    async remove(type: AnyContentType, id: string): Promise<void> {
        const t = this.columns(type);
        const [row] = type.paranoid
            ? await this.db
                  .update(type.table)
                  .set({ deletedAt: new Date(), updatedAt: new Date() } as never)
                  .where(and(eq(t['id'], id), isNull(t['deletedAt'])))
                  .returning()
            : await this.db
                  .delete(type.table)
                  .where(eq(t['id'], id))
                  .returning();
        if (!row) throw this.notFound(type, id);
    }

    /** Clear a soft-deleted entry's tombstone (paranoid types only), or 404. */
    async restore(type: AnyContentType, id: string): Promise<EntryRecord> {
        this.assertParanoid(type);
        const t = this.columns(type);
        const [row] = await this.db
            .update(type.table)
            .set({ deletedAt: null, updatedAt: new Date() } as never)
            .where(and(eq(t['id'], id), isNotNull(t['deletedAt'])))
            .returning();
        if (!row) throw this.notFound(type, id);
        return toRecord(type, row as Row);
    }

    /** Permanently delete a tombstoned entry (paranoid types only), or 404. */
    async purge(type: AnyContentType, id: string): Promise<void> {
        this.assertParanoid(type);
        const t = this.columns(type);
        const [row] = await this.db
            .delete(type.table)
            .where(and(eq(t['id'], id), isNotNull(t['deletedAt'])))
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
        ids: string[]
    ): Promise<BulkPublishPreview> {
        this.assertPublishable(type);
        const byId = await this.loadLiveByIds(type, ids);
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
        ids: string[]
    ): Promise<BulkPublishResult> {
        this.assertPublishable(type);
        if (!ids.length) return { published: [], skipped: [] };
        const t = this.columns(type);
        const deletedGuard = type.paranoid
            ? isNull(t['deletedAt'])
            : undefined;
        return this.db.transaction(async (tx) => {
            const rows = (await tx
                .select()
                .from(type.table)
                .where(and(inArray(t['id'], ids), deletedGuard))
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
                    .where(and(inArray(t['id'], published), deletedGuard));
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
                    issues: []
                };
            }
            const title = entryTitle(type, row);
            const status = row['status'] as EntryStatus;
            if (status === ENTRY_STATUS.Published) {
                return {
                    id,
                    title,
                    status,
                    verdict: BULK_VERDICT.AlreadyPublished,
                    issues: []
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
                issues: result.issues
            };
        });
    }

    /** Revert a set of live entries to draft. */
    async bulkUnpublish(
        type: AnyContentType,
        ids: string[]
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
                    type.paranoid ? isNull(t['deletedAt']) : undefined
                )
            )
            .returning();
        return { count: rows.length };
    }

    /** Delete a set of entries: soft for paranoid types, hard otherwise. */
    async bulkRemove(
        type: AnyContentType,
        ids: string[]
    ): Promise<BulkActionResult> {
        if (!ids.length) return { count: 0 };
        const t = this.columns(type);
        const rows = type.paranoid
            ? await this.db
                  .update(type.table)
                  .set({ deletedAt: new Date(), updatedAt: new Date() } as never)
                  .where(and(inArray(t['id'], ids), isNull(t['deletedAt'])))
                  .returning()
            : await this.db
                  .delete(type.table)
                  .where(inArray(t['id'], ids))
                  .returning();
        return { count: rows.length };
    }

    /** Permanently delete a set of tombstoned entries (paranoid types only). */
    async bulkPurge(
        type: AnyContentType,
        ids: string[]
    ): Promise<BulkActionResult> {
        this.assertParanoid(type);
        if (!ids.length) return { count: 0 };
        const t = this.columns(type);
        const rows = await this.db
            .delete(type.table)
            .where(and(inArray(t['id'], ids), isNotNull(t['deletedAt'])))
            .returning();
        return { count: rows.length };
    }

    /** Restore a set of soft-deleted entries (paranoid types only). */
    async bulkRestore(
        type: AnyContentType,
        ids: string[]
    ): Promise<BulkActionResult> {
        this.assertParanoid(type);
        if (!ids.length) return { count: 0 };
        const t = this.columns(type);
        const rows = await this.db
            .update(type.table)
            .set({ deletedAt: null, updatedAt: new Date() } as never)
            .where(and(inArray(t['id'], ids), isNotNull(t['deletedAt'])))
            .returning();
        return { count: rows.length };
    }

    /** The type's generated table seen as a column bag (envelope + fields). */
    private columns(type: AnyContentType): Record<string, AnyColumn> {
        return type.table as unknown as Record<string, AnyColumn>;
    }

    /** `id = :id` AND (for paranoid types) `deleted_at IS NULL`. */
    private liveWhere(type: AnyContentType, id: string): SQL | undefined {
        const t = this.columns(type);
        return and(
            eq(t['id'], id),
            type.paranoid ? isNull(t['deletedAt']) : undefined
        );
    }

    /** Fetch one live row by id, or undefined. */
    private async findLive(
        type: AnyContentType,
        id: string
    ): Promise<Row | undefined> {
        const [row] = await this.db
            .select()
            .from(type.table)
            .where(this.liveWhere(type, id))
            .limit(1);
        return row as Row | undefined;
    }

    /** Fetch the live rows for a set of ids, keyed by id. */
    private async loadLiveByIds(
        type: AnyContentType,
        ids: string[]
    ): Promise<Map<string, Row>> {
        if (!ids.length) return new Map();
        const t = this.columns(type);
        const rows = (await this.db
            .select()
            .from(type.table)
            .where(
                and(
                    inArray(t['id'], ids),
                    type.paranoid ? isNull(t['deletedAt']) : undefined
                )
            )) as Row[];
        return new Map(rows.map((row) => [row['id'] as string, row]));
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

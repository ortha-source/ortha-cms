import { BadRequestException, Injectable } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import { ENTRY_STATUS } from '@ortha-cms/content-domain';
import type { AnyContentType } from '../../../types/content-type';
import { EntryValidationService } from '../../../validation/services/entry-validation.service';
import { EntryWriterService } from '../../infrastructure/persistence/entry-writer.service';
import { computeBulkPublishVerdicts } from '../../infrastructure/persistence/bulk-publish-verdicts';
import { BULK_VERDICT, type BulkPublishResult } from '../../types/bulk-publish';
import { Entry } from '../../domain/entry';

/**
 * Commit a bulk publish. Preserves the original single **locked** transaction:
 * the candidate rows are selected `FOR UPDATE` and re-validated inside one
 * unit of work, so a concurrent edit can't invalidate a row between the dry run
 * and the write (the TOCTOU window the original defended). Publishes only the
 * `publishable` ids, reporting which were skipped and why (partial success),
 * and appends one `entry.published` event per newly-published id to the outbox —
 * atomically with the batch.
 */
@Injectable()
export class BulkPublishEntriesUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly writer: EntryWriterService,
        private readonly validation: EntryValidationService
    ) {}

    async execute(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<BulkPublishResult> {
        if (!type.publishable) {
            throw new BadRequestException(
                `Content type "${type.name}" is not publishable.`
            );
        }
        if (!ids.length) return { published: [], skipped: [] };

        return this.uow.run(async () => {
            const exec = this.uow.current();
            const byId = await this.writer.loadLiveByIdsForUpdate(
                exec,
                type,
                ids,
                workspaceId
            );
            const items = computeBulkPublishVerdicts(
                type,
                ids,
                byId,
                (t, values) => this.validation.validate(t, values)
            );
            const published = items
                .filter((item) => item.verdict === BULK_VERDICT.Publishable)
                .map((item) => item.id);

            if (published.length) {
                await this.writer.markPublishedBulk(
                    exec,
                    type,
                    published,
                    workspaceId
                );
                // Promote each published entry's latest revision to live, so the
                // history timeline matches however the entry was published.
                for (const id of published) {
                    await this.writer.markRevisionPublished(
                        exec,
                        id,
                        workspaceId
                    );
                }
                await this.outbox.append(
                    published.flatMap((id) => {
                        const entry = Entry.rehydrate({
                            id,
                            contentType: type.name,
                            status: ENTRY_STATUS.Draft
                        });
                        entry.publish({ valid: true, issues: [] });
                        return entry.pullEvents();
                    })
                );
            }

            const skipped = items
                .filter((item) => item.verdict !== BULK_VERDICT.Publishable)
                .map((item) => ({ id: item.id, reason: item.verdict }));
            return { published, skipped };
        });
    }
}

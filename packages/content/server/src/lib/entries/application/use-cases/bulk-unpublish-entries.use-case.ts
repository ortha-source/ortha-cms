import { BadRequestException, Injectable } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import { ENTRY_STATUS } from '@ortha-cms/content-domain';
import type { AnyContentType } from '../../../types/content-type';
import { EntryWriterService } from '../../infrastructure/persistence/entry-writer.service';
import type { BulkActionResult } from '../../types/bulk-publish';
import { Entry } from '../../domain/entry';

/**
 * Revert a set of live entries to draft. Runs inside one {@link UnitOfWork}: the
 * `{ count }` it reports is the number of live matching rows (unchanged from the
 * original single-statement behavior), while an `entry.unpublished` event is
 * appended only for the ids that were actually `published` before — a real
 * transition — so the outbox never records a spurious unpublish for a row that
 * was already a draft. 400 on a non-publishable type.
 */
@Injectable()
export class BulkUnpublishEntriesUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly writer: EntryWriterService
    ) {}

    async execute(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<BulkActionResult> {
        if (!type.publishable) {
            throw new BadRequestException(
                `Content type "${type.name}" is not publishable.`
            );
        }
        if (!ids.length) return { count: 0 };

        return this.uow.run(async () => {
            const exec = this.uow.current();
            // The set that actually transitions (published → draft), captured
            // before the write so we emit one event per real change.
            const publishedIds = await this.writer.publishedIdsAmong(
                exec,
                type,
                ids,
                workspaceId
            );
            const count = await this.writer.markDraftBulk(
                exec,
                type,
                ids,
                workspaceId
            );
            await this.outbox.append(
                publishedIds.flatMap((id) => {
                    const entry = Entry.rehydrate({
                        id,
                        contentType: type.name,
                        status: ENTRY_STATUS.Published
                    });
                    entry.unpublish();
                    return entry.pullEvents();
                })
            );
            return { count };
        });
    }
}

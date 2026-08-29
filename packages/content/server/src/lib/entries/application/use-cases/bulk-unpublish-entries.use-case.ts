import { BadRequestException, Injectable } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@orthacms/database';
import { ENTRY_STATUS } from '@orthacms/content-domain';
import type { AnyContentType } from '../../../types/content-type';
import { EntryWriterService } from '../../infrastructure/persistence/entry-writer.service';
import type { BulkActionResult } from '../../types/bulk-publish';
import { Entry } from '../../domain/entry';

/**
 * Revert a set of live entries to draft. Runs inside one {@link UnitOfWork}, and
 * **one set of ids runs through all three effects**: the `{ count }` reported,
 * the revisions reverted, and the `entry.unpublished` events appended are the
 * rows that were `published` before the write and no others.
 *
 * The count used to be broader — every live row the id list matched, draft ones
 * included — while the events were already per real transition. Two numbers for
 * one operation, and the wider of them was the one the caller was shown. 400 on
 * a non-publishable type.
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
            // Revert each really-transitioned entry's published revision back to
            // draft — the same set the outbox emits an event for.
            for (const id of publishedIds) {
                await this.writer.markRevisionUnpublished(
                    exec,
                    id,
                    workspaceId
                );
            }
            await this.outbox.append(
                publishedIds.flatMap((id) => {
                    const entry = Entry.rehydrate({
                        id,
                        contentType: type.name,
                        workspaceId,
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

import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@orthacms/database';
import { type EntryStatus } from '@orthacms/content-domain';
import type { AnyContentType } from '../../../types/content-type';
import { EntryValidationService } from '../../../validation/services/entry-validation.service';
import { EntryWriterService } from '../../infrastructure/persistence/entry-writer.service';
import { toRecord } from '../../infrastructure/persistence/entry-row';
import type { EntryRecord } from '../../types/entry-list-view';
import { Entry } from '../../domain/entry';
import { EntryPublishBlockedError } from '../../domain/entry-publish-blocked.error';

/**
 * Publish one entry. Runs inside a {@link UnitOfWork} so the status write and
 * the `entry.published` outbox event commit atomically. Re-validates the stored
 * row against the publish gate (values via the kernel + required link-managed
 * relations via persistence), lets the {@link Entry} domain model apply the
 * `draft → published` transition, then re-stamps `status`/`published_at`.
 *
 * HTTP behavior is preserved: 400 on a non-publishable type, 404 on a missing
 * live row, and `422 { message, issues }` when the gate fails — the value issues
 * take precedence (relations aren't even counted when the values are invalid),
 * exactly as the original service ordered its checks.
 */
@Injectable()
export class PublishEntryUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly writer: EntryWriterService,
        private readonly validation: EntryValidationService
    ) {}

    async execute(
        type: AnyContentType,
        id: string,
        workspaceId: string,
        /**
         * The acting user, merged onto the outbox events so the audit log can
         * name who did this. Without it every content row in the activity log
         * read "System".
         */
        actor?: { id: string; email: string | null },
        /**
         * The version to mark live, when publishing a **specific** earlier one
         * whose content the caller already re-applied to the live row. Omitted
         * (the entry-level publish), the latest version is promoted — it is the
         * row that was just published.
         */
        revisionNumber?: number
    ): Promise<EntryRecord> {
        if (!type.publishable) {
            throw new BadRequestException(
                `Content type "${type.name}" is not publishable.`
            );
        }
        return this.uow.run(async () => {
            const exec = this.uow.current();
            const current = await this.writer.findLive(
                type,
                id,
                workspaceId,
                exec
            );
            if (!current) throw this.notFound(type, id);

            const valueResult = this.validation.validate(
                type,
                toRecord(type, current).values
            );
            // Short-circuit exactly like the original: only count required links
            // when the values already pass, so the 422's issue set matches.
            const issues = valueResult.valid
                ? await this.writer.requiredRelationIssues(
                      exec,
                      type,
                      current,
                      workspaceId
                  )
                : valueResult.issues;

            const entry = Entry.rehydrate({
                id,
                contentType: type.name,
                workspaceId,
                status: current['status'] as EntryStatus
            });
            try {
                entry.publish({ valid: issues.length === 0, issues });
            } catch (error) {
                if (error instanceof EntryPublishBlockedError) {
                    throw new UnprocessableEntityException({
                        message: 'Entry validation failed',
                        issues: error.issues
                    });
                }
                throw error;
            }

            // Re-stamp unconditionally (an idempotent re-publish keeps the
            // original behavior); 404 if the row vanished under us.
            const updated = await this.writer.markPublished(
                exec,
                type,
                id,
                workspaceId
            );
            if (!updated) throw this.notFound(type, id);
            // Promote the published revision to the live version so the history
            // timeline reflects the publish (revisions are born drafts) — the
            // caller's chosen version, else the latest.
            await this.writer.markRevisionPublished(
                exec,
                id,
                workspaceId,
                revisionNumber
            );
            await this.outbox.append(
                actor
                    ? attachActor(entry.pullEvents(), actor)
                    : entry.pullEvents()
            );
            return toRecord(type, updated);
        });
    }

    private notFound(type: AnyContentType, id: string): NotFoundException {
        return new NotFoundException(
            `No entry "${id}" on content type "${type.name}".`
        );
    }
}

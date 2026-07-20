import { BadRequestException, Injectable } from '@nestjs/common';
import type { AnyContentType } from '../../../types/content-type';
import { EntryValidationService } from '../../../validation/services/entry-validation.service';
import type { BulkPublishPreview } from '../../types/bulk-publish';
import { EntryWriterService } from '../persistence/entry-writer.service';
import { computeBulkPublishVerdicts } from '../persistence/bulk-publish-verdicts';

/**
 * The bulk-publish **dry run** — a thin read query. Loads the workspace's live
 * rows for the requested ids and reports a per-entry verdict (will-publish /
 * already-published / blocked / not-found) in request order. Writes nothing;
 * the committed publish (a use-case) re-validates under a `FOR UPDATE` lock and
 * never trusts this advisory copy.
 */
@Injectable()
export class BulkPublishPreviewQuery {
    constructor(
        private readonly writer: EntryWriterService,
        private readonly validation: EntryValidationService
    ) {}

    /** Dry-run a publish over `ids`; 400 on a non-publishable type. */
    async preview(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<BulkPublishPreview> {
        if (!type.publishable) {
            throw new BadRequestException(
                `Content type "${type.name}" is not publishable.`
            );
        }
        const byId = await this.writer.loadLiveByIds(type, ids, workspaceId);
        return {
            items: computeBulkPublishVerdicts(type, ids, byId, (t, values) =>
                this.validation.validate(t, values)
            )
        };
    }
}

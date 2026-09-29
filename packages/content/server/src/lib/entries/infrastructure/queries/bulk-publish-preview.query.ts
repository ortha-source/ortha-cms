import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDatabase, type Database } from '@orthacms/database';
import type { AnyContentType } from '../../../types/content-type';
import { EntryValidationService } from '../../../validation/services/entry-validation.service';
import type { BulkPublishPreview } from '../../types/bulk-publish';
import { EntryWriterService } from '../persistence/entry-writer.service';
import {
    computeBulkPublishVerdicts,
    draftIds
} from '../persistence/bulk-publish-verdicts';

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
        @InjectDatabase() private readonly db: Database,
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
        // Same waiver as the committed publish, so the dry run cannot block
        // what the publish would let through (or list it as a check).
        const waived = await this.validation.waivedRequired(type, workspaceId);
        // And the same required-link count, so a row the publish would refuse
        // for an empty required relation is listed as blocked here too.
        const relationIssues = await this.writer.requiredRelationIssuesBulk(
            this.db,
            type,
            draftIds(byId),
            workspaceId,
            waived
        );
        return {
            items: computeBulkPublishVerdicts(
                type,
                ids,
                byId,
                (t, values) => this.validation.validate(t, values, waived),
                waived,
                relationIssues
            )
        };
    }
}

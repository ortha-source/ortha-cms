import { Injectable } from '@nestjs/common';
import type {
    ContentEntryWriteContext,
    ContentEntryWriteHook
} from '@orthacms/content-server';
import { AccessResolutionService } from '../../application/access-resolution.service';
import { ProjectionService } from '../../application/projection.service';
import { SegmentCatalogService } from '../../application/segment-catalog.service';

/**
 * Projects an entry's access **inside the write that changed it**.
 *
 * This is the hook the whole design leans on. The read predicate matches
 * against `entry_access`, so the window between "the entry is live" and "the
 * row that hides it exists" is a window in which restricted content is public.
 * Running post-commit — an outbox subscriber, a job — would leave that window
 * open by construction, however short. So the projection goes in the entry's own
 * transaction, and a failure here rolls the entry back with it.
 *
 * Two shortcuts keep it off the write path of installations that do not use it:
 *
 * - **No active segment type, no work.** The catalogue is already in memory, so
 *   this is a boolean check, and it is the state every installation that has not
 *   adopted segmentation stays in.
 * - **An unrestricted rule writes nothing.** `ProjectionService.project`
 *   deletes the entry's rows instead, so an open entry costs one DELETE that
 *   matches nothing rather than a row of empty arrays.
 */
@Injectable()
export class EntryProjectionHook implements ContentEntryWriteHook {
    constructor(
        private readonly catalog: SegmentCatalogService,
        private readonly resolution: AccessResolutionService,
        private readonly projection: ProjectionService
    ) {}

    /** Resolve this entry's rule and write its projection, in `context.tx`. */
    async afterWrite(context: ContentEntryWriteContext): Promise<void> {
        if (!this.catalog.hasActiveTypes()) {
            return;
        }
        const resolved = await this.resolution.resolveEntry({
            workspaceId: context.workspaceId,
            typeSlug: context.type.name,
            entryId: context.entryId
        });
        await this.projection.project(
            {
                workspaceId: context.workspaceId,
                typeSlug: context.type.name,
                entryId: context.entryId
            },
            resolved.rule,
            resolved.ruleId,
            // The write's own transaction — not the shared connection, which
            // would commit independently and defeat the point of the hook.
            context.tx as never
        );
    }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import type { AnyContentType } from '../../../types/content-type';
import { PublishEntryUseCase } from '../../../entries/application/use-cases/publish-entry.use-case';
import type { EntryRecord } from '../../../entries/types/entry-list-view';
import {
    InjectRevisionStore,
    type RevisionStore
} from '../ports/revision-store';
import { RestoreRevisionUseCase } from './restore-revision.use-case';

/**
 * **Publish a specific version** — make any version the entry's live one, so an
 * editor can switch back to an earlier version and publish it (not only the
 * newest draft).
 *
 * History stays **append-only**. Publishing the version that is already the
 * latest just publishes it in place (identical to the entry-level publish).
 * Publishing an **earlier** version first {@link RestoreRevisionUseCase restores}
 * it — re-applying its content onto the live row as a fresh revision — then
 * publishes that new latest. Either way the outcome is: the chosen version's
 * content becomes live, its revision is marked `published`, and the
 * previously-published one is `superseded` (via {@link PublishEntryUseCase}).
 *
 * Publishing re-validates through the publish gate, so an incomplete old version
 * surfaces the same `422 { issues }` a normal publish would (the restore has
 * already run in that case, leaving the content live as a draft — a deliberate,
 * recoverable state, not a rewrite of history).
 */
@Injectable()
export class PublishRevisionUseCase {
    constructor(
        private readonly restoreRevision: RestoreRevisionUseCase,
        private readonly publishEntry: PublishEntryUseCase,
        @InjectRevisionStore() private readonly store: RevisionStore
    ) {}

    async execute(
        type: AnyContentType,
        id: string,
        number: number,
        workspaceId: string,
        actorId: string | null
    ): Promise<EntryRecord> {
        const detail = await this.store.get(id, workspaceId, number);
        if (!detail) {
            throw new NotFoundException(
                `No revision #${number} for entry "${id}" on "${type.name}".`
            );
        }
        // Only re-apply an *earlier* version; the latest is already the live row.
        if (!detail.isLatest) {
            await this.restoreRevision.execute(
                type,
                id,
                number,
                workspaceId,
                actorId
            );
        }
        return this.publishEntry.execute(type, id, workspaceId);
    }
}

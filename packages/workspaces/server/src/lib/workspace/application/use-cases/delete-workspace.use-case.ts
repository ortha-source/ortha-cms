import { Inject, Injectable } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import type { PublicUser } from '@ortha-cms/identity-server';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { WorkspaceNotFoundError } from '../../domain/errors';
import {
    WORKSPACE_REPOSITORY,
    type WorkspaceRepository
} from '../../domain/workspace.repository';
import { ContentEntryCounterReader } from '../content/content-entry-counter.reader';

/**
 * Permanently deletes a workspace (its memberships and content grants cascade).
 * Refused with `WorkspaceNotEmptyError` (→ 409) while the workspace still holds
 * content **entries** (workspace-scoped by a plain uuid with no FK, so a cascade
 * can't reach them) — they must be deleted first, so a delete never orphans
 * records. Drains `workspace.deleted` (carrying the actor), where the activity
 * subscriber turns it into the audit row. 404s an unknown workspace.
 *
 * Loads the aggregate under the workspace's exclusive content lock
 * ({@link WorkspaceRepository.findByIdForContentMutation}), so a concurrent
 * entry create can't slip a row in between the count and the delete.
 */
@Injectable()
export class DeleteWorkspaceUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly counter: ContentEntryCounterReader,
        @Inject(WORKSPACE_REPOSITORY)
        private readonly workspaces: WorkspaceRepository
    ) {}

    /**
     * Runs the delete. Throws {@link WorkspaceNotFoundError} (→ 404) and
     * `WorkspaceNotEmptyError` (→ 409) when content entries remain.
     */
    async execute(actor: PublicUser, workspaceId: string): Promise<void> {
        const id = WorkspaceId.create(workspaceId);

        await this.uow.run(async () => {
            const workspace =
                await this.workspaces.findByIdForContentMutation(id);
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            const entryCount =
                await this.counter.countWorkspaceEntries(workspaceId);
            workspace.assertDeletable(entryCount);

            await this.workspaces.delete(workspace);
            await this.outbox.append(
                attachActor(workspace.pullEvents(), actor)
            );
        });
    }
}

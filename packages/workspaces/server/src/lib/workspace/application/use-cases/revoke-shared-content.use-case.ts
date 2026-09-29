import { Inject, Injectable } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@orthacms/database';
import type { PublicUser } from '@orthacms/identity-server';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { WorkspaceNotFoundError } from '../../domain/errors';
import {
    WORKSPACE_REPOSITORY,
    type WorkspaceRepository
} from '../../domain/workspace.repository';

/**
 * Revokes one **shared** content grant — "Tags · Travel Library" — leaving the
 * workspace's own grant and its other shared grants alone (ADR-0019,
 * "Explicit per-source grants").
 *
 * Unlike the own-grant revoke there is no entry count and no content lock: a
 * shared grant owns no records, so revoking it cannot orphan any. Links this
 * workspace's entries hold into the source stay in the database and simply
 * stop being visible, exactly as when the source is unshared. Revoking a grant
 * the workspace never held is a no-op. Drains `workspace.content_revoked`
 * (carrying the actor and the `sourceWorkspaceId`) on a real change. 404s an
 * unknown workspace.
 */
@Injectable()
export class RevokeSharedContentUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(WORKSPACE_REPOSITORY)
        private readonly workspaces: WorkspaceRepository
    ) {}

    /** Runs the revoke. Throws {@link WorkspaceNotFoundError} (→ 404). */
    async execute(
        actor: PublicUser,
        workspaceId: string,
        slug: string,
        sourceWorkspaceId: string
    ): Promise<void> {
        const id = WorkspaceId.create(workspaceId);

        await this.uow.run(async () => {
            const workspace = await this.workspaces.findById(id);
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            if (!workspace.revokeSharedContent(slug, sourceWorkspaceId)) {
                return;
            }
            await this.workspaces.save(workspace);
            await this.outbox.append(
                attachActor(workspace.pullEvents(), actor)
            );
        });
    }
}

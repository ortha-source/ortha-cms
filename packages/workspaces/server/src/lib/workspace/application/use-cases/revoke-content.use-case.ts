import { Inject, Injectable, Optional } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import {
    ACTIVITY_RECORDER,
    IDENTITY_ACTIVITY_KINDS,
    type ActivityRecorder,
    type PublicUser
} from '@ortha-cms/identity-server';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import { WorkspaceNotFoundError } from '../../domain/errors';
import {
    WORKSPACE_REPOSITORY,
    type WorkspaceRepository
} from '../../domain/workspace.repository';
import { ContentEntryCounterReader } from '../content/content-entry-counter.reader';

/**
 * Revokes a workspace's access to one content type — **only when the type holds
 * no entries in that workspace** (`ContentTypeNotEmptyError` → 409 otherwise),
 * so a revoke never orphans reachable records. Revoking a grant the workspace
 * never held is a no-op. Records `workspace.content_revoked` in-band and drains
 * the domain event on a real change. 404s an unknown workspace.
 *
 * Loads the aggregate under the workspace's exclusive content lock
 * ({@link WorkspaceRepository.findByIdForContentMutation}), so a concurrent
 * entry create can't slip a row in between the count and the grant removal.
 */
@Injectable()
export class RevokeContentUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly counter: ContentEntryCounterReader,
        @Inject(WORKSPACE_REPOSITORY)
        private readonly workspaces: WorkspaceRepository,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /**
     * Runs the revoke. Throws {@link WorkspaceNotFoundError} (→ 404) and
     * `ContentTypeNotEmptyError` (→ 409) when the type still holds entries.
     */
    async execute(
        actor: PublicUser,
        workspaceId: string,
        slug: string
    ): Promise<void> {
        const id = WorkspaceId.create(workspaceId);

        await this.uow.run(async () => {
            const workspace =
                await this.workspaces.findByIdForContentMutation(id);
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            const entryCount = await this.counter.countEntries(
                workspaceId,
                slug
            );
            if (!workspace.revokeContent(slug, entryCount)) {
                return;
            }
            await this.workspaces.save(workspace);
            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_CONTENT_REVOKED,
                    subjectType: 'workspace',
                    subjectId: workspaceId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { slug }
                },
                this.uow.current()
            );
            await this.outbox.append(workspace.pullEvents());
        });
    }
}

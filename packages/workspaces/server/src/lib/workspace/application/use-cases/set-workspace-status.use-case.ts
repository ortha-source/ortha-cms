import { Inject, Injectable, Optional } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import {
    ACTIVITY_RECORDER,
    IDENTITY_ACTIVITY_KINDS,
    type ActivityRecorder,
    type PublicUser
} from '@ortha-cms/identity-server';
import { WorkspaceId } from '../../domain/value-objects/workspace-id';
import {
    WorkspaceStatus,
    type WorkspaceStatusKey
} from '../../domain/value-objects/workspace-status';
import { WorkspaceNotFoundError } from '../../domain/errors';
import {
    WORKSPACE_REPOSITORY,
    type WorkspaceRepository
} from '../../domain/workspace.repository';

/**
 * Flips a workspace's lifecycle status (archive / unarchive). Idempotent —
 * setting the status it already has records nothing. Records
 * `workspace.archived` / `workspace.unarchived` in-band and drains the domain
 * event on a real change. 404s an unknown workspace.
 */
@Injectable()
export class SetWorkspaceStatusUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(WORKSPACE_REPOSITORY)
        private readonly workspaces: WorkspaceRepository,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /** Runs the status change. Throws {@link WorkspaceNotFoundError} (→ 404). */
    async execute(
        actor: PublicUser,
        workspaceId: string,
        status: WorkspaceStatusKey
    ): Promise<void> {
        const id = WorkspaceId.create(workspaceId);
        const target = WorkspaceStatus.create(status);

        await this.uow.run(async () => {
            const workspace = await this.workspaces.findById(id);
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            if (!workspace.setStatus(target)) {
                return;
            }
            await this.workspaces.save(workspace);
            await this.recorder?.record(
                {
                    kind: target.isArchived
                        ? IDENTITY_ACTIVITY_KINDS.WORKSPACE_ARCHIVED
                        : IDENTITY_ACTIVITY_KINDS.WORKSPACE_UNARCHIVED,
                    subjectType: 'workspace',
                    subjectId: workspaceId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: {}
                },
                this.uow.current()
            );
            await this.outbox.append(workspace.pullEvents());
        });
    }
}

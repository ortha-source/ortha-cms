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
    MemberNotFoundError,
    WorkspaceNotFoundError
} from '../../domain/errors';
import {
    WORKSPACE_REPOSITORY,
    type WorkspaceRepository
} from '../../domain/workspace.repository';
import { MemberLookupQuery } from '../../infrastructure/queries/member-lookup.query';

/**
 * Links an existing user to a workspace. Idempotent — re-adding a member is a
 * no-op that records nothing. Records `workspace.member_added` in-band against
 * **the added user** (so it surfaces in that member's activity log) and drains
 * the domain event on a real change. 404s an unknown workspace or user.
 */
@Injectable()
export class AddMemberUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly members: MemberLookupQuery,
        @Inject(WORKSPACE_REPOSITORY)
        private readonly workspaces: WorkspaceRepository,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /**
     * Runs the add. Throws {@link WorkspaceNotFoundError} or
     * {@link MemberNotFoundError} (both → 404).
     */
    async execute(
        actor: PublicUser,
        workspaceId: string,
        userId: string
    ): Promise<void> {
        const id = WorkspaceId.create(workspaceId);

        await this.uow.run(async () => {
            const workspace = await this.workspaces.findById(id);
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            const user = await this.members.findById(userId);
            if (!user) {
                throw new MemberNotFoundError(userId);
            }
            if (!workspace.addMember(userId)) {
                return;
            }
            await this.workspaces.save(workspace);
            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_ADDED,
                    subjectType: 'user',
                    subjectId: userId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { workspaceId, email: user.email }
                },
                this.uow.current()
            );
            await this.outbox.append(workspace.pullEvents());
        });
    }
}

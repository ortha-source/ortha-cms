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
    WORKSPACE_REPOSITORY,
    type WorkspaceRepository
} from '../../domain/workspace.repository';
import { MemberLookupQuery } from '../../infrastructure/queries/member-lookup.query';

/**
 * Removes a user's membership. Removing a non-member — or targeting a workspace
 * that doesn't exist — is a no-op that records nothing (the endpoint still
 * returns 204, matching the prior behavior). Records `workspace.member_removed`
 * in-band against **the removed user** and drains the domain event on a real
 * change.
 */
@Injectable()
export class RemoveMemberUseCase {
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

    /** Runs the removal. Never throws for a missing workspace/member (no-op). */
    async execute(
        actor: PublicUser,
        workspaceId: string,
        userId: string
    ): Promise<void> {
        const id = WorkspaceId.create(workspaceId);

        await this.uow.run(async () => {
            const workspace = await this.workspaces.findById(id);
            if (!workspace) {
                return; // no such workspace — nothing to remove, still 204
            }
            if (!workspace.removeMember(userId)) {
                return; // not a member — nothing changed, nothing recorded
            }
            await this.workspaces.save(workspace);
            const user = await this.members.findById(userId);
            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_REMOVED,
                    subjectType: 'user',
                    subjectId: userId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { workspaceId, email: user?.email ?? null }
                },
                this.uow.current()
            );
            await this.outbox.append(workspace.pullEvents());
        });
    }
}

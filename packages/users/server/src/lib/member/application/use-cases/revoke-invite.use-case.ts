import { Inject, Injectable, Optional } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import {
    ACTIVITY_RECORDER,
    type ActivityRecorder,
    type PublicUser
} from '@ortha-cms/identity-server';
import { MemberId } from '../../domain/value-objects/member-id';
import { MemberNotFoundError } from '../../domain/errors';
import {
    MEMBER_REPOSITORY,
    type MemberRepository
} from '../../domain/member.repository';
import { USER_ACTIVITY_KINDS } from '../member-activity';

/**
 * Revokes a `pending` invite by deleting the placeholder member row; the
 * cascades drop their invite token and any pre-assigned memberships. Only
 * `pending` rows qualify ({@link InvalidMemberStateError} otherwise) — real
 * accounts are disabled, not deleted. Records `user.invite_revoked` in-band
 * (before the delete, so the audit row stands on its own) and drains
 * `member.removed`. 404s an unknown member.
 */
@Injectable()
export class RevokeInviteUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(MEMBER_REPOSITORY)
        private readonly members: MemberRepository,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /** Runs the revoke. 404s an unknown member; 409s a non-pending one. */
    async execute(actor: PublicUser, id: string): Promise<void> {
        const memberId = MemberId.create(id);

        await this.uow.run(async () => {
            const member = await this.members.findById(memberId);
            if (!member) {
                throw new MemberNotFoundError(id);
            }
            member.revokeInvite();

            // Record before the delete; `subjectId` is text with no FK, so the
            // audit row stands on its own once the placeholder row is gone.
            await this.recorder?.record(
                {
                    kind: USER_ACTIVITY_KINDS.USER_INVITE_REVOKED,
                    subjectType: 'user',
                    subjectId: id,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { email: member.email }
                },
                this.uow.current()
            );

            await this.members.delete(member);
            await this.outbox.append(member.pullEvents());
        });
    }
}

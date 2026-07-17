import { Inject, Injectable, Optional } from '@nestjs/common';
import { UnitOfWork } from '@ortha-cms/database';
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
import { InviteTokenService } from '../../infrastructure/persistence/invite-token.service';
import { USER_ACTIVITY_KINDS } from '../member-activity';

/**
 * Rotates the invite token for a still-`pending` member, invalidating the
 * previously sent link ({@link InvalidMemberStateError} otherwise). Only
 * meaningful while the invite is unaccepted. Records `user.invite_resent`
 * in-band; the member's own state is unchanged (no domain event). 404s an
 * unknown member.
 */
@Injectable()
export class ResendInviteUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly inviteTokens: InviteTokenService,
        @Inject(MEMBER_REPOSITORY)
        private readonly members: MemberRepository,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /** Runs the resend. 404s an unknown member; 409s a non-pending one. */
    async execute(actor: PublicUser, id: string): Promise<void> {
        const memberId = MemberId.create(id);

        await this.uow.run(async () => {
            const member = await this.members.findById(memberId);
            if (!member) {
                throw new MemberNotFoundError(id);
            }
            member.ensureCanResendInvite();

            await this.inviteTokens.rotate(member.id.value, this.uow.current());
            // TODO(users-email): deliver the rotated invite link once a mailer
            // exists (identity epic #11).

            await this.recorder?.record(
                {
                    kind: USER_ACTIVITY_KINDS.USER_INVITE_RESENT,
                    subjectType: 'user',
                    subjectId: id,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { email: member.email }
                },
                this.uow.current()
            );
        });
    }
}

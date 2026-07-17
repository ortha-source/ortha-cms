import { Inject, Injectable, Optional } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import {
    ACTIVITY_RECORDER,
    type ActivityRecorder,
    type PublicUser
} from '@ortha-cms/identity-server';
import { MemberId } from '../../domain/value-objects/member-id';
import { MemberNotFoundError, SelfActionError } from '../../domain/errors';
import {
    MEMBER_REPOSITORY,
    type MemberRepository
} from '../../domain/member.repository';
import {
    SESSION_REVOKER,
    type SessionRevoker
} from '../ports/session-revoker.port';
import { USER_ACTIVITY_KINDS } from '../member-activity';

/**
 * Flips a member's account status. `disable` rejects self-disable
 * ({@link SelfActionError}) and disabling the last active admin
 * ({@link LastAdminProtectedError}), and revokes the member's live sessions in
 * the same transaction so the lockout is immediate. `enable` reactivates a
 * disabled member. Only the applicable lifecycle state is accepted
 * ({@link InvalidMemberStateError}).
 *
 * Disable loads the member under the active-admin lock
 * ({@link MemberRepository.findByIdForAdminGuard}) and checks the count read
 * under it, so concurrent disables cannot race the admin count below one.
 * Records `user.suspended` / `user.reactivated` in-band; drains `member.disabled`.
 */
@Injectable()
export class SetMemberStatusUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(MEMBER_REPOSITORY)
        private readonly members: MemberRepository,
        @Inject(SESSION_REVOKER)
        private readonly sessions: SessionRevoker,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /** Disables an active member. 404s an unknown member; throws the guards. */
    async disable(actor: PublicUser, id: string): Promise<void> {
        if (actor.id === id) {
            throw new SelfActionError(id);
        }
        const memberId = MemberId.create(id);

        await this.uow.run(async () => {
            const member = await this.members.findByIdForAdminGuard(memberId);
            if (!member) {
                throw new MemberNotFoundError(id);
            }
            const activeAdminCount = await this.members.countActiveAdmins();
            member.disable(activeAdminCount);

            await this.members.save(member);
            await this.sessions.revoke(id);

            await this.recorder?.record(
                {
                    kind: USER_ACTIVITY_KINDS.USER_SUSPENDED,
                    subjectType: 'user',
                    subjectId: id,
                    actorId: actor.id,
                    actorEmail: actor.email
                },
                this.uow.current()
            );
            await this.outbox.append(member.pullEvents());
        });
    }

    /** Re-enables a disabled member. 404s an unknown member. */
    async enable(actor: PublicUser, id: string): Promise<void> {
        const memberId = MemberId.create(id);

        await this.uow.run(async () => {
            const member = await this.members.findById(memberId);
            if (!member) {
                throw new MemberNotFoundError(id);
            }
            member.enable();
            await this.members.save(member);

            await this.recorder?.record(
                {
                    kind: USER_ACTIVITY_KINDS.USER_REACTIVATED,
                    subjectType: 'user',
                    subjectId: id,
                    actorId: actor.id,
                    actorEmail: actor.email
                },
                this.uow.current()
            );
            await this.outbox.append(member.pullEvents());
        });
    }
}

import { Inject, Injectable, Optional } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import {
    ACTIVITY_RECORDER,
    type ActivityRecorder,
    type PublicUser
} from '@ortha-cms/identity-server';
import { MemberId } from '../../domain/value-objects/member-id';
import { Role } from '../../domain/value-objects/role';
import { MemberNotFoundError, SelfActionError } from '../../domain/errors';
import {
    MEMBER_REPOSITORY,
    type MemberRepository
} from '../../domain/member.repository';
import { USER_ACTIVITY_KINDS } from '../member-activity';
import type { UpdateMemberDto } from '../dto/update-member.dto';

/**
 * Partial update of a member's display name and/or role. A member cannot change
 * their own role ({@link SelfActionError}, mirroring the self-disable guard).
 *
 * The member is loaded under the active-admin lock
 * ({@link MemberRepository.findByIdForAdminGuard}); demoting the last active
 * admin is rejected inside the aggregate against a count read under that lock,
 * so two simultaneous demotions cannot both pass. Records `user.role_changed`
 * and/or `user.profile_updated` in-band (distinct audit events) and drains
 * `member.role_changed` on a role change. 404s an unknown member.
 */
@Injectable()
export class UpdateMemberUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(MEMBER_REPOSITORY)
        private readonly members: MemberRepository,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /** Runs the update. 404s an unknown member; throws the guard errors. */
    async execute(
        actor: PublicUser,
        id: string,
        dto: UpdateMemberDto
    ): Promise<void> {
        const memberId = MemberId.create(id);

        await this.uow.run(async () => {
            const member = await this.members.findByIdForAdminGuard(memberId);
            if (!member) {
                throw new MemberNotFoundError(id);
            }

            const previousRole = member.role.value;
            const previousName = member.name;

            let roleChanged = false;
            if (dto.role !== undefined && dto.role !== previousRole) {
                // You cannot change your own role — the same self-protection
                // the disable path enforces, so an admin can't accidentally
                // strip their own access (or hand themselves a different role).
                if (actor.id === id) {
                    throw new SelfActionError(id);
                }
                const activeAdminCount = await this.members.countActiveAdmins();
                roleChanged = member.changeRole(
                    Role.create(dto.role),
                    activeAdminCount
                );
            }
            const nameChanged =
                dto.name !== undefined ? member.rename(dto.name) : false;

            if (!roleChanged && !nameChanged) {
                return;
            }
            await this.members.save(member);

            // Record each facet that actually changed, in-band with the write
            // (role and name are distinct audit events).
            if (roleChanged) {
                await this.recorder?.record(
                    {
                        kind: USER_ACTIVITY_KINDS.USER_ROLE_CHANGED,
                        subjectType: 'user',
                        subjectId: id,
                        actorId: actor.id,
                        actorEmail: actor.email,
                        meta: { from: previousRole, to: dto.role }
                    },
                    this.uow.current()
                );
            }
            if (nameChanged) {
                await this.recorder?.record(
                    {
                        kind: USER_ACTIVITY_KINDS.USER_PROFILE_UPDATED,
                        subjectType: 'user',
                        subjectId: id,
                        actorId: actor.id,
                        actorEmail: actor.email,
                        meta: { name: { from: previousName, to: dto.name } }
                    },
                    this.uow.current()
                );
            }
            await this.outbox.append(member.pullEvents());
        });
    }
}

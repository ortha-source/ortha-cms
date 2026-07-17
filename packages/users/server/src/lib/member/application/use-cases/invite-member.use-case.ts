import { Inject, Injectable, Optional } from '@nestjs/common';
import { OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import {
    ACTIVITY_RECORDER,
    type ActivityRecorder,
    type PublicUser
} from '@ortha-cms/identity-server';
import { Member } from '../../domain/member';
import { Role } from '../../domain/value-objects/role';
import { EmailTakenError } from '../../domain/errors';
import {
    MEMBER_REPOSITORY,
    type MemberRepository
} from '../../domain/member.repository';
import {
    WORKSPACE_LINKER,
    type WorkspaceLinker
} from '../ports/workspace-linker.port';
import { InviteTokenService } from '../../infrastructure/persistence/invite-token.service';
import { USER_ACTIVITY_KINDS } from '../member-activity';
import type { InviteMemberDto } from '../dto/invite-member.dto';

/**
 * Invites a person: creates a `pending` {@link Member} holding the given role,
 * issues their invite token, and optionally links them to workspaces — all in
 * one unit of work. The email must be free: checked up front for a friendly
 * {@link EmailTakenError}, with the DB's case-insensitive unique index as the
 * race-proof backstop (its violation, surfaced by the repository, maps to the
 * same error). Records `user.invited` in-band and drains `member.invited`.
 */
@Injectable()
export class InviteMemberUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        private readonly inviteTokens: InviteTokenService,
        @Inject(MEMBER_REPOSITORY)
        private readonly members: MemberRepository,
        @Inject(WORKSPACE_LINKER)
        private readonly workspaceLinker: WorkspaceLinker,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /** Runs the invite, returning the new member's id. */
    async execute(actor: PublicUser, dto: InviteMemberDto): Promise<string> {
        const email = dto.email.toLowerCase();
        if (await this.members.existsByEmail(email)) {
            throw new EmailTakenError(dto.email);
        }

        return this.uow.run(async () => {
            const member = Member.invite({
                email,
                name: dto.name ?? null,
                role: Role.create(dto.role)
            });
            await this.members.save(member);

            await this.inviteTokens.rotate(member.id.value, this.uow.current());
            // TODO(users-email): deliver the invite link. No mailer exists yet
            // (identity epic #11) — the raw token is intentionally dropped here,
            // and "Resend invite" rotates it once delivery lands.

            await this.workspaceLinker.link(
                member.id.value,
                dto.workspaceIds ?? []
            );

            // In-band audit (kept correct + gap-free during the transition;
            // Wave 3 moves this onto an outbox subscriber and drops this call).
            await this.recorder?.record(
                {
                    kind: USER_ACTIVITY_KINDS.USER_INVITED,
                    subjectType: 'user',
                    subjectId: member.id.value,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { email }
                },
                this.uow.current()
            );
            await this.outbox.append(member.pullEvents());

            return member.id.value;
        });
    }
}

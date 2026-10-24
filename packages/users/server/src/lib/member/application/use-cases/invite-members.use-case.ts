import { Inject, Injectable } from '@nestjs/common';
import { UnitOfWork } from '@orthacms/database';
import type { PublicUser } from '@orthacms/identity-server';
import { EmailsTakenError } from '../../domain/errors';
import {
    MEMBER_REPOSITORY,
    type MemberRepository
} from '../../domain/member.repository';
import type { InviteMembersDto } from '../dto/invite-members.dto';
import {
    InviteMemberUseCase,
    type InvitedMember
} from './invite-member.use-case';

/**
 * Invites several people in **one unit of work**: either every address gets a
 * `pending` account, a token, its workspaces and (with a mailer) a queued
 * message, or none does.
 *
 * All-or-nothing on purpose. The admin's sheet says "Send 3 invites"; a batch
 * that created two and refused the third would leave the admin to work out
 * which two exist, and a retry of the same list would then collide with its own
 * first half. So every address is checked up front — one query — and a single
 * collision refuses the whole batch with {@link EmailsTakenError} naming every
 * colliding address, before anything is written.
 *
 * Each address then goes through {@link InviteMemberUseCase} unchanged, whose
 * own `uow.run` **joins** this one: one aggregate, one token rotation, one
 * `member.invited` event per person (I-14), all committing together. The
 * database's unique index stays the race-proof backstop — an account created
 * between the check and the insert surfaces as `EmailTakenError` and rolls the
 * whole batch back.
 *
 * **No new enumeration signal.** Naming which addresses are taken tells the
 * caller who has an account, so the route requires `users:read` as well as
 * `users:create`: whoever can call it can already list every member's address
 * with `GET /api/users?search=`. The single-address route keeps its existing
 * `users:create`-only contract.
 */
@Injectable()
export class InviteMembersUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly inviteMember: InviteMemberUseCase,
        @Inject(MEMBER_REPOSITORY)
        private readonly members: MemberRepository
    ) {}

    /** Runs the batch, returning one result per address, in input order. */
    async execute(
        actor: PublicUser,
        dto: InviteMembersDto
    ): Promise<InvitedMember[]> {
        const emails = dto.emails.map((email) => email.trim().toLowerCase());

        const taken = await this.members.takenEmails(emails);
        if (taken.length > 0) {
            throw new EmailsTakenError(taken);
        }

        return this.uow.run(async () => {
            const invited: InvitedMember[] = [];
            // Sequential, not `Promise.all`: one transaction is one
            // connection, and the statements of a single pg client run one at
            // a time anyway — concurrency here would only interleave them.
            for (const email of emails) {
                invited.push(
                    await this.inviteMember.execute(actor, {
                        email,
                        role: dto.role,
                        workspaceIds: dto.workspaceIds
                    })
                );
            }
            return invited;
        });
    }
}

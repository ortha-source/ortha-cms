import { Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { UnitOfWork } from '@ortha-cms/database';
import { roles, users } from '@ortha-cms/identity-server';
import type {
    MemberInput,
    MemberProvisioner
} from '../../application/ports/member-provisioner.port';

/**
 * Drizzle-backed {@link MemberProvisioner} over identity's `users` table.
 * Resolves each member to a real user id — provisioning a `pending` account for
 * an invited email — and drops ids that don't resolve to a real user, so a stale
 * directory id can't abort the create on an FK violation. Runs through
 * {@link UnitOfWork.current}, so provisioned users commit with the workspace.
 */
@Injectable()
export class DrizzleMemberProvisioner implements MemberProvisioner {
    constructor(private readonly uow: UnitOfWork) {}

    /** {@inheritDoc MemberProvisioner.resolve} */
    async resolve(members: MemberInput[]): Promise<string[]> {
        const executor = this.uow.current();
        const memberIds: string[] = [];
        for (const member of members) {
            memberIds.push(
                member.invited
                    ? await this.findOrCreateInvited(member.email)
                    : member.id
            );
        }

        const unique = [...new Set(memberIds)];
        if (unique.length === 0) {
            return [];
        }
        const existing = await executor
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, unique));
        const valid = new Set(existing.map((row) => row.id));
        return unique.filter((id) => valid.has(id));
    }

    /** Finds a user by email (case-insensitive) or provisions a pending one. */
    private async findOrCreateInvited(email: string): Promise<string> {
        const executor = this.uow.current();
        const normalized = email.trim().toLowerCase();
        const [existing] = await executor
            .select({ id: users.id })
            .from(users)
            .where(sql`lower(${users.email}) = ${normalized}`)
            .limit(1);
        if (existing) return existing.id;

        // Invited users get the least-privileged global role until they accept.
        // TODO(invites): issue an invite token + email (tokens table) — for now
        // we only provision the account so it can be linked as a member.
        const [viewer] = await executor
            .select({ id: roles.id })
            .from(roles)
            .where(eq(roles.key, 'viewer'))
            .limit(1);
        const [createdUser] = await executor
            .insert(users)
            .values({
                email: normalized,
                status: 'pending',
                roleId: viewer.id
            })
            .returning({ id: users.id });
        return createdUser.id;
    }
}

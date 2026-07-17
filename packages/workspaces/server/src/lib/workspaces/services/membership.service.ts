import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { roles, users } from '@ortha-cms/identity-server';
import { memberships } from '../../schema';
import type { WorkspaceMemberView } from '../types/views';
import type { Tx } from './tx';

/** A member to add, as carried by the create request. */
export interface MemberInput {
    /** Directory user id, or the typed email for an invited member. */
    id: string;
    /** Contact email (the lookup key for invited members). */
    email: string;
    /** Whether this is an invite-by-email rather than an existing account. */
    invited: boolean;
}

/**
 * Workspace membership: linking users to a workspace and reading them back. A
 * membership is a pure link — it carries no role (a user's single global role is
 * unchanged). Invited members (no account yet) are provisioned as `pending`
 * users so they can be linked.
 */
@Injectable()
export class MembershipService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * Links the `creator` plus `members` to `workspaceId` within `tx`. Resolves
     * each member to a real user id (provisioning pending accounts for invites),
     * ignores duplicates, and silently drops ids that don't resolve to a real
     * user so a stale directory id can't abort the whole create on a FK
     * violation.
     */
    async link(
        tx: Tx,
        workspaceId: string,
        creatorUserId: string,
        members: MemberInput[]
    ): Promise<void> {
        const memberIds = [creatorUserId];
        for (const member of members) {
            memberIds.push(
                member.invited
                    ? await this.findOrCreateInvited(tx, member.email)
                    : member.id
            );
        }

        // The creator and members are just membership links with no special
        // role, so they're inserted together in one statement.
        const unique = [...new Set(memberIds)];
        const existing = await tx
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, unique));
        const valid = new Set(existing.map((row) => row.id));
        const values = unique
            .filter((id) => valid.has(id))
            .map((userId) => ({ workspaceId, userId }));
        if (values.length === 0) return;
        await tx.insert(memberships).values(values).onConflictDoNothing();
    }

    /**
     * Whether `userId` is a member of `workspaceId`. The membership link is the
     * authorization boundary for workspace-scoped resources (e.g. content
     * entries): a non-member must not read or write a workspace's data even with
     * a valid session. A single-row existence probe, indexed by the
     * `(workspace_id, user_id)` unique constraint.
     */
    async isMember(userId: string, workspaceId: string): Promise<boolean> {
        const [row] = await this.db
            .select({ userId: memberships.userId })
            .from(memberships)
            .where(
                and(
                    eq(memberships.userId, userId),
                    eq(memberships.workspaceId, workspaceId)
                )
            )
            .limit(1);
        return !!row;
    }

    /**
     * Groups members by workspace id in a deterministic order (earliest
     * membership first, `id` breaking `created_at` ties). Ordering is
     * presentation-only — a member carries no role.
     */
    async loadByWorkspace(
        workspaceIds: string[]
    ): Promise<Map<string, WorkspaceMemberView[]>> {
        const rows = await this.db
            .select({
                workspaceId: memberships.workspaceId,
                createdAt: memberships.createdAt,
                id: users.id,
                name: users.name,
                email: users.email
            })
            .from(memberships)
            .innerJoin(users, eq(users.id, memberships.userId))
            .where(inArray(memberships.workspaceId, workspaceIds))
            .orderBy(memberships.createdAt, memberships.id);

        const byWorkspace = new Map<string, WorkspaceMemberView[]>();
        for (const row of rows) {
            const list = byWorkspace.get(row.workspaceId) ?? [];
            list.push({ id: row.id, name: row.name, email: row.email });
            byWorkspace.set(row.workspaceId, list);
        }
        return byWorkspace;
    }

    /** Finds a user by email (case-insensitive) or provisions a pending one. */
    private async findOrCreateInvited(tx: Tx, email: string): Promise<string> {
        const normalized = email.trim().toLowerCase();
        const [existing] = await tx
            .select({ id: users.id })
            .from(users)
            .where(sql`lower(${users.email}) = ${normalized}`)
            .limit(1);
        if (existing) return existing.id;

        // Invited users get the least-privileged global role until they accept.
        // TODO(invites): issue an invite token + email (tokens table) — for now
        // we only provision the account so it can be linked as a member.
        const [viewer] = await tx
            .select({ id: roles.id })
            .from(roles)
            .where(eq(roles.key, 'viewer'))
            .limit(1);
        const [createdUser] = await tx
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

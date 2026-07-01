import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { memberships, roles, users } from '../../schema';
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
     * Links `owner` plus `members` to `workspaceId` within `tx`. Resolves each
     * member to a real user id (provisioning pending accounts for invites),
     * ignores duplicates, and silently drops ids that don't resolve to a real
     * user so a stale directory id can't abort the whole create on a FK
     * violation.
     */
    async link(
        tx: Tx,
        workspaceId: string,
        ownerUserId: string,
        members: MemberInput[]
    ): Promise<void> {
        const memberIds: string[] = [];
        for (const member of members) {
            memberIds.push(
                member.invited
                    ? await this.findOrCreateInvited(tx, member.email)
                    : member.id
            );
        }

        // The owner is inserted first with an explicitly earlier timestamp so it
        // always sorts ahead of the other initial members. `defaultNow()` is the
        // transaction clock, identical for every row of a single INSERT, so
        // without this the owner would tie with the members it's created
        // alongside and the roster's "earliest membership = owner" pin (index 0)
        // could land on the wrong person. `clock_timestamp()` advances between
        // the two statements, giving the owner a strictly smaller `created_at`.
        await tx
            .insert(memberships)
            .values({
                workspaceId,
                userId: ownerUserId,
                createdAt: sql`clock_timestamp()`
            })
            .onConflictDoNothing();

        const unique = [...new Set(memberIds)].filter(
            (id) => id !== ownerUserId
        );
        if (unique.length === 0) return;
        const existing = await tx
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, unique));
        const valid = new Set(existing.map((row) => row.id));
        const values = unique
            .filter((id) => valid.has(id))
            .map((userId) => ({
                workspaceId,
                userId,
                createdAt: sql`clock_timestamp()`
            }));
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

    /** Groups members by workspace id, owner (earliest membership) first. */
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
            // `created_at` puts the owner first (see `link`); the `id` tiebreaker
            // makes the order fully deterministic across requests for the
            // remaining members, who would otherwise sort arbitrarily on ties.
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

import { Injectable } from '@nestjs/common';
import { and, count, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import {
    memberships,
    roles,
    sessions,
    users,
    workspaces
} from '@ortha-cms/identity-server';
import type { ListUsersQueryDto } from '../dto/list-users-query.dto';
import type { InviteUserDto } from '../dto/invite-user.dto';
import type { UpdateUserDto } from '../dto/update-user.dto';
import {
    EmailTakenError,
    InvalidMemberStateError,
    LastAdminProtectedError,
    MemberNotFoundError,
    SelfActionError
} from '../errors';
import type {
    MemberListView,
    MemberView,
    MemberWorkspaceView
} from '../types/member-view';
import { DEFAULT_PAGE_SIZE, type AssignableRoleKey } from '../users.constants';
import { InviteTokenService } from './invite-token.service';

/** A member row as selected from `users ⋈ roles`, before view assembly. */
interface MemberRow {
    id: string;
    email: string;
    name: string | null;
    status: 'pending' | 'active' | 'disabled';
    createdAt: Date;
    roleId: string;
    roleKey: string;
    roleName: string;
}

/**
 * Member management for the users plugin. Reads and mutates the user/role/
 * membership/token tables owned by `@ortha-cms/identity-server` — this plugin
 * migrates nothing of its own. Uses the shared Drizzle client directly (no
 * repository wrapper, by repo convention).
 *
 * Owns the two business invariants the UI mirrors:
 * - the last remaining **active admin** can be neither demoted nor disabled;
 * - a member cannot disable their own account.
 * Both are enforced inside transactions so concurrent mutations cannot race
 * the admin count below one.
 */
@Injectable()
export class UsersService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly inviteTokens: InviteTokenService
    ) {}

    /**
     * One page of members matching the optional name/email search,
     * name-ordered with an `id` tiebreaker (stable across requests, nulls
     * included). Three queries — count, page rows, the page's workspaces —
     * rather than one wide join that would repeat user columns per workspace.
     */
    async list(query: ListUsersQueryDto): Promise<MemberListView> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const where = this.searchPredicate(query.search);

        const [{ total }] = await this.db
            .select({ total: count() })
            .from(users)
            .where(where);

        const rows: MemberRow[] = await this.db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                status: users.status,
                createdAt: users.createdAt,
                roleId: roles.id,
                roleKey: roles.key,
                roleName: roles.name
            })
            .from(users)
            .innerJoin(roles, eq(users.roleId, roles.id))
            .where(where)
            .orderBy(users.name, users.id)
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const [workspacesByUser, adminCount] = await Promise.all([
            this.workspacesByUser(rows.map((row) => row.id)),
            this.activeAdminCount(this.db)
        ]);

        return {
            items: rows.map((row) =>
                this.toView(row, workspacesByUser.get(row.id) ?? [], adminCount)
            ),
            total,
            page,
            pageSize
        };
    }

    /**
     * Invites a person: creates a `pending` user holding the given role and
     * issues their invite token. The email must be free — checked up front
     * for a friendly error, with the DB's case-insensitive unique index as
     * the race-proof backstop (its violation maps to the same error).
     */
    async invite(dto: InviteUserDto): Promise<MemberView> {
        const email = dto.email.toLowerCase();
        const roleId = await this.roleIdByKey(dto.role);

        const [existing] = await this.db
            .select({ id: users.id })
            .from(users)
            .where(eq(sql`lower(${users.email})`, email));
        if (existing) {
            throw new EmailTakenError(dto.email);
        }

        let created: { id: string };
        try {
            [created] = await this.db
                .insert(users)
                .values({
                    email,
                    name: dto.name ?? null,
                    roleId,
                    status: 'pending'
                })
                .returning({ id: users.id });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new EmailTakenError(dto.email);
            }
            throw error;
        }

        await this.inviteTokens.rotate(created.id);
        // TODO(users-email): deliver the invite link. No mailer exists yet
        // (identity epic #11) — the raw token is intentionally dropped here,
        // and "Resend invite" rotates it once delivery lands.

        await this.linkWorkspaces(created.id, dto.workspaceIds ?? []);

        return this.findById(created.id);
    }

    /**
     * Grants the new member access to the given workspaces (memberships).
     * Filters to ids that resolve to real workspaces so a stale id can't fail
     * the invite, and ignores duplicates.
     */
    private async linkWorkspaces(
        userId: string,
        workspaceIds: string[]
    ): Promise<void> {
        const unique = [...new Set(workspaceIds)];
        if (unique.length === 0) return;
        const existing = await this.db
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(inArray(workspaces.id, unique));
        if (existing.length === 0) return;
        await this.db
            .insert(memberships)
            .values(existing.map(({ id }) => ({ userId, workspaceId: id })))
            .onConflictDoNothing();
    }

    /**
     * Partial update of a member's display name and/or role. Demoting the
     * last active admin is rejected inside the transaction, so two
     * simultaneous demotions cannot both pass the count check.
     */
    async update(id: string, dto: UpdateUserDto): Promise<MemberView> {
        await this.db.transaction(async (tx) => {
            const target = await this.loadRow(tx, id);

            const demotesAdmin =
                dto.role !== undefined &&
                dto.role !== target.roleKey &&
                target.roleKey === 'admin';
            if (
                demotesAdmin &&
                target.status === 'active' &&
                (await this.activeAdminCount(tx)) <= 1
            ) {
                throw new LastAdminProtectedError(id);
            }

            const changes: Partial<typeof users.$inferInsert> = {};
            if (dto.name !== undefined) {
                changes.name = dto.name;
            }
            if (dto.role !== undefined && dto.role !== target.roleKey) {
                changes.roleId = await this.roleIdByKey(dto.role);
            }
            if (Object.keys(changes).length > 0) {
                await tx.update(users).set(changes).where(eq(users.id, id));
            }
        });

        return this.findById(id);
    }

    /**
     * Disables an active member. Rejects self-disable and disabling the last
     * active admin; revokes the member's live sessions in the same
     * transaction so the lockout is immediate, not at next session expiry.
     */
    async disable(actorId: string, id: string): Promise<MemberView> {
        if (actorId === id) {
            throw new SelfActionError(id);
        }

        await this.db.transaction(async (tx) => {
            const target = await this.loadRow(tx, id);
            if (target.status !== 'active') {
                throw new InvalidMemberStateError(id, target.status, 'disable');
            }
            if (
                target.roleKey === 'admin' &&
                (await this.activeAdminCount(tx)) <= 1
            ) {
                throw new LastAdminProtectedError(id);
            }

            await tx
                .update(users)
                .set({ status: 'disabled' })
                .where(eq(users.id, id));
            await tx
                .update(sessions)
                .set({ revokedAt: new Date() })
                .where(eq(sessions.userId, id));
        });

        return this.findById(id);
    }

    /** Re-enables a disabled member. */
    async enable(id: string): Promise<MemberView> {
        await this.db.transaction(async (tx) => {
            const target = await this.loadRow(tx, id);
            if (target.status !== 'disabled') {
                throw new InvalidMemberStateError(id, target.status, 'enable');
            }
            await tx
                .update(users)
                .set({ status: 'active' })
                .where(eq(users.id, id));
        });

        return this.findById(id);
    }

    /**
     * Rotates the invite token for a still-pending member, invalidating the
     * previously sent link. Only meaningful while the invite is unaccepted.
     */
    async resendInvite(id: string): Promise<MemberView> {
        const target = await this.loadRow(this.db, id);
        if (target.status !== 'pending') {
            throw new InvalidMemberStateError(
                id,
                target.status,
                'resend an invite to'
            );
        }

        await this.inviteTokens.rotate(id);
        // TODO(users-email): deliver the rotated invite link once a mailer
        // exists (identity epic #11).

        return this.findById(id);
    }

    /**
     * Revokes a pending invite by deleting the placeholder user row; the
     * cascades drop their invite tokens and any pre-assigned memberships.
     * Only `pending` rows qualify — real accounts are disabled, not deleted.
     */
    async revokeInvite(id: string): Promise<void> {
        await this.db.transaction(async (tx) => {
            const target = await this.loadRow(tx, id);
            if (target.status !== 'pending') {
                throw new InvalidMemberStateError(
                    id,
                    target.status,
                    'revoke an invite for'
                );
            }
            await tx.delete(users).where(eq(users.id, id));
        });
    }

    /** Loads one member's full view. */
    async findById(id: string): Promise<MemberView> {
        const row = await this.loadRow(this.db, id);
        const [workspacesByUser, adminCount] = await Promise.all([
            this.workspacesByUser([id]),
            this.activeAdminCount(this.db)
        ]);
        return this.toView(row, workspacesByUser.get(id) ?? [], adminCount);
    }

    /** Selects one `users ⋈ roles` row or throws {@link MemberNotFoundError}. */
    private async loadRow(db: Querier, id: string): Promise<MemberRow> {
        const [row] = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                status: users.status,
                createdAt: users.createdAt,
                roleId: roles.id,
                roleKey: roles.key,
                roleName: roles.name
            })
            .from(users)
            .innerJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, id));

        if (!row) {
            throw new MemberNotFoundError(id);
        }
        return row;
    }

    /** Resolves a seeded system-role key to its id. */
    private async roleIdByKey(key: AssignableRoleKey): Promise<string> {
        const [role] = await this.db
            .select({ id: roles.id })
            .from(roles)
            .where(eq(roles.key, key));
        if (!role) {
            // The system roles are seeded on boot, so this indicates a broken
            // deployment rather than bad input — let it surface as a 500.
            throw new Error(`System role not seeded: ${key}`);
        }
        return role.id;
    }

    /**
     * `ILIKE` predicate over name and email, or `undefined` for no filter.
     * The needle's LIKE metacharacters are escaped so a literal `%`/`_`
     * search behaves literally.
     */
    private searchPredicate(search: string | undefined) {
        const needle = search?.trim();
        if (!needle) {
            return undefined;
        }
        const escaped = needle.replace(/[\\%_]/g, '\\$&');
        const pattern = `%${escaped}%`;
        return or(ilike(users.name, pattern), ilike(users.email, pattern));
    }

    /**
     * Loads the given users' workspaces, grouped by user id. One `inArray`
     * query over `memberships → workspaces` (index-covered by the memberships
     * unique's leftmost prefix), name-ordered with an `id` tiebreaker so push
     * order keeps each group stable.
     */
    private async workspacesByUser(
        userIds: string[]
    ): Promise<Map<string, MemberWorkspaceView[]>> {
        if (userIds.length === 0) {
            return new Map();
        }

        const rows = await this.db
            .select({
                userId: memberships.userId,
                id: workspaces.id,
                name: workspaces.name,
                color: workspaces.color
            })
            .from(memberships)
            .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
            .where(inArray(memberships.userId, userIds))
            .orderBy(workspaces.name, workspaces.id);

        const grouped = new Map<string, MemberWorkspaceView[]>();
        for (const row of rows) {
            const view: MemberWorkspaceView = {
                id: row.id,
                name: row.name,
                color: row.color
            };
            const list = grouped.get(row.userId);
            if (list) {
                list.push(view);
            } else {
                grouped.set(row.userId, [view]);
            }
        }
        return grouped;
    }

    /** Counts members who currently hold admin powers (active + admin role). */
    private async activeAdminCount(db: Querier): Promise<number> {
        const [{ total }] = await db
            .select({ total: count() })
            .from(users)
            .innerJoin(roles, eq(users.roleId, roles.id))
            .where(and(eq(roles.key, 'admin'), eq(users.status, 'active')));
        return total;
    }

    private toView(
        row: MemberRow,
        workspaceList: MemberWorkspaceView[],
        activeAdminCount: number
    ): MemberView {
        return {
            id: row.id,
            email: row.email,
            name: row.name,
            role: { id: row.roleId, key: row.roleKey, name: row.roleName },
            status: row.status,
            createdAt: row.createdAt,
            isLastAdmin:
                row.roleKey === 'admin' &&
                row.status === 'active' &&
                activeAdminCount <= 1,
            workspaces: workspaceList
        };
    }
}

/**
 * The query surface shared by the root client and a transaction — what the
 * private helpers accept so guardrail checks can run inside `transaction()`.
 */
type Querier = Pick<Database, 'select'>;

/** Whether an error (or its cause) is a Postgres unique violation (23505). */
function isUniqueViolation(error: unknown): boolean {
    for (
        let current = error;
        current instanceof Error;
        current = current.cause
    ) {
        if ((current as { code?: string }).code === '23505') {
            return true;
        }
    }
    return false;
}

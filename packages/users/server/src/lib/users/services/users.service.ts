import { Injectable } from '@nestjs/common';
import { and, count, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { ActivityService } from '@ortha-cms/activity-server';
import {
    memberships,
    roles,
    sessions,
    users,
    workspaces,
    type PublicUser
} from '@ortha-cms/identity-server';
import { USER_ACTIVITY_KINDS } from '../users-activity';
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
 * Stable key for the transaction-scoped advisory lock that serializes the
 * "≥1 active admin" guard. `update()` (demotion) and `disable()` both
 * count-then-write the admin set; under the default READ COMMITTED isolation
 * two concurrent transactions can read the same count and both pass, dropping
 * it to zero. Taking this lock first makes those guard sections mutually
 * exclusive. Any stable bigint works as long as it is the same in both paths.
 */
const ACTIVE_ADMIN_LOCK = 0x55534552; // "USER"

/**
 * Member management for the users plugin. Reads and mutates the user/role/
 * membership/token tables owned by `@ortha-cms/identity-server` — this plugin
 * migrates nothing of its own. Uses the shared Drizzle client directly (no
 * repository wrapper, by repo convention).
 *
 * Owns the two business invariants the UI mirrors:
 * - the last remaining **active admin** can be neither demoted nor disabled;
 * - a member can neither disable nor re-role their own account.
 * The admin-count invariant is enforced under a transaction-scoped advisory
 * lock ({@link ACTIVE_ADMIN_LOCK}) so concurrent mutations cannot race the
 * count below one.
 */
@Injectable()
export class UsersService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly inviteTokens: InviteTokenService,
        private readonly activity: ActivityService
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
        const where = this.listPredicate(query);

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
    async invite(actor: PublicUser, dto: InviteUserDto): Promise<MemberView> {
        const email = dto.email.toLowerCase();
        const roleId = await this.roleIdByKey(dto.role);

        const [existing] = await this.db
            .select({ id: users.id })
            .from(users)
            .where(eq(sql`lower(${users.email})`, email));
        if (existing) {
            throw new EmailTakenError(dto.email);
        }

        let createdId: string;
        try {
            createdId = await this.db.transaction(async (tx) => {
                const [created] = await tx
                    .insert(users)
                    .values({
                        email,
                        name: dto.name ?? null,
                        roleId,
                        status: 'pending'
                    })
                    .returning({ id: users.id });

                await this.inviteTokens.rotate(created.id, tx);
                // TODO(users-email): deliver the invite link. No mailer exists
                // yet (identity epic #11) — the raw token is intentionally
                // dropped here, and "Resend invite" rotates it once delivery
                // lands.

                await this.linkWorkspaces(
                    created.id,
                    dto.workspaceIds ?? [],
                    tx
                );

                await this.activity.record(
                    {
                        kind: USER_ACTIVITY_KINDS.USER_INVITED,
                        subjectType: 'user',
                        subjectId: created.id,
                        actorId: actor.id,
                        actorEmail: actor.email,
                        meta: { email }
                    },
                    tx
                );

                return created.id;
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new EmailTakenError(dto.email);
            }
            throw error;
        }

        return this.findById(createdId);
    }

    /**
     * Grants the new member access to the given workspaces (memberships).
     * Filters to ids that resolve to real workspaces so a stale id can't fail
     * the invite, and ignores duplicates.
     */
    private async linkWorkspaces(
        userId: string,
        workspaceIds: string[],
        executor: SelectInsert = this.db
    ): Promise<void> {
        const unique = [...new Set(workspaceIds)];
        if (unique.length === 0) return;
        const existing = await executor
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(inArray(workspaces.id, unique));
        if (existing.length === 0) return;
        await executor
            .insert(memberships)
            .values(existing.map(({ id }) => ({ userId, workspaceId: id })))
            .onConflictDoNothing();
    }

    /**
     * Partial update of a member's display name and/or role. A member cannot
     * change their own role (mirrors the self-disable guard). Demoting the last
     * active admin is rejected under the shared advisory lock, so two
     * simultaneous demotions cannot both pass the count check.
     */
    async update(
        actor: PublicUser,
        id: string,
        dto: UpdateUserDto
    ): Promise<MemberView> {
        await this.db.transaction(async (tx) => {
            await tx.execute(
                sql`select pg_advisory_xact_lock(${ACTIVE_ADMIN_LOCK})`
            );
            const target = await this.loadRow(tx, id);

            const changesRole =
                dto.role !== undefined && dto.role !== target.roleKey;
            const changesName =
                dto.name !== undefined && dto.name !== target.name;

            // You cannot change your own role — the same self-protection the
            // disable path enforces, so an admin can't accidentally strip their
            // own access (or hand themselves a different role).
            if (changesRole && actor.id === id) {
                throw new SelfActionError(id);
            }

            const demotesAdmin = changesRole && target.roleKey === 'admin';
            if (
                demotesAdmin &&
                target.status === 'active' &&
                (await this.activeAdminCount(tx)) <= 1
            ) {
                throw new LastAdminProtectedError(id);
            }

            const changes: Partial<typeof users.$inferInsert> = {};
            if (changesName) {
                changes.name = dto.name;
            }
            if (changesRole) {
                changes.roleId = await this.roleIdByKey(dto.role!);
            }
            if (Object.keys(changes).length === 0) {
                return;
            }
            await tx.update(users).set(changes).where(eq(users.id, id));

            // Record each facet that actually changed, in-band with the write
            // (role and name are distinct audit events).
            if (changesRole) {
                await this.activity.record(
                    {
                        kind: USER_ACTIVITY_KINDS.USER_ROLE_CHANGED,
                        subjectType: 'user',
                        subjectId: id,
                        actorId: actor.id,
                        actorEmail: actor.email,
                        meta: { from: target.roleKey, to: dto.role! }
                    },
                    tx
                );
            }
            if (changesName) {
                await this.activity.record(
                    {
                        kind: USER_ACTIVITY_KINDS.USER_PROFILE_UPDATED,
                        subjectType: 'user',
                        subjectId: id,
                        actorId: actor.id,
                        actorEmail: actor.email,
                        meta: { name: { from: target.name, to: dto.name! } }
                    },
                    tx
                );
            }
        });

        return this.findById(id);
    }

    /**
     * Disables an active member. Rejects self-disable and disabling the last
     * active admin; revokes the member's live sessions in the same
     * transaction so the lockout is immediate, not at next session expiry.
     */
    async disable(actor: PublicUser, id: string): Promise<MemberView> {
        if (actor.id === id) {
            throw new SelfActionError(id);
        }

        await this.db.transaction(async (tx) => {
            await tx.execute(
                sql`select pg_advisory_xact_lock(${ACTIVE_ADMIN_LOCK})`
            );
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

            await this.activity.record(
                {
                    kind: USER_ACTIVITY_KINDS.USER_SUSPENDED,
                    subjectType: 'user',
                    subjectId: id,
                    actorId: actor.id,
                    actorEmail: actor.email
                },
                tx
            );
        });

        return this.findById(id);
    }

    /** Re-enables a disabled member. */
    async enable(actor: PublicUser, id: string): Promise<MemberView> {
        await this.db.transaction(async (tx) => {
            const target = await this.loadRow(tx, id);
            if (target.status !== 'disabled') {
                throw new InvalidMemberStateError(id, target.status, 'enable');
            }
            await tx
                .update(users)
                .set({ status: 'active' })
                .where(eq(users.id, id));

            await this.activity.record(
                {
                    kind: USER_ACTIVITY_KINDS.USER_REACTIVATED,
                    subjectType: 'user',
                    subjectId: id,
                    actorId: actor.id,
                    actorEmail: actor.email
                },
                tx
            );
        });

        return this.findById(id);
    }

    /**
     * Rotates the invite token for a still-pending member, invalidating the
     * previously sent link. Only meaningful while the invite is unaccepted.
     */
    async resendInvite(actor: PublicUser, id: string): Promise<MemberView> {
        await this.db.transaction(async (tx) => {
            const target = await this.loadRow(tx, id);
            if (target.status !== 'pending') {
                throw new InvalidMemberStateError(
                    id,
                    target.status,
                    'resend an invite to'
                );
            }

            await this.inviteTokens.rotate(id, tx);
            // TODO(users-email): deliver the rotated invite link once a mailer
            // exists (identity epic #11).

            await this.activity.record(
                {
                    kind: USER_ACTIVITY_KINDS.USER_INVITE_RESENT,
                    subjectType: 'user',
                    subjectId: id,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { email: target.email }
                },
                tx
            );
        });

        return this.findById(id);
    }

    /**
     * Revokes a pending invite by deleting the placeholder user row; the
     * cascades drop their invite tokens and any pre-assigned memberships.
     * Only `pending` rows qualify — real accounts are disabled, not deleted.
     */
    async revokeInvite(actor: PublicUser, id: string): Promise<void> {
        await this.db.transaction(async (tx) => {
            const target = await this.loadRow(tx, id);
            if (target.status !== 'pending') {
                throw new InvalidMemberStateError(
                    id,
                    target.status,
                    'revoke an invite for'
                );
            }

            // Record before the delete; `subjectId` is text with no FK, so the
            // audit row stands on its own once the placeholder row is gone.
            await this.activity.record(
                {
                    kind: USER_ACTIVITY_KINDS.USER_INVITE_REVOKED,
                    subjectType: 'user',
                    subjectId: id,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { email: target.email }
                },
                tx
            );

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
     * The combined `where` for the list: the optional name/email search,
     * intersected with the optional account-status filter. The grid passes no
     * status and sees every member; the workspace member typeahead passes
     * `status: 'active'` so disabled/pending accounts aren't offered as
     * assignable members (the filter the old `UserService.search` enforced).
     * `and(undefined, …)` collapses to no filter, so an unfiltered list still
     * scans everyone.
     */
    private listPredicate(query: ListUsersQueryDto) {
        return and(
            this.searchPredicate(query.search),
            query.status ? eq(users.status, query.status) : undefined
        );
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

/**
 * The executor `linkWorkspaces` accepts — `select` to resolve workspace ids and
 * `insert` to grant memberships — so it can run inside the invite transaction.
 */
type SelectInsert = Pick<Database, 'select' | 'insert'>;

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

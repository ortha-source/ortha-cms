import { Injectable } from '@nestjs/common';
import { and, count, eq, ilike, inArray, max, or, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { applyFilterTree, parseFilterTree } from '@orthacms/utils-server';
import { roles, sessions, users } from '@orthacms/identity-server';
import { memberships, workspaces } from '@orthacms/workspaces-server';
import { DEFAULT_PAGE_SIZE } from '../../member.constants';
import { MEMBER_FILTER_SCHEMA } from '../../application/member-filter';
import type { ListMembersQueryDto } from '../../application/dto/list-members-query.dto';
import type {
    MemberCountsView,
    MemberListView,
    MemberView,
    MemberWorkspaceView
} from '../../application/queries/member.view';

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
 * Read model that assembles {@link MemberView}s — the users endpoints' response
 * shape — from the `users`/`roles`/`memberships`/`workspaces` tables. A thin
 * CQRS query service: it bypasses the {@link Member} aggregate (reads enforce no
 * invariants) and reads the base connection, so it sees committed state after a
 * use case's unit of work closes.
 *
 * The `isLastAdmin` flag it computes is **advisory** — a UI hint so the admin
 * can disable guarded controls. The write-side invariant is enforced under an
 * advisory lock in the use cases; this count needs no lock.
 */
@Injectable()
export class MemberViewQuery {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * One page of members matching the optional name/email search,
     * name-ordered with an `id` tiebreaker (stable across requests, nulls
     * included). Three queries — count, page rows, the page's workspaces —
     * rather than one wide join that would repeat user columns per workspace.
     */
    async list(query: ListMembersQueryDto): Promise<MemberListView> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const where = await this.listWhere(query);

        // Count and page rows share the same WHERE but are otherwise
        // independent; run them concurrently so a list request pays the max
        // of the two query times, not their sum.
        const [[{ total }], rows] = await Promise.all([
            this.db.select({ total: count() }).from(users).where(where),
            this.db
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
                .offset((page - 1) * pageSize) as Promise<MemberRow[]>
        ]);

        const ids = rows.map((row) => row.id);
        const [workspacesByUser, lastActiveByUser, adminCount, counts] =
            await Promise.all([
                this.workspacesByUser(ids),
                this.lastActiveByUser(ids),
                this.activeAdminCount(),
                this.counts()
            ]);

        return {
            items: rows.map((row) =>
                this.toView(
                    row,
                    workspacesByUser.get(row.id) ?? [],
                    lastActiveByUser.get(row.id) ?? null,
                    adminCount
                )
            ),
            total,
            page,
            pageSize,
            counts
        };
    }

    /** One member's full view, or `null` when no such member exists. */
    async byId(id: string): Promise<MemberView | null> {
        const row = await this.loadRow(id);
        if (!row) {
            return null;
        }
        const [workspacesByUser, lastActiveByUser, adminCount] =
            await Promise.all([
                this.workspacesByUser([id]),
                this.lastActiveByUser([id]),
                this.activeAdminCount()
            ]);
        return this.toView(
            row,
            workspacesByUser.get(id) ?? [],
            lastActiveByUser.get(id) ?? null,
            adminCount
        );
    }

    /**
     * Several members' views, in the order `ids` names them — the batch
     * invite's response. Ids with no row are skipped. Four queries for the
     * whole set rather than four per member.
     */
    async byIds(ids: string[]): Promise<MemberView[]> {
        if (ids.length === 0) {
            return [];
        }
        const rows = (await this.db
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
            .where(inArray(users.id, ids))) as MemberRow[];
        const [workspacesByUser, lastActiveByUser, adminCount] =
            await Promise.all([
                this.workspacesByUser(ids),
                this.lastActiveByUser(ids),
                this.activeAdminCount()
            ]);
        const byId = new Map(rows.map((row) => [row.id, row]));
        return ids.flatMap((id) => {
            const row = byId.get(id);
            return row
                ? [
                      this.toView(
                          row,
                          workspacesByUser.get(id) ?? [],
                          lastActiveByUser.get(id) ?? null,
                          adminCount
                      )
                  ]
                : [];
        });
    }

    /** Selects one `users ⋈ roles` row, or `null` when it doesn't exist. */
    private async loadRow(id: string): Promise<MemberRow | null> {
        const [row] = await this.db
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
        return row ?? null;
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
     * assignable members. `and(undefined, …)` collapses to no filter, so an
     * unfiltered list still scans everyone.
     */
    private listPredicate(query: ListMembersQueryDto) {
        return and(
            this.searchPredicate(query.search),
            query.status ? eq(users.status, query.status) : undefined,
            // A subquery rather than a join, so it composes into the count
            // query (which joins nothing) exactly as it does into the page.
            query.role
                ? sql`${users.roleId} in (select ${roles.id} from ${roles} where ${roles.key} = ${query.role})`
                : undefined
        );
    }

    /**
     * The full `where` for the list: the structured `search` / `status` params
     * AND-ed with the optional query-builder `?filter=` tree. The filter is
     * parsed and translated against {@link MEMBER_FILTER_SCHEMA} (the `role`
     * relation resolves to an `EXISTS (… roles …)` subquery, so it composes into
     * both the count and page queries without a join); a malformed filter throws
     * a `FilterException` (HTTP 400).
     */
    private async listWhere(query: ListMembersQueryDto) {
        const tree = parseFilterTree(query.filter, MEMBER_FILTER_SCHEMA);
        const filterSql = await applyFilterTree(
            tree,
            MEMBER_FILTER_SCHEMA,
            users,
            this.db
        );
        return and(this.listPredicate(query), filterSql);
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
                description: workspaces.description,
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
                description: row.description,
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

    /**
     * The most recent `last_used_at` across each user's sessions, grouped by
     * user — the "Last active" column. Revoked and expired sessions count:
     * the question is when the person was last seen, not whether they are
     * signed in now. Covered by `sessions_user_id_idx`.
     */
    private async lastActiveByUser(
        userIds: string[]
    ): Promise<Map<string, Date>> {
        if (userIds.length === 0) {
            return new Map();
        }
        const rows = await this.db
            .select({
                userId: sessions.userId,
                lastActiveAt: max(sessions.lastUsedAt)
            })
            .from(sessions)
            .where(inArray(sessions.userId, userIds))
            .groupBy(sessions.userId);

        const result = new Map<string, Date>();
        for (const row of rows) {
            if (row.lastActiveAt) {
                result.set(row.userId, new Date(row.lastActiveAt));
            }
        }
        return result;
    }

    /**
     * Directory-wide head counts for the quick filters, in one pass over
     * `users ⋈ roles` with `count(*) filter (…)` per bucket.
     */
    private async counts(): Promise<MemberCountsView> {
        const [row] = await this.db
            .select({
                everyone: count(),
                active: sql<number>`count(*) filter (where ${users.status} = 'active')`.mapWith(
                    Number
                ),
                invited:
                    sql<number>`count(*) filter (where ${users.status} = 'pending')`.mapWith(
                        Number
                    ),
                disabled:
                    sql<number>`count(*) filter (where ${users.status} = 'disabled')`.mapWith(
                        Number
                    ),
                admins: sql<number>`count(*) filter (where ${roles.key} = 'admin')`.mapWith(
                    Number
                )
            })
            .from(users)
            .innerJoin(roles, eq(users.roleId, roles.id));
        return {
            everyone: Number(row?.everyone ?? 0),
            active: Number(row?.active ?? 0),
            admins: Number(row?.admins ?? 0),
            invited: Number(row?.invited ?? 0),
            disabled: Number(row?.disabled ?? 0)
        };
    }

    /** Counts members who currently hold admin powers (active + admin role). */
    private async activeAdminCount(): Promise<number> {
        const [{ total }] = await this.db
            .select({ total: count() })
            .from(users)
            .innerJoin(roles, eq(users.roleId, roles.id))
            .where(and(eq(roles.key, 'admin'), eq(users.status, 'active')));
        return total;
    }

    private toView(
        row: MemberRow,
        workspaceList: MemberWorkspaceView[],
        lastActiveAt: Date | null,
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
            workspaces: workspaceList,
            lastActiveAt
        };
    }
}

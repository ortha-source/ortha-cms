import { Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { memberships, users, workspaces } from '@ortha-cms/identity-server';
import type {
    WorkspaceMemberView,
    WorkspaceView
} from '../types/workspace-view';

/**
 * Read operations for workspaces. Reads the workspace/membership/user tables
 * owned by `@ortha-cms/identity-server` — this plugin never writes or migrates
 * them. Uses the shared Drizzle client directly (no repository wrapper, by
 * repo convention).
 */
@Injectable()
export class WorkspacesService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * Lists the workspaces the given user belongs to, each with its full member
     * roster. Two queries grouped in memory rather than one wide join: a 3-way
     * join would repeat every workspace column once per member, so we fetch the
     * user's workspaces, then their members, and stitch them together. Both
     * filters are index-covered (the memberships unique's leftmost prefix on
     * `userId`; `memberships_workspace_id_idx` for the `inArray`). Ordered by
     * name with an `id` tiebreaker, so rows with equal or null names stay
     * stable across requests.
     */
    async listForUser(userId: string): Promise<WorkspaceView[]> {
        const rows = await this.db
            .select({
                id: workspaces.id,
                name: workspaces.name,
                slug: workspaces.slug,
                description: workspaces.description,
                createdAt: workspaces.createdAt,
                updatedAt: workspaces.updatedAt
            })
            .from(memberships)
            .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
            .where(eq(memberships.userId, userId))
            .orderBy(workspaces.name, workspaces.id);

        if (rows.length === 0) {
            return [];
        }

        const memberRows = await this.db
            .select({
                workspaceId: memberships.workspaceId,
                id: users.id,
                name: users.name,
                email: users.email
            })
            .from(memberships)
            .innerJoin(users, eq(memberships.userId, users.id))
            .where(
                inArray(
                    memberships.workspaceId,
                    rows.map((row) => row.id)
                )
            )
            .orderBy(users.name, users.id);

        const membersByWorkspace = new Map<string, WorkspaceMemberView[]>();
        for (const member of memberRows) {
            const list = membersByWorkspace.get(member.workspaceId);
            const view: WorkspaceMemberView = {
                id: member.id,
                name: member.name,
                email: member.email
            };
            if (list) {
                list.push(view);
            } else {
                membersByWorkspace.set(member.workspaceId, [view]);
            }
        }

        return rows.map((row) => ({
            ...row,
            // The caller is always a member of every workspace returned here,
            // so the roster is never actually empty — `?? []` only satisfies
            // the type for the `.get()` miss.
            members: membersByWorkspace.get(row.id) ?? []
        }));
    }
}

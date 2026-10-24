import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import type { InviteWorkspaceDirectory } from '@orthacms/identity-server';
import { memberships } from '../schema/memberships';
import { workspaces } from '../schema/workspaces';

/**
 * Drizzle-backed {@link InviteWorkspaceDirectory} — the adapter this plugin
 * binds to identity's `INVITE_WORKSPACE_DIRECTORY` port, so the accept-invite
 * screen can say which workspaces the invitee is joining ("…in Marketing site
 * and Support hub") without identity depending on this package.
 *
 * Identity only asks about the account behind a live invite token it has just
 * resolved, so this never answers for an id a caller typed.
 *
 * **Active workspaces only.** An archived workspace is dormant: the invitee
 * will not see it in the switcher, so naming it on the way in would promise
 * something the app does not show them.
 */
@Injectable()
export class InviteWorkspacesQuery implements InviteWorkspaceDirectory {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** {@inheritDoc InviteWorkspaceDirectory.namesFor} */
    async namesFor(userId: string): Promise<string[]> {
        const rows = await this.db
            .select({ name: workspaces.name })
            .from(memberships)
            .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
            .where(
                and(
                    eq(memberships.userId, userId),
                    eq(workspaces.status, 'active')
                )
            )
            .orderBy(asc(workspaces.name));
        return rows.map((row) => row.name);
    }
}

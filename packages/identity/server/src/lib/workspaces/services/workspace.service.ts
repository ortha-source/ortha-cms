import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { memberships, users, workspaces } from '../../schema';
import {
    ACTIVITY_RECORDER,
    type ActivityRecorder
} from '../../activity/activity-recorder';
import { IDENTITY_ACTIVITY_KINDS } from '../../activity/activity-kinds';
import type { PublicUser } from '../../auth/services/auth.service';
import type { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import {
    MemberNotFoundError,
    SlugTakenError,
    WorkspaceNotFoundError
} from '../errors';
import type { WorkspaceView } from '../types/views';
import { SlugService } from './slug.service';
import { MembershipService } from './membership.service';
import { ContentGrantService } from './content-grant.service';

export type { WorkspaceView, WorkspaceMemberView } from '../types/views';

/**
 * Orchestrates workspace reads and creation, composing the granular
 * {@link SlugService}, {@link MembershipService}, and {@link ContentGrantService}.
 * Owns no transport concern — returns plain views and throws domain errors the
 * controllers map to HTTP.
 */
@Injectable()
export class WorkspaceService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly slugs: SlugService,
        private readonly members: MembershipService,
        private readonly content: ContentGrantService,
        @Optional()
        @Inject(ACTIVITY_RECORDER)
        private readonly recorder?: ActivityRecorder
    ) {}

    /** Every workspace, newest first, each with its members. */
    async listAll(): Promise<WorkspaceView[]> {
        const rows = await this.db
            .select()
            .from(workspaces)
            .orderBy(desc(workspaces.createdAt));
        if (rows.length === 0) return [];
        return this.toViews(rows);
    }

    /**
     * Creates a workspace owned by `ownerUserId`, links the given members, and
     * grants content access — each delegated to its own service inside one
     * transaction. The wizard's per-member role is ignored.
     *
     * @throws {SlugTakenError} when the slug is already in use.
     */
    async create(
        dto: CreateWorkspaceDto,
        actor: PublicUser
    ): Promise<WorkspaceView> {
        if (!(await this.slugs.available(dto.slug))) {
            throw new SlugTakenError(dto.slug);
        }

        const workspaceId = await this.db.transaction(async (tx) => {
            const [created] = await tx
                .insert(workspaces)
                .values({
                    name: dto.name,
                    slug: dto.slug,
                    description: dto.description,
                    color: dto.color
                })
                .returning({ id: workspaces.id });
            const id = created.id;

            await this.members.link(tx, id, actor.id, dto.members);
            await this.content.grant(tx, id, dto.content);

            // Record the creation in-band so the audit row commits with the
            // workspace (and rolls back if members/content fail).
            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_CREATED,
                    subjectType: 'workspace',
                    subjectId: id,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { name: dto.name, slug: dto.slug }
                },
                tx
            );
            return id;
        });

        const [view] = await this.listViews([workspaceId]);
        return view;
    }

    /**
     * Links an existing user to a workspace, recording `workspace.member_added`
     * in-band against **the added user** (`subjectType: 'user'`), so the event
     * surfaces in that member's personal activity log; the workspace is carried
     * in `meta.workspaceId`. Idempotent — re-adding an existing member is a
     * no-op that records nothing. 404s when the workspace or user doesn't exist.
     */
    async addMember(
        actor: PublicUser,
        workspaceId: string,
        userId: string
    ): Promise<WorkspaceView> {
        await this.db.transaction(async (tx) => {
            const [workspace] = await tx
                .select({ id: workspaces.id })
                .from(workspaces)
                .where(eq(workspaces.id, workspaceId));
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            const [user] = await tx
                .select({ id: users.id, email: users.email })
                .from(users)
                .where(eq(users.id, userId));
            if (!user) {
                throw new MemberNotFoundError(userId);
            }

            const added = await tx
                .insert(memberships)
                .values({ workspaceId, userId })
                .onConflictDoNothing()
                .returning({ userId: memberships.userId });
            if (added.length === 0) {
                return; // already a member — nothing changed, nothing recorded
            }

            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_ADDED,
                    subjectType: 'user',
                    subjectId: userId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { workspaceId, email: user.email }
                },
                tx
            );
        });

        const [view] = await this.listViews([workspaceId]);
        return view;
    }

    /**
     * Removes a user's membership, recording `workspace.member_removed` in-band
     * against **the removed user** (`subjectType: 'user'`), so the event shows
     * in that member's personal activity log; the workspace is carried in
     * `meta.workspaceId`. Removing a non-member is a no-op (records nothing);
     * the endpoint still returns 204.
     */
    async removeMember(
        actor: PublicUser,
        workspaceId: string,
        userId: string
    ): Promise<void> {
        await this.db.transaction(async (tx) => {
            const removed = await tx
                .delete(memberships)
                .where(
                    and(
                        eq(memberships.workspaceId, workspaceId),
                        eq(memberships.userId, userId)
                    )
                )
                .returning({ userId: memberships.userId });
            if (removed.length === 0) {
                return; // not a member — nothing changed, nothing recorded
            }

            const [user] = await tx
                .select({ email: users.email })
                .from(users)
                .where(eq(users.id, userId));

            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_REMOVED,
                    subjectType: 'user',
                    subjectId: userId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { workspaceId, email: user?.email ?? null }
                },
                tx
            );
        });
    }

    /** Loads full views for the given workspace ids, preserving newest-first. */
    private async listViews(ids: string[]): Promise<WorkspaceView[]> {
        const rows = await this.db
            .select()
            .from(workspaces)
            .where(inArray(workspaces.id, ids))
            .orderBy(desc(workspaces.createdAt));
        return this.toViews(rows);
    }

    /** Maps workspace rows to views, attaching each one's members. */
    private async toViews(
        rows: (typeof workspaces.$inferSelect)[]
    ): Promise<WorkspaceView[]> {
        const ids = rows.map((row) => row.id);
        const membersByWorkspace = await this.members.loadByWorkspace(ids);
        const contentByWorkspace = await this.content.loadByWorkspace(ids);
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description ?? '',
            color: row.color,
            status: row.status,
            members: membersByWorkspace.get(row.id) ?? [],
            content: contentByWorkspace.get(row.id) ?? []
        }));
    }
}

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
import type { UpdateWorkspaceDto } from '../dto/update-workspace.dto';
import {
    ContentTypeNotEmptyError,
    MemberNotFoundError,
    SlugTakenError,
    UnknownContentTypeError,
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

    /**
     * Applies a partial profile edit (name / description / color) to a
     * workspace, recording `workspace.updated` in-band. The slug and status are
     * immutable here (status changes go through {@link setStatus}). A patch with
     * no fields is a no-op that records nothing but still returns the current
     * view. 404s an unknown workspace.
     */
    async update(
        actor: PublicUser,
        workspaceId: string,
        dto: UpdateWorkspaceDto
    ): Promise<WorkspaceView> {
        const patch: Partial<typeof workspaces.$inferInsert> = {};
        if (dto.name !== undefined) patch.name = dto.name;
        if (dto.description !== undefined) patch.description = dto.description;
        if (dto.color !== undefined) patch.color = dto.color;

        await this.db.transaction(async (tx) => {
            const [workspace] = await tx
                .select({ id: workspaces.id })
                .from(workspaces)
                .where(eq(workspaces.id, workspaceId));
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            if (Object.keys(patch).length === 0) {
                return; // empty patch — nothing to change, nothing to record
            }

            await tx
                .update(workspaces)
                .set(patch)
                .where(eq(workspaces.id, workspaceId));

            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_UPDATED,
                    subjectType: 'workspace',
                    subjectId: workspaceId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { fields: Object.keys(patch) }
                },
                tx
            );
        });

        const [view] = await this.listViews([workspaceId]);
        return view;
    }

    /**
     * Sets a workspace's lifecycle status (archive / unarchive), recording
     * `workspace.archived` or `workspace.unarchived` in-band. A no-op when the
     * status already matches (records nothing). 404s an unknown workspace.
     */
    async setStatus(
        actor: PublicUser,
        workspaceId: string,
        status: 'active' | 'archived'
    ): Promise<WorkspaceView> {
        await this.db.transaction(async (tx) => {
            const [workspace] = await tx
                .select({ status: workspaces.status })
                .from(workspaces)
                .where(eq(workspaces.id, workspaceId));
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }
            if (workspace.status === status) {
                return; // already in the target state — nothing changed
            }

            await tx
                .update(workspaces)
                .set({ status })
                .where(eq(workspaces.id, workspaceId));

            await this.recorder?.record(
                {
                    kind:
                        status === 'archived'
                            ? IDENTITY_ACTIVITY_KINDS.WORKSPACE_ARCHIVED
                            : IDENTITY_ACTIVITY_KINDS.WORKSPACE_UNARCHIVED,
                    subjectType: 'workspace',
                    subjectId: workspaceId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: {}
                },
                tx
            );
        });

        const [view] = await this.listViews([workspaceId]);
        return view;
    }

    /**
     * Permanently deletes a workspace, recording `workspace.deleted` in-band.
     * Its memberships and content grants cascade via their FKs. Stored content
     * **entries** (`content_<name>` rows, workspace-scoped by a plain uuid with
     * no FK) are *not* cascaded — they're left orphaned by design; the admin
     * warns before deleting. 404s an unknown workspace.
     */
    async delete(actor: PublicUser, workspaceId: string): Promise<void> {
        await this.db.transaction(async (tx) => {
            const [workspace] = await tx
                .select({ name: workspaces.name, slug: workspaces.slug })
                .from(workspaces)
                .where(eq(workspaces.id, workspaceId));
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }

            await tx.delete(workspaces).where(eq(workspaces.id, workspaceId));

            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_DELETED,
                    subjectType: 'workspace',
                    subjectId: workspaceId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { name: workspace.name, slug: workspace.slug }
                },
                tx
            );
        });
    }

    /**
     * Grants the workspace access to one content type, recording
     * `workspace.content_granted` in-band. Idempotent (re-granting is a no-op
     * that records nothing). 404s an unknown workspace; a slug that names no
     * known content type throws {@link UnknownContentTypeError}.
     */
    async grantContent(
        actor: PublicUser,
        workspaceId: string,
        slug: string
    ): Promise<WorkspaceView> {
        const kind = this.content.resolveKind(slug);
        if (!kind) {
            throw new UnknownContentTypeError(slug);
        }

        await this.db.transaction(async (tx) => {
            const [workspace] = await tx
                .select({ id: workspaces.id })
                .from(workspaces)
                .where(eq(workspaces.id, workspaceId));
            if (!workspace) {
                throw new WorkspaceNotFoundError(workspaceId);
            }

            const added = await this.content.addGrant(
                tx,
                workspaceId,
                kind,
                slug
            );
            if (!added) {
                return; // already granted — nothing changed, nothing recorded
            }

            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_CONTENT_GRANTED,
                    subjectType: 'workspace',
                    subjectId: workspaceId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { slug, kind }
                },
                tx
            );
        });

        const [view] = await this.listViews([workspaceId]);
        return view;
    }

    /**
     * Revokes a workspace's access to one content type — **only when the type
     * holds no entries in that workspace** ({@link ContentTypeNotEmptyError}
     * otherwise), so a revoke never orphans reachable records. Records
     * `workspace.content_revoked` in-band. Revoking a grant the workspace never
     * held is a no-op. 404s an unknown workspace.
     *
     * The emptiness probe runs before the delete, so a highly concurrent create
     * could in theory slip an entry in between; grants gate admin visibility,
     * not writes, so this best-effort check is acceptable here.
     */
    async revokeContent(
        actor: PublicUser,
        workspaceId: string,
        slug: string
    ): Promise<WorkspaceView> {
        const [workspace] = await this.db
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(eq(workspaces.id, workspaceId));
        if (!workspace) {
            throw new WorkspaceNotFoundError(workspaceId);
        }

        const entryCount = await this.content.countEntries(workspaceId, slug);
        if (entryCount > 0) {
            throw new ContentTypeNotEmptyError(workspaceId, slug, entryCount);
        }

        await this.db.transaction(async (tx) => {
            const removed = await this.content.removeGrant(
                tx,
                workspaceId,
                slug
            );
            if (!removed) {
                return; // wasn't granted — nothing changed, nothing recorded
            }

            await this.recorder?.record(
                {
                    kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_CONTENT_REVOKED,
                    subjectType: 'workspace',
                    subjectId: workspaceId,
                    actorId: actor.id,
                    actorEmail: actor.email,
                    meta: { slug }
                },
                tx
            );
        });

        const [view] = await this.listViews([workspaceId]);
        return view;
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

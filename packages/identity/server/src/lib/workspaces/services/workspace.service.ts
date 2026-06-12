import { Injectable } from '@nestjs/common';
import { desc, inArray } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { workspaces } from '../../schema';
import type { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { SlugTakenError } from '../errors';
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
        private readonly content: ContentGrantService
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
        ownerUserId: string
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

            await this.members.link(tx, id, ownerUserId, dto.members);
            await this.content.grant(tx, id, dto.content);
            return id;
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
        const membersByWorkspace = await this.members.loadByWorkspace(
            rows.map((row) => row.id)
        );
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description ?? '',
            color: row.color,
            status: row.status,
            members: membersByWorkspace.get(row.id) ?? []
        }));
    }
}

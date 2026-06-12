import { Injectable } from '@nestjs/common';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import {
    memberships,
    roles,
    users,
    workspaceContent,
    workspaces
} from '../../schema';
import { CONTENT_TYPES } from '../../content/content.constants';
import type { CreateWorkspaceDto } from '../dto/create-workspace.dto';
import { SlugTakenError } from '../errors';

/** A workspace member as exposed by the workspace endpoints. */
export interface WorkspaceMemberView {
    /** Stable user id. */
    id: string;
    /** Display name; `null` until the user sets one. */
    name: string | null;
    /** Email address. */
    email: string;
}

/** A workspace as exposed by the workspace endpoints. */
export interface WorkspaceView {
    /** Stable workspace id. */
    id: string;
    /** Display name. */
    name: string;
    /** URL slug. */
    slug: string;
    /** Long description; empty string when unset. */
    description: string;
    /** Accent color key. */
    color: string;
    /** Lifecycle state. */
    status: 'active' | 'archived';
    /** Members, owner first (insertion order). */
    members: WorkspaceMemberView[];
}

/** A content grant flattened to an explicit (kind, slug) row. */
interface ContentGrant {
    kind: 'collection' | 'single';
    slug: string;
}

/** The transaction client Drizzle hands to a `db.transaction(...)` callback. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const COLLECTION_SLUGS = CONTENT_TYPES.filter(
    (ct) => ct.kind === 'collection'
).map((ct) => ct.name);
const PAGE_SLUGS = CONTENT_TYPES.filter((ct) => ct.kind === 'single').map(
    (ct) => ct.name
);

/**
 * Workspace reads and creation. Owns no transport concern — returns plain views
 * and throws domain errors the controllers map to HTTP. The DB client is
 * injected from `@ortha-cms/database`.
 */
@Injectable()
export class WorkspaceService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** Every workspace, newest first, each with its members. */
    async listAll(): Promise<WorkspaceView[]> {
        const rows = await this.db
            .select()
            .from(workspaces)
            .orderBy(desc(workspaces.createdAt));
        if (rows.length === 0) return [];

        const membersByWorkspace = await this.loadMembers(
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

    /** Whether `slug` is free (not yet used by any workspace). */
    async slugAvailable(slug: string): Promise<boolean> {
        const [existing] = await this.db
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(eq(workspaces.slug, slug))
            .limit(1);
        return !existing;
    }

    /**
     * Creates a workspace owned by `ownerUserId`, links the given members, and
     * grants content access. The wizard's per-member role is ignored — a
     * membership is a pure link; the user's single global role is unchanged.
     * Invited members (no account yet) are provisioned as `pending` users.
     *
     * @throws {SlugTakenError} when the slug is already in use.
     */
    async create(
        dto: CreateWorkspaceDto,
        ownerUserId: string
    ): Promise<WorkspaceView> {
        if (!(await this.slugAvailable(dto.slug))) {
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

            // Resolve every member to a real user id (creating pending accounts
            // for invites), then link. The owner is always first.
            const memberIds = [ownerUserId];
            for (const member of dto.members) {
                memberIds.push(
                    member.invited
                        ? await this.findOrCreateInvited(tx, member.email)
                        : member.id
                );
            }
            await this.linkMembers(tx, id, memberIds);

            const grants = this.resolveGrants(dto);
            if (grants.length > 0) {
                await tx
                    .insert(workspaceContent)
                    .values(
                        grants.map((grant) => ({
                            workspaceId: id,
                            kind: grant.kind,
                            slug: grant.slug
                        }))
                    )
                    .onConflictDoNothing();
            }

            return id;
        });

        const [view] = await this.listViews([workspaceId]);
        return view;
    }

    /** Finds a user by email (case-insensitive) or provisions a pending one. */
    private async findOrCreateInvited(
        tx: Tx,
        email: string
    ): Promise<string> {
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

    /** Inserts memberships for `userIds`, ignoring duplicates and unknown ids. */
    private async linkMembers(
        tx: Tx,
        workspaceId: string,
        userIds: string[]
    ): Promise<void> {
        const unique = [...new Set(userIds)];
        // Only link ids that resolve to real users, so a stale directory id
        // can't abort the whole create on a FK violation.
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

    /** Flattens the wizard's content decision into explicit (kind, slug) rows. */
    private resolveGrants(dto: CreateWorkspaceDto): ContentGrant[] {
        if (dto.content.mode === 'all') {
            return [
                ...COLLECTION_SLUGS.map((slug) => ({
                    kind: 'collection' as const,
                    slug
                })),
                ...PAGE_SLUGS.map((slug) => ({ kind: 'single' as const, slug }))
            ];
        }
        return [
            ...this.selectionToSlugs(
                dto.content.collections,
                COLLECTION_SLUGS
            ).map((slug) => ({ kind: 'collection' as const, slug })),
            ...this.selectionToSlugs(dto.content.pages, PAGE_SLUGS).map(
                (slug) => ({ kind: 'single' as const, slug })
            )
        ];
    }

    /** Resolves a resource selection against the known slugs of that kind. */
    private selectionToSlugs(
        selection: { mode: 'specific' | 'all'; ids?: string[]; excludedIds?: string[] } | undefined,
        known: string[]
    ): string[] {
        if (!selection) return [];
        if (selection.mode === 'all') {
            const excluded = new Set(selection.excludedIds ?? []);
            return known.filter((slug) => !excluded.has(slug));
        }
        const requested = new Set(selection.ids ?? []);
        return known.filter((slug) => requested.has(slug));
    }

    /** Loads full views for the given workspace ids, preserving newest-first. */
    private async listViews(ids: string[]): Promise<WorkspaceView[]> {
        const rows = await this.db
            .select()
            .from(workspaces)
            .where(inArray(workspaces.id, ids))
            .orderBy(desc(workspaces.createdAt));
        const membersByWorkspace = await this.loadMembers(ids);
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

    /** Groups members by workspace id, owner (earliest membership) first. */
    private async loadMembers(
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
            .orderBy(memberships.createdAt);

        const byWorkspace = new Map<string, WorkspaceMemberView[]>();
        for (const row of rows) {
            const list = byWorkspace.get(row.workspaceId) ?? [];
            list.push({ id: row.id, name: row.name, email: row.email });
            byWorkspace.set(row.workspaceId, list);
        }
        return byWorkspace;
    }
}

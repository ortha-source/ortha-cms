import { initialsOf } from '@orthacms/utils-admin';
import { AVATAR_COLORS, type AvatarColor } from '@orthacms/design-system';
import type {
    ArchiveImpact,
    SharedContentGrant,
    SharedSource,
    Workspace,
    WorkspaceMember,
    WorkspaceStatus
} from '../../domain/types/workspace';

/** A member as `GET /api/workspaces` returns it (presentation fields derived). */
export interface WorkspaceMemberView {
    id: string;
    name: string | null;
    email: string;
    /** Directory status; absent on older responses. */
    status?: 'pending' | 'active' | 'disabled';
}

/** A workspace as `GET /api/workspaces` returns it. */
export interface WorkspaceView {
    id: string;
    name: string;
    slug: string;
    description: string;
    color: string;
    status: 'active' | 'archived';
    members: WorkspaceMemberView[];
    /** Granted content-type slugs; absent on older responses. */
    content?: string[];
    /** Whether the workspace is shared; absent on older responses. */
    isShared?: boolean;
    /** Grants from shared workspaces; absent on older responses. */
    sharedContent?: SharedContentGrantView[];
    /** Entries across every type; absent on older responses. */
    recordCount?: number;
    /** Entries per type slug; absent on older responses. */
    recordCountByType?: Record<string, number>;
    /** ISO timestamps; absent on older responses. */
    createdAt?: string;
    lastEditedAt?: string;
    archivedAt?: string | null;
}

/** Response of `GET /api/workspaces/:id/archive-impact`. */
export interface ArchiveImpactView {
    records: number;
    members: number;
    linkedWorkspaces: number;
}

/** One grant from a shared workspace, as `WorkspaceView.sharedContent` sends it. */
export interface SharedContentGrantView {
    slug: string;
    kind: 'collection' | 'single';
    sourceWorkspaceId: string;
    sourceWorkspaceName: string;
    /** `false` when the source no longer shares; absent is read as available. */
    available?: boolean;
}

/** Response of `GET /api/workspaces/:id/shared-sources`. */
export interface SharedSourcesView {
    items: {
        workspaceId: string;
        workspaceName: string;
        content?: { slug: string; kind: 'collection' | 'single' }[];
    }[];
}

const STATUS: Record<WorkspaceView['status'], WorkspaceStatus> = {
    active: 'Active',
    archived: 'Archived'
};

/**
 * Maps one shared grant. `available` defaults to `true` when absent — it is a
 * display flag only (the badge), never part of a write: adding and removing a
 * grant send the slug and source id alone, so the fallback cannot be written
 * back over a real value.
 */
function toSharedGrant(view: SharedContentGrantView): SharedContentGrant {
    return {
        slug: view.slug,
        kind: view.kind === 'single' ? 'single' : 'collection',
        sourceWorkspaceId: view.sourceWorkspaceId,
        sourceWorkspaceName: view.sourceWorkspaceName,
        available: view.available !== false
    };
}

/** Maps the `shared-sources` envelope to the admin's {@link SharedSource}s. */
export function toSharedSources(view: SharedSourcesView): SharedSource[] {
    return (view.items ?? []).map((item) => ({
        workspaceId: item.workspaceId,
        workspaceName: item.workspaceName,
        content: (item.content ?? []).map((type) => ({
            slug: type.slug,
            kind: type.kind === 'single' ? 'single' : 'collection'
        }))
    }));
}

/** Derives an admin member (initials + a stable avatar color) from a server row. */
function toMember(view: WorkspaceMemberView, index: number): WorkspaceMember {
    const name = view.name ?? view.email;
    return {
        id: view.id,
        name,
        email: view.email,
        initials: initialsOf(name),
        color: AVATAR_COLORS[index % AVATAR_COLORS.length],
        // Absent on an older server, which had no invites to tell apart.
        pending: view.status === 'pending'
    };
}

/**
 * Anti-corruption layer for the workspaces API: maps a server workspace view to
 * the admin's `Workspace`, deriving the presentation-only member initials/colors
 * the server doesn't store. The single wire→model translation the gateway routes
 * every workspace response through, so no hook or component ever touches the wire
 * shape.
 */
export function toWorkspace(view: WorkspaceView): Workspace {
    return {
        id: view.id,
        slug: view.slug,
        name: view.name,
        description: view.description,
        color: view.color as AvatarColor,
        status: STATUS[view.status],
        members: view.members.map(toMember),
        content: view.content ?? [],
        // An older server has no sharing, so "absent" can only mean "not
        // shared". The settings switch writes this flag on its own PATCH, never
        // alongside the profile form, so the fallback can't be written back
        // over a real value.
        isShared: view.isShared ?? false,
        // An older server has no per-source grants: none were made.
        sharedContent: (view.sharedContent ?? []).map(toSharedGrant),
        // Display-only figures, never written back: an older server simply
        // reports none of them.
        recordCount: view.recordCount ?? 0,
        recordCountByType: view.recordCountByType ?? {},
        createdAt: view.createdAt ?? null,
        lastEditedAt: view.lastEditedAt ?? null,
        archivedAt: view.archivedAt ?? null
    };
}

/** Maps the archive-impact counts, clamping anything malformed to zero. */
export function toArchiveImpact(view: ArchiveImpactView): ArchiveImpact {
    const count = (value: unknown) =>
        typeof value === 'number' && value > 0 ? value : 0;
    return {
        records: count(view.records),
        members: count(view.members),
        linkedWorkspaces: count(view.linkedWorkspaces)
    };
}

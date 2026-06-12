import type { AvatarColor } from '@ortha-cms/design-system';
import { apiClient } from '@ortha-cms/utils-admin';
import type { Workspace, WorkspaceMember } from '../../types/workspace';
import { initialsOf } from '../../utils/initialsOf';
import { asAvatarColor, avatarColorForId } from '../../utils/avatarColor';

// The admin can't import the server package (separate apps / module
// boundaries), so these wire types mirror the server's `WorkspaceView` /
// `WorkspaceMemberView` response shape — the same pattern identity-admin uses
// for its local `CurrentUser` type.

/**
 * A member as returned by `GET /api/workspaces`. `name` is `null` until the
 * user sets one; the presentational `initials`/`color` the grid needs aren't
 * persisted and are derived client-side.
 */
type WorkspaceMemberResponse = {
    id: string;
    name: string | null;
    email: string;
};

/**
 * A workspace as returned by `GET /api/workspaces`. `slug`/`createdAt`/
 * `updatedAt` are returned by the API but unused by the grid; there is no
 * `status` — it is admin-only presentation, not a persisted column.
 */
type WorkspaceResponse = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    color: string;
    members: WorkspaceMemberResponse[];
};

/** Maps a member from the read API to the admin's presentational shape. */
function toMember(dto: WorkspaceMemberResponse): WorkspaceMember {
    const name = dto.name ?? dto.email;
    return {
        id: dto.id,
        name,
        email: dto.email,
        initials: initialsOf(name),
        color: avatarColorForId(dto.id)
    };
}

/** Maps a workspace from the read API to the admin's `Workspace` model. */
function toWorkspace(dto: WorkspaceResponse): Workspace {
    return {
        id: dto.id,
        name: dto.name,
        description: dto.description ?? '',
        color: asAvatarColor(dto.color),
        // The server persists no status, so every workspace reads as Active
        // until a status source exists. The Active/Archived filter still works.
        status: 'Active',
        members: dto.members.map(toMember)
    };
}

/** The shape the create form submits. The creator becomes the sole member. */
export type CreateWorkspaceInput = {
    name: string;
    description: string;
    color: AvatarColor;
    creator: WorkspaceMember;
};

/** Lists the workspaces the signed-in user belongs to. */
export async function listWorkspaces(): Promise<Workspace[]> {
    const { data } = await apiClient.get<WorkspaceResponse[]>('/workspaces');
    return data.map(toWorkspace);
}

// TODO(workspaces-create): the server is read-only today (no POST /workspaces),
// so the create entry point is hidden in the UI (see WorkspacesPage). When the
// create endpoint ships, this POST is the seam — the server derives the owner
// from the session, so `input.creator` is used only for the optimistic insert.
/** Creates a workspace. Dormant until the server's create endpoint ships. */
export async function createWorkspace(
    input: CreateWorkspaceInput
): Promise<Workspace> {
    const { data } = await apiClient.post<WorkspaceResponse>('/workspaces', {
        name: input.name,
        description: input.description,
        color: input.color
    });
    return toWorkspace(data);
}

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@ortha-cms/utils-admin';
import type { Workspace, WorkspaceMember } from '../../types/workspace';
import { initialsOf } from '../../utils/initialsOf';
import { asAvatarColor, avatarColorForId } from '../../utils/avatarColor';

/** Query key for the workspaces list. */
export const workspacesKey = ['workspaces'] as const;

// The admin can't import the server package (separate apps / module
// boundaries), so these wire types mirror the server's `WorkspaceView` /
// `WorkspaceMemberView` response shape — the same way identity-admin keeps a
// local `CurrentUser` type next to its `useCurrentUser` hook.

/**
 * A member as returned by `GET /api/workspaces`. `name` is `null` until the
 * user sets one; the presentational `initials`/`color` the grid needs aren't
 * persisted and are derived client-side.
 */
export type WorkspaceMemberResponse = {
    id: string;
    name: string | null;
    email: string;
};

/**
 * A workspace as returned by `GET /api/workspaces`. `slug`/`createdAt`/
 * `updatedAt` are returned by the API but unused by the grid; there is no
 * `status` — it is admin-only presentation, not a persisted column.
 */
export type WorkspaceResponse = {
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
export function toWorkspace(dto: WorkspaceResponse): Workspace {
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

/** Fetches the signed-in user's workspaces from `GET /api/workspaces`. */
async function fetchWorkspaces(): Promise<Workspace[]> {
    const { data } = await apiClient.get<WorkspaceResponse[]>('/workspaces');
    return data.map(toWorkspace);
}

/** Fetches the list of workspaces the signed-in user belongs to. */
export function useWorkspaces() {
    return useQuery({
        queryKey: workspacesKey,
        queryFn: fetchWorkspaces
    });
}

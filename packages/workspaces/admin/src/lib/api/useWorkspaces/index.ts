import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import { AVATAR_COLORS, type AvatarColor } from '@ortha-cms/design-system';
import type {
    Workspace,
    WorkspaceMember,
    WorkspaceStatus
} from '../../types/workspace';
import { initialsOf } from '../../utils/initialsOf';

/** A member as `GET /api/workspaces` returns it (presentation fields derived). */
export interface WorkspaceMemberView {
    id: string;
    name: string | null;
    email: string;
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
}

const STATUS: Record<WorkspaceView['status'], WorkspaceStatus> = {
    active: 'Active',
    archived: 'Archived'
};

/** Derives an admin member (initials + a stable avatar color) from a server row. */
function toMember(view: WorkspaceMemberView, index: number): WorkspaceMember {
    const name = view.name ?? view.email;
    return {
        id: view.id,
        name,
        email: view.email,
        initials: initialsOf(name),
        color: AVATAR_COLORS[index % AVATAR_COLORS.length]
    };
}

/**
 * Maps a server workspace view to the admin's `Workspace`, deriving the
 * presentation-only member initials/colors the server doesn't store. Exported
 * so the create mutation maps its response through the same shape.
 */
export function toWorkspace(view: WorkspaceView): Workspace {
    return {
        id: view.id,
        name: view.name,
        description: view.description,
        color: view.color as AvatarColor,
        status: STATUS[view.status],
        members: view.members.map(toMember)
    };
}

/** Query key for the workspaces list. */
export const workspacesKey = ['workspaces'] as const;

/** Fetches every workspace from `GET /api/workspaces`, mapped to `Workspace`. */
async function fetchWorkspaces(): Promise<Workspace[]> {
    try {
        const { data } = await apiClient.get<WorkspaceView[]>('/workspaces');
        return data.map(toWorkspace);
    } catch (error) {
        throw toApiError(error);
    }
}

/** Lists the workspaces the signed-in user can see. */
export function useWorkspaces() {
    return useQuery({
        queryKey: workspacesKey,
        queryFn: fetchWorkspaces
    });
}

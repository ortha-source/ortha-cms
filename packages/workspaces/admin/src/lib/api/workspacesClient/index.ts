import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import {
    AVATAR_COLORS,
    type AvatarColor
} from '@ortha-cms/design-system';
import type {
    Workspace,
    WorkspaceMember,
    WorkspaceStatus
} from '../../types/workspace';
import type { CreateWorkspaceBody } from '../../types/wizard';
import { initialsOf } from '../../utils/initialsOf';

/**
 * The admin client for the workspaces API (`/api/workspaces`, served by the
 * identity plugin). It calls the real endpoints via the shared `apiClient`
 * (same-origin, cookie-authenticated) and maps the server's view to the admin's
 * `Workspace` shape — deriving presentation-only fields (member initials and
 * avatar colors) on the client, since the server stores neither.
 */

/** A member as returned by the server (presentation fields are derived here). */
interface WorkspaceMemberView {
    id: string;
    name: string | null;
    email: string;
}

/** A workspace as returned by the server. */
interface WorkspaceView {
    id: string;
    name: string;
    slug: string;
    description: string;
    color: string;
    status: 'active' | 'archived';
    members: WorkspaceMemberView[];
}

/**
 * Arguments to {@link createWorkspace}: the API request body plus the creator.
 * The server derives the owner from the session and ignores `creator`; it's kept
 * only so the mutation hook can seed an optimistic card before the response.
 */
export type CreateWorkspaceArgs = {
    body: CreateWorkspaceBody;
    creator: WorkspaceMember;
};

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

/** Maps a server workspace view to the admin's `Workspace`. */
function toWorkspace(view: WorkspaceView): Workspace {
    return {
        id: view.id,
        name: view.name,
        description: view.description,
        color: view.color as AvatarColor,
        status: STATUS[view.status],
        members: view.members.map(toMember)
    };
}

/** Lists every workspace. */
export async function listWorkspaces(): Promise<Workspace[]> {
    try {
        const { data } = await apiClient.get<WorkspaceView[]>('/workspaces');
        return data.map(toWorkspace);
    } catch (error) {
        throw toApiError(error);
    }
}

/** Whether `slug` is free. */
export async function checkSlugAvailable(slug: string): Promise<boolean> {
    try {
        const { data } = await apiClient.get<{ available: boolean }>(
            '/workspaces/slug-available',
            { params: { slug } }
        );
        return data.available;
    } catch (error) {
        throw toApiError(error);
    }
}

/** Creates a workspace and returns it. The owner comes from the session. */
export async function createWorkspace({
    body
}: CreateWorkspaceArgs): Promise<Workspace> {
    try {
        const { data } = await apiClient.post<WorkspaceView>(
            '/workspaces',
            body
        );
        return toWorkspace(data);
    } catch (error) {
        throw toApiError(error);
    }
}

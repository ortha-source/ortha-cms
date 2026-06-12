import { apiClient } from '@ortha-cms/utils-admin';
import type {
    Member,
    MemberList,
    MemberRole,
    MemberStatus,
    MemberWorkspace
} from '../../types/member';
import { initialsOf } from '../../utils/initialsOf';
import { asAvatarColor, avatarColorForId } from '../../utils/avatarColor';

// The complete members API contract lives in this one module — wire types,
// query keys, request functions, and the wire→model mappers — so swapping or
// extending an endpoint is a single-file change. The `use*` hooks next door
// only bind these functions to TanStack Query. The admin can't import the
// server package (separate apps / module boundaries), so the wire types
// mirror `@ortha-cms/users-server`'s `MemberView` / `MemberListView`.

/**
 * Page size the server applies when none is requested. Mirrors the server's
 * `DEFAULT_PAGE_SIZE`; used only as a fallback for the page-count math before
 * the first response lands.
 */
export const DEFAULT_PAGE_SIZE = 10;

/** Query keys for the members cache; mutations invalidate `membersKeys.all`. */
export const membersKeys = {
    /** Root key covering every members query. */
    all: ['members'] as const,
    /** One list page for the given params. */
    list: (params: MembersListParams) => ['members', 'list', params] as const
};

/** Parameters accepted by `GET /api/users`. */
export type MembersListParams = {
    /** Case-insensitive name/email substring; omit for no filter. */
    search?: string;
    /** 1-based page number; the server defaults to 1. */
    page?: number;
};

/** A member's role as returned by the API. */
export type MemberRoleResponse = {
    id: string;
    key: string;
    name: string;
};

/** A member's workspace as returned by the API. */
export type MemberWorkspaceResponse = {
    id: string;
    name: string;
    color: string;
};

/**
 * A member as returned by the users API. `name` is `null` until the invite is
 * accepted; `createdAt` is an ISO timestamp (the invite date while
 * `pending`); `isLastAdmin` is the server-computed "sole active admin" flag
 * the guardrail UI reads.
 */
export type MemberResponse = {
    id: string;
    email: string;
    name: string | null;
    role: MemberRoleResponse;
    status: MemberStatus;
    createdAt: string;
    isLastAdmin: boolean;
    workspaces: MemberWorkspaceResponse[];
};

/** The paginated envelope returned by `GET /api/users`. */
export type MemberListResponse = {
    items: MemberResponse[];
    total: number;
    page: number;
    pageSize: number;
};

/** The shape the invite form submits. */
export type InviteMemberInput = {
    email: string;
    role: MemberRole;
    name?: string;
    /** Workspaces to grant the new member access to (optional). */
    workspaceIds?: string[];
};

/** A partial member edit; omitted fields are left unchanged. */
export type UpdateMemberInput = {
    id: string;
    name?: string;
    role?: MemberRole;
};

/** Maps a workspace from the wire to the admin's presentational shape. */
function toMemberWorkspace(dto: MemberWorkspaceResponse): MemberWorkspace {
    return {
        id: dto.id,
        name: dto.name,
        initials: initialsOf(dto.name),
        color: asAvatarColor(dto.color)
    };
}

/** Maps a member from the wire to the admin's `Member` model. */
export function toMember(dto: MemberResponse): Member {
    const name = dto.name ?? dto.email;
    return {
        id: dto.id,
        name,
        email: dto.email,
        initials: initialsOf(name),
        color: avatarColorForId(dto.id),
        // An unknown role key (a future custom role) falls back to `viewer`
        // for the inline select; the label still shows the server's name.
        role: isMemberRole(dto.role.key) ? dto.role.key : 'viewer',
        roleName: dto.role.name,
        status: dto.status,
        joinedAt: new Date(dto.createdAt),
        isLastAdmin: dto.isLastAdmin,
        workspaces: dto.workspaces.map(toMemberWorkspace)
    };
}

function isMemberRole(key: string): key is MemberRole {
    return key === 'admin' || key === 'contributor' || key === 'viewer';
}

/** Fetches one page of members from `GET /api/users`. */
export async function fetchMembers(
    params: MembersListParams
): Promise<MemberList> {
    const { data } = await apiClient.get<MemberListResponse>('/users', {
        params
    });
    return {
        items: data.items.map(toMember),
        total: data.total,
        page: data.page,
        pageSize: data.pageSize
    };
}

/** Invites a person via `POST /api/users/invites`; 409 = email taken. */
export async function inviteMember(input: InviteMemberInput): Promise<Member> {
    const { data } = await apiClient.post<MemberResponse>(
        '/users/invites',
        input
    );
    return toMember(data);
}

/** Edits name and/or role via `PATCH /api/users/:id`; 409 = last admin. */
export async function updateMember(input: UpdateMemberInput): Promise<Member> {
    const { id, ...body } = input;
    const { data } = await apiClient.patch<MemberResponse>(
        `/users/${id}`,
        body
    );
    return toMember(data);
}

/** Disables an active member via `POST /api/users/:id/disable`. */
export async function disableMember(id: string): Promise<Member> {
    const { data } = await apiClient.post<MemberResponse>(
        `/users/${id}/disable`
    );
    return toMember(data);
}

/** Re-enables a disabled member via `POST /api/users/:id/enable`. */
export async function enableMember(id: string): Promise<Member> {
    const { data } = await apiClient.post<MemberResponse>(
        `/users/${id}/enable`
    );
    return toMember(data);
}

/** Rotates a pending invite via `POST /api/users/:id/invites/resend`. */
export async function resendInvite(id: string): Promise<Member> {
    const { data } = await apiClient.post<MemberResponse>(
        `/users/${id}/invites/resend`
    );
    return toMember(data);
}

/** Revokes a pending invite via `DELETE /api/users/:id/invites`. */
export async function revokeInvite(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}/invites`);
}

import {
    apiClient,
    asAvatarColor,
    initialsOf,
    toApiError
} from '@orthacms/utils-admin';
import type {
    InvitedMember,
    Member,
    MemberList,
    MemberSignIn,
    MemberWithResetToken,
    RoleCatalogEntry
} from '../../domain/types/member';
import type { UserSession } from '../../domain/types/session';
import type { WorkspaceOption } from '../../domain/types/workspaceOption';
import {
    toInvitedMember,
    toMember,
    toMemberWithResetToken,
    toRoleCatalog,
    type InvitedMemberResponse,
    type MemberResponse,
    type PasswordResetMemberResponse,
    type RoleCatalogEntryResponse
} from '../memberMapper';
import type { MembersListParams } from '../membersKeys';
import type {
    AddWorkspaceMemberInput,
    InviteMemberInput,
    InviteMembersInput,
    MemberGateway,
    RemoveWorkspaceMemberInput,
    RevokeSessionInput,
    SetMemberStatusInput,
    UpdateMemberInput
} from '../memberGateway';

/** The paginated envelope returned by `GET /api/users`. */
type MemberListResponse = {
    items: MemberResponse[];
    total: number;
    page: number;
    pageSize: number;
    /** Absent from a server older than the members redesign. */
    counts?: MemberList['counts'];
};

/** Zero counts — what an older server's missing `counts` reads as. */
const NO_COUNTS: MemberList['counts'] = {
    everyone: 0,
    active: 0,
    admins: 0,
    invited: 0,
    disabled: 0
};

/** A session as returned by `GET /api/users/:id/sessions`. */
type UserSessionResponse = {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    lastUsedAt: string;
    expiresAt: string;
    current: boolean;
};

/** Only the fields the option list needs from `GET /api/workspaces`. */
type WorkspaceOptionResponse = {
    id: string;
    name: string;
    description: string | null;
    color: string;
};

/** Maps a session from the wire to the admin's model (timestamps → `Date`). */
function toUserSession(dto: UserSessionResponse): UserSession {
    return {
        id: dto.id,
        userAgent: dto.userAgent,
        ipAddress: dto.ipAddress,
        createdAt: new Date(dto.createdAt),
        lastSeenAt: new Date(dto.lastUsedAt),
        expiresAt: new Date(dto.expiresAt),
        current: dto.current
    };
}

/** Maps a workspace row to the admin's option shape (initials + avatar color). */
function toWorkspaceOption(dto: WorkspaceOptionResponse): WorkspaceOption {
    return {
        id: dto.id,
        name: dto.name,
        description: dto.description,
        initials: initialsOf(dto.name),
        color: asAvatarColor(dto.color)
    };
}

/**
 * HTTP implementation of {@link MemberGateway} over the shared `apiClient`
 * (axios, same-origin, cookie-authed; paths omit the `/api` dev-proxy prefix).
 * Every member response is run through the `toMember` anti-corruption mapper,
 * sessions and workspace options through their inline mappers, and every failure
 * is normalized with `toApiError`, so callers see the admin's models and
 * `ApiError`, never axios internals. The single place `apiClient` is used in
 * this plugin.
 */
export const httpMemberGateway: MemberGateway = {
    async list(params: MembersListParams): Promise<MemberList> {
        try {
            const { data } = await apiClient.get<MemberListResponse>('/users', {
                params
            });
            return {
                items: data.items.map(toMember),
                total: data.total,
                page: data.page,
                pageSize: data.pageSize,
                counts: data.counts ?? NO_COUNTS
            };
        } catch (error) {
            throw toApiError(error);
        }
    },

    async get(id: string): Promise<Member> {
        try {
            const { data } = await apiClient.get<MemberResponse>(
                `/users/${id}`
            );
            return toMember(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async invite(input: InviteMemberInput): Promise<InvitedMember> {
        try {
            const { data } = await apiClient.post<InvitedMemberResponse>(
                '/users/invites',
                input
            );
            return toInvitedMember(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async inviteMany(input: InviteMembersInput): Promise<InvitedMember[]> {
        try {
            const { data } = await apiClient.post<{
                items: InvitedMemberResponse[];
            }>('/users/invites/batch', input);
            return data.items.map(toInvitedMember);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async existingEmails(emails: readonly string[]): Promise<string[]> {
        if (emails.length === 0) {
            return [];
        }
        try {
            const { data } = await apiClient.get<MemberListResponse>('/users', {
                params: {
                    filter: JSON.stringify({
                        field: 'email',
                        op: 'in',
                        value: emails
                    }),
                    pageSize: Math.max(emails.length, 1)
                }
            });
            return data.items.map((item) => item.email.toLowerCase());
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listRoles(): Promise<RoleCatalogEntry[]> {
        try {
            const { data } = await apiClient.get<{
                items: RoleCatalogEntryResponse[];
            }>('/users/roles');
            return toRoleCatalog(data.items);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async getSignIn(id: string): Promise<MemberSignIn> {
        try {
            const { data } = await apiClient.get<MemberSignIn>(
                `/users/${id}/sign-in`
            );
            return {
                hasPassword: data.hasPassword,
                ssoProviders: data.ssoProviders ?? []
            };
        } catch (error) {
            throw toApiError(error);
        }
    },

    async revokeAllSessions(id: string): Promise<number> {
        try {
            const { data } = await apiClient.delete<{ revoked: number }>(
                `/users/${id}/sessions`
            );
            return data?.revoked ?? 0;
        } catch (error) {
            throw toApiError(error);
        }
    },

    async resendInvite(id: string): Promise<InvitedMember> {
        try {
            const { data } = await apiClient.post<InvitedMemberResponse>(
                `/users/${id}/invites/resend`
            );
            return toInvitedMember(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async issuePasswordReset(id: string): Promise<MemberWithResetToken> {
        try {
            const { data } = await apiClient.post<PasswordResetMemberResponse>(
                `/users/${id}/password-reset`
            );
            return toMemberWithResetToken(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async revokeInvite(id: string): Promise<void> {
        try {
            await apiClient.delete(`/users/${id}/invites`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async update({ id, ...body }: UpdateMemberInput): Promise<Member> {
        try {
            const { data } = await apiClient.patch<MemberResponse>(
                `/users/${id}`,
                body
            );
            return toMember(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async setStatus({ id, disabled }: SetMemberStatusInput): Promise<Member> {
        const action = disabled ? 'disable' : 'enable';
        try {
            const { data } = await apiClient.post<MemberResponse>(
                `/users/${id}/${action}`
            );
            return toMember(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async addWorkspace({
        userId,
        workspaceId
    }: AddWorkspaceMemberInput): Promise<void> {
        try {
            await apiClient.post(`/workspaces/${workspaceId}/members`, {
                userId
            });
        } catch (error) {
            throw toApiError(error);
        }
    },

    async removeWorkspace({
        userId,
        workspaceId
    }: RemoveWorkspaceMemberInput): Promise<void> {
        try {
            await apiClient.delete(
                `/workspaces/${workspaceId}/members/${userId}`
            );
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listSessions(id: string): Promise<UserSession[]> {
        try {
            const { data } = await apiClient.get<UserSessionResponse[]>(
                `/users/${id}/sessions`
            );
            return data.map(toUserSession);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async revokeSession({
        userId,
        sessionId
    }: RevokeSessionInput): Promise<void> {
        try {
            await apiClient.delete(`/users/${userId}/sessions/${sessionId}`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listWorkspaceOptions(): Promise<WorkspaceOption[]> {
        try {
            const { data } =
                await apiClient.get<WorkspaceOptionResponse[]>('/workspaces');
            return data.map(toWorkspaceOption);
        } catch (error) {
            throw toApiError(error);
        }
    }
};

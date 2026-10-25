import { apiClient, toApiError } from '@orthacms/utils-admin';
import type {
    ArchiveImpact,
    SharedSource,
    Workspace
} from '../../domain/types/workspace';
import type {
    ContentType,
    CreateWorkspaceBody,
    DirectoryUser,
    InviteDelivery
} from '../../domain/types/wizard';
import {
    toArchiveImpact,
    toSharedSources,
    type ArchiveImpactView,
    toWorkspace,
    type SharedSourcesView,
    type WorkspaceView
} from '../workspaceMapper';
import type {
    AddWorkspaceContentInput,
    AddWorkspaceMemberInput,
    RemoveWorkspaceContentInput,
    RemoveWorkspaceMemberInput,
    SetWorkspaceStatusInput,
    UpdateWorkspaceInput,
    WorkspaceGateway
} from '../workspaceGateway';

/** Response of `GET /api/workspaces/:id/content/:slug/entry-count`. */
interface ContentCountView {
    /** Entries of the content type currently stored in the workspace. */
    count: number;
}

/** Response of `GET /api/workspaces/:id/entry-count`. */
interface EntryCountView {
    /** Total entries across every content type in the workspace. */
    count: number;
}

/** A page of members from `GET /api/users` — only the fields the typeahead needs. */
interface MembersPage {
    items: {
        id: string;
        name: string | null;
        email: string;
        status: 'pending' | 'active' | 'disabled';
        role?: { name?: string | null } | null;
    }[];
}

/** What `POST /api/users/:id/invites/resend` answers, as far as this needs. */
interface InviteIssuedView {
    /** Present only when no mail provider carried it. */
    inviteToken?: string;
}

/** How many matches the typeahead asks for per query. */
const TYPEAHEAD_PAGE_SIZE = 10;

/**
 * HTTP implementation of {@link WorkspaceGateway} over the shared `apiClient`
 * (axios, same-origin, cookie-authed; paths omit the `/api` dev-proxy prefix).
 * Every workspace response is run through the `toWorkspace` anti-corruption
 * mapper, and every failure is normalized with `toApiError`, so callers see the
 * admin's models and `ApiError`, never axios internals.
 */
export const httpWorkspaceGateway: WorkspaceGateway = {
    async list(): Promise<Workspace[]> {
        try {
            const { data } =
                await apiClient.get<WorkspaceView[]>('/workspaces');
            return data.map(toWorkspace);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async create(body: CreateWorkspaceBody): Promise<Workspace> {
        try {
            const { data } = await apiClient.post<WorkspaceView>(
                '/workspaces',
                body
            );
            return toWorkspace(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async update({ id, ...patch }: UpdateWorkspaceInput): Promise<Workspace> {
        try {
            const { data } = await apiClient.patch<WorkspaceView>(
                `/workspaces/${id}`,
                patch
            );
            return toWorkspace(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async setStatus({
        id,
        status
    }: SetWorkspaceStatusInput): Promise<Workspace> {
        const action = status === 'Archived' ? 'archive' : 'unarchive';
        try {
            const { data } = await apiClient.post<WorkspaceView>(
                `/workspaces/${id}/${action}`
            );
            return toWorkspace(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async remove(id: string): Promise<void> {
        try {
            await apiClient.delete(`/workspaces/${id}`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async addMember({
        workspaceId,
        userId
    }: AddWorkspaceMemberInput): Promise<Workspace> {
        try {
            const { data } = await apiClient.post<WorkspaceView>(
                `/workspaces/${workspaceId}/members`,
                { userId }
            );
            return toWorkspace(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async removeMember({
        workspaceId,
        userId
    }: RemoveWorkspaceMemberInput): Promise<void> {
        try {
            await apiClient.delete(
                `/workspaces/${workspaceId}/members/${userId}`
            );
        } catch (error) {
            throw toApiError(error);
        }
    },

    async addContent({
        workspaceId,
        slug,
        sourceWorkspaceId
    }: AddWorkspaceContentInput): Promise<Workspace> {
        try {
            const { data } = await apiClient.post<WorkspaceView>(
                `/workspaces/${workspaceId}/content`,
                // An own grant sends the slug alone, exactly as before shared
                // grants existed.
                sourceWorkspaceId ? { slug, sourceWorkspaceId } : { slug }
            );
            return toWorkspace(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async removeContent({
        workspaceId,
        slug,
        sourceWorkspaceId
    }: RemoveWorkspaceContentInput): Promise<Workspace> {
        try {
            const { data } = await apiClient.delete<WorkspaceView>(
                `/workspaces/${workspaceId}/content/${slug}`,
                // Without `source` the server revokes the **own** grant — so a
                // shared removal must never drop it.
                sourceWorkspaceId
                    ? { params: { source: sourceWorkspaceId } }
                    : undefined
            );
            return toWorkspace(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listSharedSources(workspaceId: string): Promise<SharedSource[]> {
        try {
            const { data } = await apiClient.get<SharedSourcesView>(
                `/workspaces/${workspaceId}/shared-sources`
            );
            return toSharedSources(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async checkSlugAvailable(slug: string): Promise<boolean> {
        try {
            const { data } = await apiClient.get<{ available: boolean }>(
                '/workspaces/slug-available',
                { params: { slug } }
            );
            return data.available;
        } catch (error) {
            throw toApiError(error);
        }
    },

    async contentEntryCount(
        workspaceId: string,
        slug: string
    ): Promise<number> {
        try {
            const { data } = await apiClient.get<ContentCountView>(
                `/workspaces/${workspaceId}/content/${slug}/entry-count`
            );
            return data.count;
        } catch (error) {
            throw toApiError(error);
        }
    },

    async entryCount(workspaceId: string): Promise<number> {
        try {
            const { data } = await apiClient.get<EntryCountView>(
                `/workspaces/${workspaceId}/entry-count`
            );
            return data.count;
        } catch (error) {
            throw toApiError(error);
        }
    },

    async archiveImpact(workspaceId: string): Promise<ArchiveImpact> {
        try {
            const { data } = await apiClient.get<ArchiveImpactView>(
                `/workspaces/${workspaceId}/archive-impact`
            );
            return toArchiveImpact(data);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async sendInvite(
        userId: string
    ): Promise<Exclude<InviteDelivery, 'pending'>> {
        try {
            const { data } = await apiClient.post<InviteIssuedView>(
                `/users/${userId}/invites/resend`
            );
            // The raw token is deliberately dropped: it is a credential, and
            // Members can reveal the link again when someone needs it.
            return data?.inviteToken ? 'link' : 'sent';
        } catch (error) {
            throw toApiError(error);
        }
    },

    async searchUsers(query: string): Promise<DirectoryUser[]> {
        try {
            const { data } = await apiClient.get<MembersPage>('/users', {
                params: {
                    search: query,
                    pageSize: TYPEAHEAD_PAGE_SIZE
                }
            });
            return data.items
                .filter((member) => member.status !== 'disabled')
                .map((member) => ({
                    id: member.id,
                    name: member.name ?? member.email,
                    email: member.email,
                    ...(member.role?.name ? { role: member.role.name } : {})
                }));
        } catch (error) {
            throw toApiError(error);
        }
    },

    async listContentTypes(): Promise<ContentType[]> {
        try {
            const { data } =
                await apiClient.get<ContentType[]>('/content-types');
            return data;
        } catch (error) {
            throw toApiError(error);
        }
    }
};

import type {
    InvitedMember,
    Member,
    MemberList,
    MemberRole
} from '../../domain/types/member';
import type { UserSession } from '../../domain/types/session';
import type { WorkspaceOption } from '../../domain/types/workspaceOption';
import type { MembersListParams } from '../membersKeys';

/** The shape the invite form submits. */
export type InviteMemberInput = {
    /** The invitee's email; the join link is sent here. */
    email: string;
    /** The global role granted on acceptance. */
    role: MemberRole;
    /** Optional display name (the invitee can set their own on accept). */
    name?: string;
    /** Workspaces to grant the new member access to (optional). */
    workspaceIds?: string[];
};

/** A partial member edit; omitted fields are left unchanged. */
export type UpdateMemberInput = {
    /** The member to edit. */
    id: string;
    /** New display name. */
    name?: string;
    /** New global role. */
    role?: MemberRole;
};

/** Which member to flip, and which way. */
export type SetMemberStatusInput = {
    /** The member to update. */
    id: string;
    /** `true` disables the account, `false` re-enables it. */
    disabled: boolean;
};

/** Identifies the membership to create: which member, which workspace. */
export type AddWorkspaceMemberInput = {
    /** The member being added. */
    userId: string;
    /** The workspace to add them to. */
    workspaceId: string;
};

/** Identifies the membership to remove: which member, which workspace. */
export type RemoveWorkspaceMemberInput = {
    /** The member being removed. */
    userId: string;
    /** The workspace to remove them from. */
    workspaceId: string;
};

/** Identifies the session to revoke: whose, and which. */
export type RevokeSessionInput = {
    /** The member who owns the session. */
    userId: string;
    /** The session row id to revoke. */
    sessionId: string;
};

/**
 * The port over the remote users/members API — the single seam the admin plugin
 * talks to instead of `apiClient` directly. Every method returns the admin's
 * mapped models (via the `memberMapper` anti-corruption layer, or an inline
 * timestamp/avatar mapping for sessions and workspace options), never the wire
 * shape, and normalizes every failure to `ApiError`, so the application hooks
 * and presentation stay off the transport. {@link httpMemberGateway} is the HTTP
 * implementation.
 */
export type MemberGateway = {
    /** Lists one page of members via `GET /api/users`. */
    list(params: MembersListParams): Promise<MemberList>;
    /** Fetches one member's full record via `GET /api/users/:id`. */
    get(id: string): Promise<Member>;
    /**
     * Invites a person via `POST /api/users/invites` (`409` = email taken).
     * Resolves with the new member **and** their one-time invite token — the
     * only moment it is readable, since no mailer sends the link yet.
     */
    invite(input: InviteMemberInput): Promise<InvitedMember>;
    /**
     * Rotates a pending invite via `POST /api/users/:id/invites/resend`,
     * resolving with the member and the fresh token. Rotating kills the
     * previous link, so the new one has to reach the invitee.
     */
    resendInvite(id: string): Promise<InvitedMember>;
    /** Revokes a pending invite via `DELETE /api/users/:id/invites`. */
    revokeInvite(id: string): Promise<void>;
    /** Edits name/role via `PATCH /api/users/:id` (`409` = last admin). */
    update(input: UpdateMemberInput): Promise<Member>;
    /** Disables or re-enables a member via `POST /api/users/:id/(disable|enable)`. */
    setStatus(input: SetMemberStatusInput): Promise<Member>;
    /** Links a member to a workspace via `POST /api/workspaces/:id/members`. */
    addWorkspace(input: AddWorkspaceMemberInput): Promise<void>;
    /** Unlinks a member via `DELETE /api/workspaces/:id/members/:userId`. */
    removeWorkspace(input: RemoveWorkspaceMemberInput): Promise<void>;
    /** Lists a member's live sessions via `GET /api/users/:id/sessions`. */
    listSessions(id: string): Promise<UserSession[]>;
    /** Revokes one session via `DELETE /api/users/:id/sessions/:sessionId`. */
    revokeSession(input: RevokeSessionInput): Promise<void>;
    /** Lists every workspace (via `GET /api/workspaces`) for the assignment steps. */
    listWorkspaceOptions(): Promise<WorkspaceOption[]>;
};

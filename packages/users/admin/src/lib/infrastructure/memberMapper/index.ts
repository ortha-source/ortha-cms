import {
    asAvatarColor,
    avatarColorForId,
    initialsOf
} from '@ortha-cms/utils-admin';
import type {
    Member,
    MemberRole,
    MemberStatus,
    MemberWorkspace
} from '../../domain/types/member';

// The shared wire→model contract for a member. The admin can't import the
// server package (separate apps / module boundaries), so these wire types
// mirror `@ortha-cms/users-server`'s `MemberView`. Every request function that
// returns a member maps it through `toMember`, so the shape and the mapper
// live together here and each hook owns only its own endpoint call.

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
    description: string | null;
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

/** Maps a workspace from the wire to the admin's presentational shape. */
function toMemberWorkspace(dto: MemberWorkspaceResponse): MemberWorkspace {
    return {
        id: dto.id,
        name: dto.name,
        description: dto.description,
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

/** Whether a wire role key is one of the admin's assignable roles. */
function isMemberRole(key: string): key is MemberRole {
    return key === 'admin' || key === 'contributor' || key === 'viewer';
}

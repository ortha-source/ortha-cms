import type { AvatarColor } from '@ortha-cms/design-system';

/** Lifecycle status of a workspace. */
export type WorkspaceStatus = 'Active' | 'Archived';

/** A person who belongs to a workspace. */
export type WorkspaceMember = {
    /** Stable member id. */
    id: string;
    /** Display name. */
    name: string;
    /** Two-letter initials shown in the avatar. */
    initials: string;
    /** Contact email. */
    email: string;
    /** Accent color tinting the member's avatar. */
    color: AvatarColor;
};

/**
 * A workspace: a self-contained grouping of content, members, and plugins.
 * `memberCount` is never stored — derive it from {@link memberCount}.
 */
export type Workspace = {
    /** Stable workspace id. */
    id: string;
    /** Display name. */
    name: string;
    /** Short summary of what the workspace holds. */
    description: string;
    /** Accent color tinting the workspace avatar. */
    color: AvatarColor;
    /** Lifecycle status. */
    status: WorkspaceStatus;
    /** Everyone who belongs to the workspace. */
    members: WorkspaceMember[];
};

/** Number of members in a workspace. */
export const memberCount = (workspace: Workspace): number =>
    workspace.members.length;

/**
 * A member of a workspace, as returned by the read API. Joined from
 * `memberships → users`; `name` is nullable because a user's display name is
 * unset until they accept their invite. Presentational fields the admin needs
 * (initials, avatar color) are derived client-side, not persisted here.
 */
export interface WorkspaceMemberView {
    /** The member's user id. */
    id: string;
    /** Display name, or `null` until the user sets one. */
    name: string | null;
    /** Contact email. */
    email: string;
}

/**
 * A workspace as returned by `GET /api/workspaces`, scoped to the requesting
 * user's memberships. Mirrors the persisted columns plus the embedded member
 * roster. `color`/`status` are intentionally absent — they are admin-only
 * presentation, not persisted entities.
 */
export interface WorkspaceView {
    /** Primary key. */
    id: string;
    /** Human-readable workspace name. */
    name: string;
    /** URL-safe identifier, unique across the system. */
    slug: string;
    /** Optional short summary, or `null`. */
    description: string | null;
    /** Row creation timestamp. */
    createdAt: Date;
    /** Last-modified timestamp. */
    updatedAt: Date;
    /** Everyone who belongs to the workspace. */
    members: WorkspaceMemberView[];
}

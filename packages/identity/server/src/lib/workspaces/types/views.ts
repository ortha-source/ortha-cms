/** A workspace member as exposed by the workspace endpoints. */
export interface WorkspaceMemberView {
    /** Stable user id. */
    id: string;
    /** Display name; `null` until the user sets one. */
    name: string | null;
    /** Email address. */
    email: string;
    /**
     * Whether this member is the workspace owner (`workspaces.owner_user_id`).
     * Derived server-side from the recorded owner, not from roster position, so
     * it stays correct regardless of membership insertion order. The admin pins
     * the owner as un-removable. At most one member is the owner; a workspace
     * whose owner is no longer a member (or was cleared) has none.
     */
    isOwner: boolean;
}

/** A workspace as exposed by the workspace endpoints. */
export interface WorkspaceView {
    /** Stable workspace id. */
    id: string;
    /** Display name. */
    name: string;
    /** URL slug. */
    slug: string;
    /** Long description; empty string when unset. */
    description: string;
    /** Accent color key. */
    color: string;
    /** Lifecycle state. */
    status: 'active' | 'archived';
    /** Members, owner first; each flags whether it {@link WorkspaceMemberView.isOwner}. */
    members: WorkspaceMemberView[];
    /**
     * Slugs of the code-defined content types this workspace was granted at
     * creation (its `workspace_content` rows). The admin scopes its Content
     * Library to these.
     */
    content: string[];
}

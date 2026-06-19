/** A workspace member as exposed by the workspace endpoints. */
export interface WorkspaceMemberView {
    /** Stable user id. */
    id: string;
    /** Display name; `null` until the user sets one. */
    name: string | null;
    /** Email address. */
    email: string;
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
    /** Members, owner first (insertion order). */
    members: WorkspaceMemberView[];
    /**
     * Slugs of the code-defined content types this workspace was granted at
     * creation (its `workspace_content` rows). The admin scopes its Content
     * Library to these.
     */
    content: string[];
}

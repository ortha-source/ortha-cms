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
    /**
     * Whether the workspace is shared (ADR-0019): its published entries are
     * readable and linkable, read-only, from other workspaces granted the type.
     */
    isShared: boolean;
    /** Members, in a stable order (earliest membership first). */
    members: WorkspaceMemberView[];
    /**
     * Slugs of the code-defined content types this workspace was granted at
     * creation (its `workspace_content` rows). The admin scopes its Content
     * Library to these.
     */
    content: string[];
}

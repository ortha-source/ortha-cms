/** A workspace member as exposed by the workspace endpoints. */
export interface WorkspaceMemberView {
    /** Stable user id. */
    id: string;
    /** Display name; `null` until the user sets one. */
    name: string | null;
    /** Email address. */
    email: string;
    /**
     * The account's lifecycle in the directory. `pending` is someone invited
     * by email who has not accepted yet — still a member, so the admin can say
     * "1 invite" rather than counting them as an active teammate.
     */
    status: 'pending' | 'active' | 'disabled';
}

/**
 * One **shared** content grant (ADR-0019, "Explicit per-source grants") — the
 * workspace may read and link `slug` records of `sourceWorkspaceId`.
 */
export interface WorkspaceSharedContentView {
    /** The code-defined content type's slug. */
    slug: string;
    /** Whether `slug` names a collection or a single page. */
    kind: 'collection' | 'single';
    /** The shared workspace the records come from. */
    sourceWorkspaceId: string;
    /** Its display name. */
    sourceWorkspaceName: string;
    /**
     * `false` when the grant is **inert**: the source is no longer shared, is
     * archived, or no longer holds its own grant for `slug`. An inert grant
     * exposes nothing until the source is eligible again.
     */
    available: boolean;
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
     * Slugs of the code-defined content types this workspace holds an **own**
     * grant for (its `workspace_content` rows with no source) — the types it
     * may author records of.
     */
    content: string[];
    /**
     * Its **shared** grants — read-and-link access to one shared workspace's
     * records of a type each — ordered by slug, then source name.
     */
    sharedContent: WorkspaceSharedContentView[];
    /**
     * Content entries the workspace holds across every type (soft-deleted
     * rows included, as the delete guard counts them). `0` when no content
     * plugin is bound. Display only — never proof of emptiness.
     */
    recordCount: number;
    /** {@link recordCount} split by content-type slug; a type with none is absent. */
    recordCountByType: Record<string, number>;
    /** When the workspace was created (ISO 8601). */
    createdAt: string;
    /**
     * When the workspace last moved (ISO 8601): the later of its own last
     * write and its newest entry's last edit. Sorts the cards by "recently
     * edited".
     */
    lastEditedAt: string;
    /** When it was archived (ISO 8601); `null` while it is active. */
    archivedAt: string | null;
}

/**
 * What archiving a workspace would touch — `GET /workspaces/:id/archive-impact`.
 * Archiving deletes nothing; these are the counts the confirmation states
 * before the button.
 */
export interface WorkspaceArchiveImpactView {
    /** Entries the workspace holds; they stay where they are. */
    records: number;
    /** Members; they keep their accounts and their membership. */
    members: number;
    /**
     * Other workspaces holding a **live** shared grant from this one — the
     * ones that will see its records as unavailable once it is archived. `0`
     * when it is not shared (their grants are already inert).
     */
    linkedWorkspaces: number;
}

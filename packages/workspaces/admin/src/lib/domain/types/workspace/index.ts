import type { AvatarColor } from '@orthacms/design-system';

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
 * The member count is never stored — read it from `members.length`.
 */
export type Workspace = {
    /** Stable workspace id. */
    id: string;
    /** URL-safe identifier, unique across the system. */
    slug: string;
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
    /**
     * Slugs of the content types granted to this workspace at creation. Feature
     * plugins (e.g. the Content Library) scope what they show to these.
     */
    content: string[];
    /**
     * Whether the workspace is **shared**: its published records can be linked
     * (and viewed read-only) from any other workspace granted the same content
     * type. Drafts never leave the workspace. Edits happen only here.
     */
    isShared: boolean;
    /**
     * Content granted **from shared workspaces**: one row per (type, source)
     * pair. Independent of {@link Workspace.content} — a type can be granted as
     * this workspace's own, from a shared source, or both, and each is added and
     * removed on its own.
     */
    sharedContent: SharedContentGrant[];
};

/** Kind of a granted content type — drives the collections/pages split. */
export type SharedContentKind = 'collection' | 'single';

/**
 * One grant of a content type **from another (shared) workspace**: this
 * workspace may read (and link) the source's published records of `slug`, but
 * never create its own through this grant.
 */
export type SharedContentGrant = {
    /** The content-type slug. */
    slug: string;
    /** Collection or single, as the source holds it. */
    kind: SharedContentKind;
    /** The shared workspace the records come from. */
    sourceWorkspaceId: string;
    /** That workspace's display name. */
    sourceWorkspaceName: string;
    /**
     * `false` when the source stopped sharing (or was archived): the grant is
     * kept but inert until the source shares again.
     */
    available: boolean;
};

/**
 * A shared workspace this workspace could be granted content from, with the
 * content types it holds — served by `GET /workspaces/:id/shared-sources`.
 */
export type SharedSource = {
    /** The shared workspace's id. */
    workspaceId: string;
    /** Its display name. */
    workspaceName: string;
    /** The content types it holds, grantable from it. */
    content: { slug: string; kind: SharedContentKind }[];
};

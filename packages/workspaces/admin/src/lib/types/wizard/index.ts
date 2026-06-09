import type { AvatarColor } from '@ortha-cms/design-system';

/** Live state of the slug availability check. */
export type SlugStatus =
    | 'empty'
    | 'invalid'
    | 'checking'
    | 'available'
    | 'taken';

/** Roles assignable to a member through the role dropdown. */
export type AssignableRole = 'admin' | 'editor' | 'viewer';

/** A member's role. The creator is always the (locked) `owner`. */
export type WorkspaceRole = 'owner' | AssignableRole;

/**
 * A person being granted access in the wizard. `invited` members were typed in
 * as an email that isn't in the directory yet — they have no `id` until the
 * invite is sent server-side.
 */
export type MemberDraft = {
    /** Directory id, or the email for an invited member without an account. */
    id: string;
    /** Display name (the email for invited members). */
    name: string;
    /** Contact email. */
    email: string;
    /** Assigned role. */
    role: AssignableRole;
    /** Whether this is an invite-by-email rather than an existing user. */
    invited?: boolean;
};

/** A user returned by the directory search. */
export type DirectoryUser = {
    /** Stable id. */
    id: string;
    /** Full display name. */
    name: string;
    /** Email address. */
    email: string;
};

/** Kind of a content type — drives the collections/pages split. */
export type ContentTypeKind = 'collection' | 'single';

/** A content type the workspace can be granted access to. */
export type ContentType = {
    /** Stable machine name. */
    name: string;
    /** Whether it is a multi-entry collection or a standalone page. */
    kind: ContentTypeKind;
    /** Human label; falls back to `name`. */
    label?: string;
    /** Short description shown under the label. */
    description?: string;
    /** Route path — pages only; searchable alongside the name. */
    path?: string;
};

/**
 * Generic selection model reused for collections and pages. `specific` lists
 * explicit ids; `all` grants everything (including future items) and tracks a
 * blacklist — constant payload regardless of how many items exist.
 */
export type ResourceSelection =
    | { mode: 'specific'; ids: string[] }
    | { mode: 'all'; excludedIds: string[] };

/** Page-level content decision: full access vs. a specific selection. */
export type ContentMode = 'all' | 'specific';

/** The basics (step 1) form values. */
export type WizardData = {
    /** Workspace display name. */
    name: string;
    /** URL slug — auto-derived from the name until the user edits it. */
    slug: string;
    /** Whether the user has manually edited the slug. */
    slugEdited: boolean;
    /** Optional long description. */
    description: string;
    /** Accent color for the workspace monogram. */
    color: AvatarColor;
};

/**
 * A full snapshot of every wizard step — the input to
 * {@link buildCreateWorkspaceBody}. The page can pass an overridden snapshot
 * (e.g. empty content for "Skip & create") without mutating wizard state.
 */
export type WizardSnapshot = {
    /** Step 1 basics. */
    data: WizardData;
    /** Added members (the owner is implied by the session, not listed here). */
    members: MemberDraft[];
    /** Page-level content decision. */
    contentMode: ContentMode;
    /** Collection selection (used only when `contentMode === 'specific'`). */
    collections: ResourceSelection;
    /** Page selection (used only when `contentMode === 'specific'`). */
    pages: ResourceSelection;
};

/** The request body POSTed to `/api/workspaces`. */
export type CreateWorkspaceBody = {
    name: string;
    slug: string;
    description: string;
    color: AvatarColor;
    members: {
        id: string;
        name: string;
        email: string;
        role: AssignableRole;
        invited: boolean;
    }[];
    content:
        | { mode: 'all' }
        | { mode: 'specific'; collections: ResourceSelection; pages: ResourceSelection };
};

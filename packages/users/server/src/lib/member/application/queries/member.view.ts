/** The role a member holds, joined from `users → roles`. */
export interface MemberRoleView {
    /** Role primary key. */
    id: string;
    /** Stable machine key (`admin` / `contributor` / `viewer`). */
    key: string;
    /** Human-readable label (e.g. `Administrator`). */
    name: string;
}

/** A workspace a member belongs to, joined from `memberships → workspaces`. */
export interface MemberWorkspaceView {
    /** Workspace primary key. */
    id: string;
    /** Display name. */
    name: string;
    /** Short description, or `null` when none is set. */
    description: string | null;
    /** Accent color key (a design-system `AVATAR_COLORS` value). */
    color: string;
}

/**
 * A member of the system as returned by the users API. Joined from
 * `users → roles` plus the member's workspaces. `status` mirrors identity's
 * `user_status` enum: `pending` is an invite that has not been accepted yet
 * (the admin renders it as "Invited"), so for pending rows `createdAt` is the
 * invite date rather than a join date.
 */
export interface MemberView {
    /** The member's user id. */
    id: string;
    /** Contact email (the invite recipient for pending rows). */
    email: string;
    /** Display name, or `null` until the user sets one on invite accept. */
    name: string | null;
    /** The member's single global role. */
    role: MemberRoleView;
    /** Account lifecycle state. */
    status: 'pending' | 'active' | 'disabled';
    /** Membership creation date; the invite date while `pending`. */
    createdAt: Date;
    /**
     * Whether this member is the only active administrator. Computed
     * server-side so the admin UI can disable demote/disable controls with an
     * explanation instead of re-deriving the invariant client-side; the
     * use cases enforce it regardless.
     */
    isLastAdmin: boolean;
    /** The workspaces this member belongs to, name-ordered. */
    workspaces: MemberWorkspaceView[];
}

/** One page of members, as returned by `GET /api/users`. */
export interface MemberListView {
    /** The members on this page. */
    items: MemberView[];
    /** Total members matching the search, across all pages. */
    total: number;
    /** 1-based page number echoed back. */
    page: number;
    /** Page size echoed back. */
    pageSize: number;
}

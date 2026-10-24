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
    /**
     * The last authenticated request seen from any of this member's sessions
     * (identity's `sessions.last_used_at`, revoked and expired rows included),
     * or `null` when they have never signed in. Derived at read time — there
     * is no column for it, so the package still owns no table (I-13).
     */
    lastActiveAt: Date | null;
}

/**
 * A member plus the one-time invite token just issued for them — the response
 * of `POST /api/users/invites` and `POST /api/users/:id/invites/resend`, and
 * **only** those two. The list and detail reads return a plain
 * {@link MemberView}, so a token never leaks into a route that merely displays
 * members.
 *
 * The token is the secret half of the invite link. Only its hash is stored, so
 * when it is present this response is the single moment it exists in readable
 * form.
 *
 * **It is present only when nothing else will deliver it.** With a mail
 * provider configured the invitation carries the link and the field is
 * **absent** — not empty (ADR-0018 §4), so a client that reads it blindly fails
 * loudly rather than pasting `undefined` into a chat window. `revealLinks`
 * keeps it alongside the message for debugging a delivery problem, and
 * `POST /api/users/:id/reveal-link` is the audited way to see one otherwise.
 */
export interface InvitedMemberView extends MemberView {
    /**
     * The raw invite token, shown to the inviting admin exactly once — absent
     * when a mail provider is delivering it instead.
     */
    inviteToken?: string;
    /**
     * When the invite link stops working (identity's `token.inviteTtlSeconds`
     * after issue). Not a secret, so it is present whether or not the token
     * is; set by the routes that mint one, absent on resend.
     */
    inviteExpiresAt?: Date;
}

/**
 * The response of `POST /api/users/invites/batch` — every member the batch
 * created, in the order their addresses were given. All-or-nothing: a batch
 * that would collide with an existing account creates nobody.
 */
export interface InvitedMemberBatchView {
    /** One entry per invited address. */
    items: InvitedMemberView[];
}

/**
 * A member plus the one-time password-reset token just issued for them — the
 * response of `POST /api/users/:id/password-reset`, and **only** that route.
 * Every other read returns a plain {@link MemberView}, so a token never leaks
 * into a route that merely displays members.
 *
 * The token is the secret half of the reset link, and it is **absent** once a
 * mail provider is configured, on the same terms as
 * {@link InvitedMemberView.inviteToken}.
 */
export interface PasswordResetMemberView extends MemberView {
    /**
     * The raw reset token, shown to the issuing admin exactly once — absent
     * when a mail provider is delivering it instead.
     */
    resetToken?: string;
    /** When the reset link stops working (identity's `token.resetTtlSeconds`). */
    resetExpiresAt?: Date;
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
    /**
     * Directory-wide head counts behind the roster's quick filters and its
     * subtitle. Deliberately **not** narrowed by `search`/`status`/`role`/
     * `filter`: they describe the directory, so a chip's number does not
     * change under the user's feet as they type.
     */
    counts: MemberCountsView;
}

/** Head counts over every member, by the quick filter that selects them. */
export interface MemberCountsView {
    /** Every member, whatever their status. */
    everyone: number;
    /** Members who can sign in today (`active`). */
    active: number;
    /** Members holding the `admin` role, in any status. */
    admins: number;
    /** Invites not yet accepted (`pending`). */
    invited: number;
    /** Suspended members (`disabled`). */
    disabled: number;
}

/**
 * One assignable system role and the permission keys it grants — the response
 * row of `GET /api/users/roles`. Read from identity's `SYSTEM_ROLES`, the one
 * source of truth the seeder reconciles the database to, so the admin's
 * "what changes" table can never describe a grant the server does not make.
 */
export interface RoleCatalogEntryView {
    /** Stable machine key (`admin` / `contributor` / `viewer`). */
    key: string;
    /** Human-readable label (e.g. `Administrator`). */
    name: string;
    /** Every permission key the role grants. */
    permissions: string[];
}

/**
 * How a member can sign in — the response of `GET /api/users/:id/sign-in`.
 * Two facts, never a credential: whether a password is set at all, and which
 * SSO providers are linked to the account.
 */
export interface MemberSignInView {
    /** Whether the account has a password (false until an invite is accepted). */
    hasPassword: boolean;
    /** Registered names of the SSO providers linked to the account, sorted. */
    ssoProviders: string[];
}

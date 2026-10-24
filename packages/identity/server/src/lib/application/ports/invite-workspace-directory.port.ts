/**
 * Port that answers "which workspaces will this invitee join?" — the second
 * half of what the accept-invite screen says before any password is typed
 * ("…as a Contributor in Marketing site and Support hub").
 *
 * Workspace memberships belong to the workspaces plugin, and identity must not
 * depend on `@orthacms/workspaces-server` (which depends back on identity), so
 * this is the same inversion {@link WORKSPACE_DIRECTORY} uses: identity owns the
 * port, the workspaces plugin binds an adapter. Injected `@Optional()` — with no
 * workspaces plugin there are no memberships to name, and the screen simply
 * leaves the "in …" clause out.
 *
 * It is only ever asked about an account whose **live invite token** was just
 * presented, so it never answers for an arbitrary id coming off the wire.
 */
export interface InviteWorkspaceDirectory {
    /**
     * The display names of the workspaces `userId` is a member of, sorted for
     * display. Empty when they belong to none.
     */
    namesFor(userId: string): Promise<string[]>;
}

/** DI token the workspaces plugin binds to an {@link InviteWorkspaceDirectory}. */
export const INVITE_WORKSPACE_DIRECTORY = Symbol('INVITE_WORKSPACE_DIRECTORY');

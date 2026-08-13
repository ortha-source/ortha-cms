/**
 * Thrown by `ApiTokenService.mint` when the requested bucket names workspaces
 * that do not exist. Transport-agnostic — the controller maps it to a 400,
 * since it is a client mistake and not an authorization failure.
 *
 * Naming the offending ids is deliberate and leaks nothing: the caller supplied
 * them, holds `tokens:create` (admin-only), and cannot learn anything from being
 * told an id they invented is unknown.
 */
export class UnknownWorkspaceError extends Error {
    constructor(
        /** The requested ids that matched no workspace. */
        readonly workspaceIds: readonly string[]
    ) {
        super(
            `Unknown workspace ${workspaceIds.length === 1 ? 'id' : 'ids'}: ${workspaceIds.join(', ')}`
        );
        this.name = 'UnknownWorkspaceError';
    }
}

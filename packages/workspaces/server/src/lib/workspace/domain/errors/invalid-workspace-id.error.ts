/**
 * Raised by {@link WorkspaceId.create} when a value isn't a UUID. Transport-
 * agnostic — the controller maps it to HTTP 400 (matching the route's
 * `ParseUUIDPipe`).
 */
export class InvalidWorkspaceIdError extends Error {
    constructor(public readonly value: string) {
        super(`Invalid workspace id: ${value}`);
        this.name = 'InvalidWorkspaceIdError';
    }
}

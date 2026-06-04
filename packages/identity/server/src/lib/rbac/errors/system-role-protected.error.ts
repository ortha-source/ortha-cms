/**
 * Thrown when a delete targets a protected system role. Transport-agnostic
 * — a controller maps it to HTTP 403 in a later ticket.
 */
export class SystemRoleProtectedError extends Error {
    constructor(public readonly roleId: string) {
        super(`System roles cannot be deleted: ${roleId}`);
        this.name = 'SystemRoleProtectedError';
    }
}

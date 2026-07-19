/**
 * Raised by {@link WorkspaceColor.create} when a value is outside the
 * design-system palette. Transport-agnostic — the controller maps it to HTTP
 * 400 (as the DTO's `@IsIn` did).
 */
export class InvalidWorkspaceColorError extends Error {
    constructor(public readonly value: string) {
        super(`Invalid workspace color: ${value}`);
        this.name = 'InvalidWorkspaceColorError';
    }
}

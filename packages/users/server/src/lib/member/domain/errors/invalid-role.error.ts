/**
 * Raised by {@link Role.create} when a role key is empty. The set of
 * *assignable* role keys is validated at the DTO boundary (`@IsIn`); a loaded
 * member may hold any (including custom) non-empty role key. Transport-agnostic.
 */
export class InvalidRoleError extends Error {
    constructor(public readonly key: string) {
        super(`Invalid role key: ${key}`);
        this.name = 'InvalidRoleError';
    }
}

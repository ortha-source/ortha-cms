/**
 * Raised by {@link Slug.create} when a slug is empty, too long, or contains
 * anything other than lowercase letters, digits, and hyphens. Transport-
 * agnostic — the controller maps it to HTTP 400 (as the DTO's `@Matches` did).
 */
export class InvalidSlugError extends Error {
    constructor(public readonly slug: string) {
        super('slug must contain only lowercase letters, digits, and hyphens');
        this.name = 'InvalidSlugError';
    }
}

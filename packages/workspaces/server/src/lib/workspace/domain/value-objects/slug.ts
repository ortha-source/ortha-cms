import { InvalidSlugError } from '../errors';

/** URL-safe slug shape: lowercase letters, digits, and hyphens only. */
const SLUG_RE = /^[a-z0-9-]+$/;

/** Longest slug the schema accepts (mirrors the DTO's prior `@MaxLength`). */
const MAX_LENGTH = 120;

/**
 * A workspace's URL slug. Owns the format rule that used to live on the
 * `CreateWorkspaceDto` `@Matches` decorator, so the invariant travels with the
 * value instead of the transport DTO. Unique across the system, but that is a
 * cross-aggregate rule enforced by {@link SlugUniquenessService}, not here.
 */
export class Slug {
    private constructor(private readonly slug: string) {}

    /**
     * Builds a {@link Slug}, rejecting an empty, over-long, or wrongly-shaped
     * value with {@link InvalidSlugError} (the application maps it to HTTP 400,
     * as the validation pipe did before).
     */
    static create(value: string): Slug {
        if (
            value.length === 0 ||
            value.length > MAX_LENGTH ||
            !SLUG_RE.test(value)
        ) {
            throw new InvalidSlugError(value);
        }
        return new Slug(value);
    }

    /** The underlying slug string. */
    get value(): string {
        return this.slug;
    }
}

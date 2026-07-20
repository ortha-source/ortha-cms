/**
 * URL-safe slug shape: lowercase letters, digits, and hyphens only. Mirrors the
 * server's `Slug.create` rule so the admin validates the same invariant the API
 * enforces, instead of scattering the literal regex across the form hooks.
 */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Longest slug the server accepts (mirrors the server VO's `MAX_LENGTH`). */
const MAX_LENGTH = 120;

/**
 * A workspace's URL slug — a client-side value object mirroring the server's
 * {@link https://../server Slug} rule (lowercase letters, digits, hyphens; 1–120
 * chars). It exists so the create-workspace slug field and its Zod schema
 * validate instant feedback from **one** rule rather than each re-testing an
 * inline `^[a-z0-9-]+$` literal. Format only — uniqueness is a server concern
 * surfaced via `useSlugAvailability`.
 */
export class Slug {
    private constructor(private readonly slug: string) {}

    /**
     * Whether `value` is a well-shaped slug, without throwing — the check the
     * live availability hook and the basics schema use for instant feedback.
     */
    static isValid(value: string): boolean {
        return (
            value.length > 0 &&
            value.length <= MAX_LENGTH &&
            SLUG_PATTERN.test(value)
        );
    }

    /**
     * Builds a {@link Slug}, throwing on an empty, over-long, or wrongly-shaped
     * value. Used by the create use-case as a last guard before the request.
     */
    static create(value: string): Slug {
        if (!Slug.isValid(value)) {
            throw new Error(`Invalid workspace slug: "${value}"`);
        }
        return new Slug(value);
    }

    /** The underlying slug string. */
    get value(): string {
        return this.slug;
    }
}

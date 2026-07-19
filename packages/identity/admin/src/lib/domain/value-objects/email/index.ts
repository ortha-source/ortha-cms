/**
 * A pragmatic email shape: a non-empty local part, an `@`, and a dotted domain
 * with no spaces. Mirrors the server's login-email rule closely enough for
 * instant client feedback — the server remains the authority, so this is a
 * format gate, not the final word.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Longest email the server accepts (mirrors the server's column limit). */
const MAX_LENGTH = 320;

/**
 * A sign-in email address — a client-side value object mirroring the server's
 * email rule. It exists so the login form's email field validates one rule
 * rather than re-testing an inline `z.email()` literal. Format only — whether
 * the credentials are correct is a server concern surfaced as a `401` on submit.
 */
export class Email {
    private constructor(private readonly email: string) {}

    /**
     * Whether `value` is a well-shaped email, without throwing — the check the
     * login form's field uses for instant, per-keystroke feedback.
     */
    static isValid(value: string): boolean {
        return (
            value.length > 0 &&
            value.length <= MAX_LENGTH &&
            EMAIL_PATTERN.test(value)
        );
    }

    /**
     * Builds an {@link Email}, throwing on an empty, over-long, or wrongly-shaped
     * value. Available as a last guard before a request that needs a valid email.
     */
    static create(value: string): Email {
        if (!Email.isValid(value)) {
            throw new Error(`Invalid email: "${value}"`);
        }
        return new Email(value);
    }

    /** The underlying email string. */
    get value(): string {
        return this.email;
    }
}

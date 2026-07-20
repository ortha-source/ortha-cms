/**
 * A pragmatic email shape: a non-empty local part, an `@`, and a dotted domain
 * with no spaces. Mirrors the server's invite-email rule closely enough for
 * instant client feedback — the server remains the authority, so this is a
 * format gate, not the final word.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Longest email the server accepts (mirrors the server's column limit). */
const MAX_LENGTH = 320;

/**
 * A member's email address — a client-side value object mirroring the server's
 * invite-email rule. It exists so the invite form's email field and its submit
 * guard validate one rule rather than each re-testing an inline `z.email()` /
 * regex literal. Format only — whether the address is already taken is a server
 * concern surfaced as a `409` on submit.
 */
export class Email {
    private constructor(private readonly email: string) {}

    /**
     * Whether `value` is a well-shaped email, without throwing — the check the
     * invite form's field uses for instant, per-keystroke feedback.
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
     * value. Used by the invite use-case as a last guard before the request.
     */
    static create(value: string): Email {
        if (!Email.isValid(value)) {
            throw new Error(`Invalid member email: "${value}"`);
        }
        return new Email(value);
    }

    /** The underlying email string. */
    get value(): string {
        return this.email;
    }
}

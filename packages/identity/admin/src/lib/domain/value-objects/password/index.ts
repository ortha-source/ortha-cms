/**
 * Shortest password the server accepts when a credential is first set. Mirrors
 * identity-server's `MIN_PASSWORD_LENGTH` — the admin can't import the server
 * package, so the rule is restated here for instant feedback and the server
 * stays the authority.
 */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Longest password the server accepts. bcrypt truncates its input at 72 bytes,
 * so anything beyond that would be silently ignored; the server rejects rather
 * than truncates, and so do we.
 */
export const PASSWORD_MAX_LENGTH = 72;

/**
 * A new account password — a client-side value object mirroring the server's
 * length rule, so the accept-invite form validates one rule instead of scattering
 * inline literals across its schema. Length only: composition rules ("one digit,
 * one symbol") push people toward predictable substitutions and are not what
 * resists cracking.
 */
export class Password {
    private constructor(private readonly password: string) {}

    /**
     * Whether `value` is long enough (and not too long) to be accepted, without
     * throwing — the check the password field uses per keystroke.
     */
    static isValid(value: string): boolean {
        return (
            value.length >= PASSWORD_MIN_LENGTH &&
            value.length <= PASSWORD_MAX_LENGTH
        );
    }

    /** Builds a {@link Password}, throwing when it fails the length rule. */
    static create(value: string): Password {
        if (!Password.isValid(value)) {
            throw new Error('Password does not meet the length requirement');
        }
        return new Password(value);
    }

    /** The underlying password string. */
    get value(): string {
        return this.password;
    }
}

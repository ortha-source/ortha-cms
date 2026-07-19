import { InvalidEmailError } from '../errors';

/**
 * A pragmatic email shape: a non-empty local part, an `@`, and a dotted domain.
 * Deliberately lenient — the authoritative check is delivery, not a regex.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A login email address. A value object stored **lower-cased** so equality and
 * the DB's case-insensitive unique index agree. Validates on construction,
 * rejecting a malformed address with {@link InvalidEmailError}.
 */
export class Email {
    private constructor(private readonly address: string) {}

    /**
     * Builds an {@link Email} from a raw string — trimmed and lower-cased —
     * rejecting a malformed address with {@link InvalidEmailError}.
     */
    static create(value: string): Email {
        const normalized = value.trim().toLowerCase();
        if (!EMAIL_RE.test(normalized)) {
            throw new InvalidEmailError(value);
        }
        return new Email(normalized);
    }

    /** The normalized (lower-cased) address. */
    get value(): string {
        return this.address;
    }

    /** Structural equality on the normalized address. */
    equals(other: Email): boolean {
        return this.address === other.address;
    }
}

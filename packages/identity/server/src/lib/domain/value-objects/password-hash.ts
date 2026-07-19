import { InvalidPasswordHashError } from '../errors';

/**
 * A stored password hash — the bcrypt digest, never the plaintext. A value
 * object that guards the aggregate against an empty/blank credential; the
 * hashing itself is an infrastructure concern (`HashingService`), so this only
 * validates and carries the resulting string.
 *
 * Deliberately lenient on format (a bcrypt string, but the cost/prefix is not
 * asserted here) — the authoritative check is whether it verifies at login.
 */
export class PasswordHash {
    private constructor(private readonly hash: string) {}

    /**
     * Wraps a computed hash, rejecting an empty/blank value with
     * {@link InvalidPasswordHashError}.
     */
    static create(value: string): PasswordHash {
        if (value.trim().length === 0) {
            throw new InvalidPasswordHashError();
        }
        return new PasswordHash(value);
    }

    /** The underlying hash string, as stored. */
    get value(): string {
        return this.hash;
    }

    /** Structural equality on the underlying hash. */
    equals(other: PasswordHash): boolean {
        return this.hash === other.hash;
    }
}

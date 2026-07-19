import { randomUUID } from 'node:crypto';
import { InvalidUserIdError } from '../errors';

/** RFC 4122 UUID shape — the id format identity's `users` table stores. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A user account's identity, as a validated UUID. A value object: two ids are
 * equal iff their string values match. Framework-free — constructed from a raw
 * string at the application boundary and passed into the domain.
 */
export class UserId {
    private constructor(private readonly id: string) {}

    /**
     * Builds a {@link UserId} from a raw string, rejecting anything that isn't a
     * UUID with {@link InvalidUserIdError}.
     */
    static create(value: string): UserId {
        if (!UUID_RE.test(value)) {
            throw new InvalidUserIdError(value);
        }
        return new UserId(value);
    }

    /** Mints a fresh id for a brand-new account. */
    static generate(): UserId {
        return new UserId(randomUUID());
    }

    /** The underlying UUID string. */
    get value(): string {
        return this.id;
    }

    /** Structural equality on the underlying value. */
    equals(other: UserId): boolean {
        return this.id === other.id;
    }
}

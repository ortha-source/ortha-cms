import { randomUUID } from 'node:crypto';
import { InvalidMemberIdError } from '../errors';

/** RFC 4122 UUID shape — the member id format identity's `users` table stores. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A member's identity, as a validated UUID. A value object: two ids are equal
 * iff their string values match. Framework-free — constructed from a raw string
 * at the application boundary and passed into the domain.
 */
export class MemberId {
    private constructor(private readonly id: string) {}

    /**
     * Builds a {@link MemberId} from a raw string, rejecting anything that isn't
     * a UUID with {@link InvalidMemberIdError}.
     */
    static create(value: string): MemberId {
        if (!UUID_RE.test(value)) {
            throw new InvalidMemberIdError(value);
        }
        return new MemberId(value);
    }

    /**
     * Mints a fresh id for a brand-new member. The aggregate owns its identity,
     * so it is assigned here on invite rather than read back from a database
     * default — letting the `member.invited` event carry the id.
     */
    static generate(): MemberId {
        return new MemberId(randomUUID());
    }

    /** The underlying UUID string. */
    get value(): string {
        return this.id;
    }

    /** Structural equality on the underlying value. */
    equals(other: MemberId): boolean {
        return this.id === other.id;
    }
}

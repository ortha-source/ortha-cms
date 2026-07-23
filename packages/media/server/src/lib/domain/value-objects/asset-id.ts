import { randomUUID } from 'node:crypto';
import { InvalidMediaIdError } from '../errors/invalid-media-id.error';

/** RFC 4122 UUID shape — the id format the media schema stores. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A media asset's identity, as a validated UUID. A value object: two ids are
 * equal iff their string values match. Framework-free.
 */
export class AssetId {
    private constructor(private readonly id: string) {}

    /** Builds an {@link AssetId} from a raw string, rejecting non-UUIDs. */
    static create(value: string): AssetId {
        if (!UUID_RE.test(value)) {
            throw new InvalidMediaIdError('asset', value);
        }
        return new AssetId(value);
    }

    /** Mints a fresh id for a brand-new asset (the aggregate owns its id). */
    static generate(): AssetId {
        return new AssetId(randomUUID());
    }

    /** The underlying UUID string. */
    get value(): string {
        return this.id;
    }

    /** Structural equality on the underlying value. */
    equals(other: AssetId): boolean {
        return this.id === other.id;
    }
}

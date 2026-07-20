import { randomUUID } from 'node:crypto';
import { InvalidMediaIdError } from '../errors/invalid-media-id.error';

/** RFC 4122 UUID shape — the id format the media schema stores. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A media folder's identity, as a validated UUID value object. A `null`
 * folder in the application layer means the workspace root (there is no root
 * row), so this type only ever wraps a real folder id.
 */
export class FolderId {
    private constructor(private readonly id: string) {}

    /** Builds a {@link FolderId} from a raw string, rejecting non-UUIDs. */
    static create(value: string): FolderId {
        if (!UUID_RE.test(value)) {
            throw new InvalidMediaIdError('folder', value);
        }
        return new FolderId(value);
    }

    /** Mints a fresh id for a brand-new folder. */
    static generate(): FolderId {
        return new FolderId(randomUUID());
    }

    /** The underlying UUID string. */
    get value(): string {
        return this.id;
    }

    /** Structural equality on the underlying value. */
    equals(other: FolderId): boolean {
        return this.id === other.id;
    }
}

import { randomUUID } from 'node:crypto';
import { InvalidWorkspaceIdError } from '../errors';

/** RFC 4122 UUID shape — the workspace id format the schema stores. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A workspace's identity, as a validated UUID. A value object: two ids are
 * equal iff their string values match. Framework-free — constructed from a
 * raw string at the application boundary and passed into the domain.
 */
export class WorkspaceId {
    private constructor(private readonly id: string) {}

    /**
     * Builds a {@link WorkspaceId} from a raw string, rejecting anything that
     * isn't a UUID with {@link InvalidWorkspaceIdError}.
     */
    static create(value: string): WorkspaceId {
        if (!UUID_RE.test(value)) {
            throw new InvalidWorkspaceIdError(value);
        }
        return new WorkspaceId(value);
    }

    /**
     * Mints a fresh id for a brand-new workspace. The aggregate owns its
     * identity, so it is assigned here at creation rather than read back from a
     * database default — letting the `workspace.created` event carry the id.
     */
    static generate(): WorkspaceId {
        return new WorkspaceId(randomUUID());
    }

    /** The underlying UUID string. */
    get value(): string {
        return this.id;
    }

    /** Structural equality on the underlying value. */
    equals(other: WorkspaceId): boolean {
        return this.id === other.id;
    }
}

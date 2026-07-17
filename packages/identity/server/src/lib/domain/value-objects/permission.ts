import { InvalidPermissionError } from '../errors';

/**
 * A `resource:action` permission key — lower-case `resource`, a colon, and a
 * lower-case `action` (e.g. `workspaces:create`). The catalogue of valid keys
 * lives in `rbac/system-roles.ts`; this only asserts the shape.
 */
const PERMISSION_RE = /^[a-z]+:[a-z_]+$/;

/**
 * A single permission, wrapping its `resource:action` key. A value object:
 * two permissions are equal iff their keys match. Validates the shape on
 * construction ({@link InvalidPermissionError}) so a malformed grant can never
 * flow into an access decision.
 *
 * Framework-free — the RBAC guard/service build these from the seeded
 * catalogue and hand them to {@link AccessPolicy}.
 */
export class Permission {
    private constructor(private readonly key: string) {}

    /**
     * Builds a {@link Permission} from a raw key, rejecting a malformed one with
     * {@link InvalidPermissionError}.
     */
    static create(value: string): Permission {
        if (!PERMISSION_RE.test(value)) {
            throw new InvalidPermissionError(value);
        }
        return new Permission(value);
    }

    /** The underlying `resource:action` key. */
    get value(): string {
        return this.key;
    }

    /** Structural equality on the underlying key. */
    equals(other: Permission): boolean {
        return this.key === other.key;
    }
}

import { InvalidRoleError } from '../errors';

/**
 * Role keys an admin may assign through the users API — the three seeded
 * system roles. Kept as a plain tuple (not derived from `SYSTEM_ROLES`) so
 * `class-validator`'s `@IsIn` gets a readonly string array and the API
 * contract is explicit at a glance.
 */
export const ASSIGNABLE_ROLE_KEYS = ['admin', 'contributor', 'viewer'] as const;

/** A role key assignable via the users API. */
export type AssignableRoleKey = (typeof ASSIGNABLE_ROLE_KEYS)[number];

/** The privileged role key the last-admin invariant protects. */
export const ADMIN_ROLE_KEY = 'admin';

/**
 * The single global role a member holds. A value object identified by its
 * stable machine key; the aggregate only needs the key to decide the
 * last-admin invariant ({@link isAdmin}). The role's surrogate id and label are
 * persistence/view concerns resolved outside the domain.
 *
 * `create` accepts any non-empty key (a loaded member may hold a custom,
 * non-system role); the *assignable* subset is validated at the DTO boundary.
 */
export class Role {
    private constructor(private readonly key: string) {}

    /**
     * Builds a {@link Role} from a role key, rejecting an empty one with
     * {@link InvalidRoleError}.
     */
    static create(value: string): Role {
        if (value.length === 0) {
            throw new InvalidRoleError(value);
        }
        return new Role(value);
    }

    /** The underlying role key. */
    get value(): string {
        return this.key;
    }

    /** Whether this is the privileged `admin` role. */
    get isAdmin(): boolean {
        return this.key === ADMIN_ROLE_KEY;
    }

    /** Structural equality on the underlying key. */
    equals(other: Role): boolean {
        return this.key === other.key;
    }
}

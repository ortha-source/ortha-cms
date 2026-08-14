import type { Permission } from './value-objects/permission';

/**
 * An optional authorization scope — a placeholder for future workspace/resource
 * scoping. v1 RBAC is global (a role's grants apply everywhere), so the scope is
 * accepted but not yet consulted; declaring it keeps {@link AccessPolicy.can}'s
 * signature stable when scoped permissions land.
 */
export interface PermissionScope {
    /** The workspace the decision is scoped to, when applicable. */
    workspaceId?: string;
}

/**
 * The actor an access decision is made for: the acting user's id and the set of
 * permission keys their role grants. A plain, framework-free view — the RBAC
 * service resolves the grants from the DB and hands them here.
 */
export interface Actor {
    /** The acting user's id. */
    userId: string;
    /** The `resource:action` keys the actor's role grants. */
    grantedPermissions: ReadonlySet<string>;
}

/**
 * The pure RBAC decision — the single place that answers "may this actor do
 * this?". A **domain service**: framework-free and DB-free, so it is exhaustively
 * unit-testable without standing up Nest or Postgres.
 *
 * `PermissionsGuard` and `PermissionsService` resolve an actor's grants and
 * delegate the decision here; callers' public API is unchanged (this is an
 * internal collaborator, not a new surface).
 */
export class AccessPolicy {
    /**
     * Whether `actor` holds `permission`. v1 is a global membership test — the
     * `scope` is reserved for future per-workspace grants and does not yet
     * narrow the decision.
     */
    can(
        actor: Actor,
        permission: Permission,
        scope?: PermissionScope
    ): boolean {
        // `scope` is reserved for future per-workspace grants; v1 RBAC is
        // global, so a present scope does not narrow the decision yet. It is
        // referenced here only to keep the parameter live.
        void scope;
        return actor.grantedPermissions.has(permission.value);
    }

    /**
     * Whether `actor` holds **every** permission in `required` (an empty
     * requirement is vacuously allowed). The all-of semantics the
     * `@RequirePermissions(...)` guard enforces.
     */
    canAll(
        actor: Actor,
        required: readonly Permission[],
        scope?: PermissionScope
    ): boolean {
        return required.every((permission) =>
            this.can(actor, permission, scope)
        );
    }

    /**
     * Whether `actor` holds **at least one** permission in `allowed` (an empty
     * requirement is vacuously allowed, matching {@link canAll}). The any-of
     * semantics the `@RequireAnyPermission(...)` guard enforces.
     *
     * Needed for a route that legitimately serves two audiences — the
     * content-type catalogue is read both by the create wizard
     * (`workspaces:create`) and by the settings content tab
     * (`workspaces:update`), so requiring either one alone would lock out a
     * role that holds only the other.
     */
    canAny(
        actor: Actor,
        allowed: readonly Permission[],
        scope?: PermissionScope
    ): boolean {
        if (allowed.length === 0) return true;
        return allowed.some((permission) => this.can(actor, permission, scope));
    }
}

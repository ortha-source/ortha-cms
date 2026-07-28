import { PERMISSIONS, type PermissionKey } from '../../rbac/system-roles';

/** The two access levels a bearer API token can grant. */
export const API_TOKEN_SCOPES = ['read', 'full'] as const;

/** Access level a bearer API token grants to the external content API. */
export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

/**
 * The content permissions a token's scope grants. `read` is read-only;
 * `full` is the complete content CRUD set. The bearer guard turns this into an
 * {@link Actor}'s `grantedPermissions` and delegates the decision to the same
 * {@link AccessPolicy} the session `PermissionsGuard` uses — so a route's
 * `@RequirePermissions(...)` is enforced identically whether the caller is a
 * logged-in user or a token.
 *
 * Framework-free on purpose (no Nest/Drizzle), so the mapping is exhaustively
 * unit-testable and the single source of truth for "what may this scope do?".
 */
export function scopePermissions(scope: ApiTokenScope): PermissionKey[] {
    switch (scope) {
        case 'read':
            return [PERMISSIONS.CONTENT_READ];
        case 'full':
            return [
                PERMISSIONS.CONTENT_READ,
                PERMISSIONS.CONTENT_CREATE,
                PERMISSIONS.CONTENT_UPDATE,
                PERMISSIONS.CONTENT_PUBLISH,
                PERMISSIONS.CONTENT_DELETE
            ];
    }
}

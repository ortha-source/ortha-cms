/**
 * The complete v1 permission catalogue, keyed by a symbolic name so call sites
 * reference `PERMISSIONS.WORKSPACES_CREATE` instead of repeating the string
 * literal. Seeded into the `permissions` table; the guard
 * (`@RequirePermissions(...)`), the role matrix below, and the seed tests all
 * read from here, so the permission set has exactly one source of truth.
 */
export const PERMISSIONS = {
    WORKSPACES_CREATE: 'workspaces:create',
    WORKSPACES_READ: 'workspaces:read',
    WORKSPACES_UPDATE: 'workspaces:update',
    WORKSPACES_DELETE: 'workspaces:delete',
    USERS_READ: 'users:read',
    USERS_CREATE: 'users:create',
    USERS_UPDATE: 'users:update',
    USERS_DELETE: 'users:delete',
    ACTIVITY_READ: 'activity:read'
} as const;

/** A `resource:action` permission key drawn from {@link PERMISSIONS}. */
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Every permission key — the catalogue seeded into the `permissions` table. */
export const PERMISSION_KEYS = Object.values(PERMISSIONS) as PermissionKey[];

/** A built-in role and the permission keys it is granted. */
export interface SystemRole {
    /** Stable machine key written to `roles.key`. */
    key: string;
    /** Human-readable label written to `roles.name`. */
    name: string;
    /** Granted permission keys; each must exist in {@link PERMISSIONS}. */
    permissions: readonly PermissionKey[];
}

/**
 * The three built-in roles and their grants — the §4.2 matrix verbatim.
 * Admin holds the full enumerated set (no wildcard, by decision): a future
 * permission must be added both to {@link PERMISSIONS} and to admin's grants
 * here. Viewer is identical to contributor in v1 by design.
 */
export const SYSTEM_ROLES: readonly SystemRole[] = [
    { key: 'admin', name: 'Administrator', permissions: [...PERMISSION_KEYS] },
    {
        key: 'contributor',
        name: 'Contributor',
        permissions: [PERMISSIONS.WORKSPACES_READ, PERMISSIONS.USERS_READ]
    },
    {
        key: 'viewer',
        name: 'Viewer',
        permissions: [PERMISSIONS.WORKSPACES_READ, PERMISSIONS.USERS_READ]
    }
] as const;

/**
 * The complete v1 permission catalogue — exactly two resources. Seeded
 * into the `permissions` table so every role grant references a real row.
 * `can()` (next ticket) and the seed tests both read from here, so the
 * permission set has exactly one source of truth.
 */
export const PERMISSION_KEYS = [
    'workspaces:create',
    'workspaces:read',
    'workspaces:update',
    'workspaces:delete',
    'users:read',
    'users:create',
    'users:update',
    'users:delete'
] as const;

/** A `resource:action` permission key drawn from {@link PERMISSION_KEYS}. */
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** A built-in role and the permission keys it is granted. */
export interface SystemRole {
    /** Stable machine key written to `roles.key`. */
    key: string;
    /** Human-readable label written to `roles.name`. */
    name: string;
    /** Granted permission keys; each must exist in {@link PERMISSION_KEYS}. */
    permissions: readonly PermissionKey[];
}

/**
 * The three built-in roles and their grants — the §4.2 matrix verbatim.
 * Admin holds the full enumerated set (no wildcard, by decision): a future
 * permission must be added both to {@link PERMISSION_KEYS} and to admin's
 * grants here. Viewer is identical to contributor in v1 by design.
 */
export const SYSTEM_ROLES: readonly SystemRole[] = [
    { key: 'admin', name: 'Administrator', permissions: [...PERMISSION_KEYS] },
    {
        key: 'contributor',
        name: 'Contributor',
        permissions: ['workspaces:read', 'users:read']
    },
    {
        key: 'viewer',
        name: 'Viewer',
        permissions: ['workspaces:read', 'users:read']
    }
] as const;

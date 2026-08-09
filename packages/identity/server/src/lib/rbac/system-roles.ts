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
    ACTIVITY_READ: 'activity:read',
    CONTENT_READ: 'content:read',
    CONTENT_CREATE: 'content:create',
    CONTENT_UPDATE: 'content:update',
    CONTENT_PUBLISH: 'content:publish',
    CONTENT_DELETE: 'content:delete',
    MEDIA_READ: 'media:read',
    MEDIA_CREATE: 'media:create',
    MEDIA_UPDATE: 'media:update',
    MEDIA_DELETE: 'media:delete',
    TOKENS_READ: 'tokens:read',
    TOKENS_CREATE: 'tokens:create',
    TOKENS_DELETE: 'tokens:delete',
    COPILOT_USE: 'copilot:use'
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
 * here.
 *
 * `copilot:use` is granted to **every** role, viewer included
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §10):
 * the copilot has no authority of its own, so a viewer's copilot is
 * *provably* read-only — it can only ever offer the tools that viewer's own
 * permissions already allow. Cost is handled with per-role rate limits rather
 * than by excluding the largest population from the feature.
 * `copilot:configure` stays admin-only: registering a model or a connector
 * decides where workspace content travels.
 */
export const SYSTEM_ROLES: readonly SystemRole[] = [
    { key: 'admin', name: 'Administrator', permissions: [...PERMISSION_KEYS] },
    {
        key: 'contributor',
        name: 'Contributor',
        permissions: [
            PERMISSIONS.WORKSPACES_READ,
            PERMISSIONS.USERS_READ,
            PERMISSIONS.CONTENT_READ,
            PERMISSIONS.CONTENT_CREATE,
            PERMISSIONS.CONTENT_UPDATE,
            PERMISSIONS.CONTENT_PUBLISH,
            PERMISSIONS.MEDIA_READ,
            PERMISSIONS.MEDIA_CREATE,
            PERMISSIONS.MEDIA_UPDATE,
            PERMISSIONS.COPILOT_USE
        ]
    },
    {
        key: 'viewer',
        name: 'Viewer',
        permissions: [
            PERMISSIONS.WORKSPACES_READ,
            PERMISSIONS.USERS_READ,
            PERMISSIONS.CONTENT_READ,
            PERMISSIONS.MEDIA_READ,
            PERMISSIONS.COPILOT_USE
        ]
    }
] as const;

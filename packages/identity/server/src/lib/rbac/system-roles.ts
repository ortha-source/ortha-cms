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
    CONTENT_EXPORT: 'content:export',
    CONTENT_IMPORT: 'content:import',
    MEDIA_READ: 'media:read',
    MEDIA_CREATE: 'media:create',
    MEDIA_UPDATE: 'media:update',
    MEDIA_DELETE: 'media:delete',
    TOKENS_READ: 'tokens:read',
    TOKENS_CREATE: 'tokens:create',
    TOKENS_DELETE: 'tokens:delete',
    COPILOT_USE: 'copilot:use',
    COPILOT_SKILLS_MANAGE: 'copilot:skills:manage',
    VIEWS_SHARE: 'views:share'
} as const;

/**
 * A `resource:action` permission key drawn from {@link PERMISSIONS} — with an
 * optional sub-resource segment (`copilot:skills:manage`). Every key must pass
 * `Permission.create`'s shape check, or the guard 500s on the route requiring
 * it.
 */
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
 *
 * There is **no** `copilot:configure`:
 * [ADR-0009](../../../../../../docs/adr/0009-copilot-applies-directly.md)
 * deleted the per-workspace policy it gated, and the key with it. It is worth
 * naming here because the key outlived its deletion in every existing database
 * — `seedSystemRoles` used to be additive-only, so the `permissions` row and
 * its grant to `admin` persisted and `/auth/me` kept returning 24 keys against
 * the 23 defined above. The seeder now reconciles in both directions, so
 * removing a key from this file removes the grant.
 *
 * `content:export` and `content:import` are separate keys rather than folded
 * into read and create, because they are separate capabilities. Reading the
 * library a page at a time and taking it out of the system in one file — media
 * bytes included — are not the same act, and the second is the one an operator
 * wants to be able to withhold and to audit. So **viewer does not get export**
 * even though a viewer can already read every record: the difference is bulk
 * egress, not access. Import is granted alongside it for contributors, but the
 * use-case additionally requires the ordinary `content:create` /
 * `content:update` for each write it performs, so importing can never do more
 * than the caller could have done by hand.
 *
 * `views:share` gates only **sharing** a saved list view with the workspace,
 * not saving one. Every role can save private views — that is a personal
 * bookmark over content they can already read — but a shared view becomes a
 * navigation item for the whole workspace, which is an editorial decision.
 * Contributors hold it; viewers do not, and are not blocked from anything by
 * its absence.
 *
 * `copilot:skills:manage` is **admin-only** for the same class of reason
 * ([ADR-0010](../../../../../../docs/adr/0010-copilot-skills.md)): a skill's
 * instructions are prompt text that runs for every member of the workspace, so
 * authoring one is a configuration decision rather than a content one. Using a
 * skill needs nothing beyond `copilot:use`, which every role holds.
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
            PERMISSIONS.CONTENT_EXPORT,
            PERMISSIONS.CONTENT_IMPORT,
            PERMISSIONS.MEDIA_READ,
            PERMISSIONS.MEDIA_CREATE,
            PERMISSIONS.MEDIA_UPDATE,
            PERMISSIONS.COPILOT_USE,
            PERMISSIONS.VIEWS_SHARE
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

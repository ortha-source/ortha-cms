import type { Actor } from '../../domain/access-policy';
import { PERMISSIONS, type PermissionKey } from '../../rbac/system-roles';

/** The two access levels a bearer API token can grant. */
export const API_TOKEN_SCOPES = ['read', 'full'] as const;

/** Access level a bearer API token grants to the external content API. */
export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

/**
 * The permissions a token's scope grants. `read` is read-only; `full` is the
 * complete content CRUD set **plus the media rights that set depends on**. The
 * bearer guard turns this into an {@link Actor}'s `grantedPermissions` and
 * delegates the decision to the same {@link AccessPolicy} the session
 * `PermissionsGuard` uses — so a route's `@RequirePermissions(...)` is enforced
 * identically whether the caller is a logged-in user or a token.
 *
 * **Why both scopes carry `media:read`.** The public content reads already hand
 * a media field's assets back as metadata plus a URL. Withholding the bytes from
 * the very token that just received the URL makes the metadata useless — a
 * read-only consumer is precisely the one that wants to display the image. So
 * reading an asset is part of reading content.
 *
 * **Why only `full` carries `media:create`.** A content type's `field.media`
 * stores asset ids, and the writer rejects an id the workspace doesn't own — so a
 * token that can create content but cannot create an asset can never populate a
 * media field at all. Upload is therefore part of "write content".
 * `media:update` and `media:delete` stay withheld from both: attaching an asset
 * to a record is content authoring, but renaming or deleting somebody else's
 * library asset is media administration, and nothing on the public API needs it.
 *
 * **Why both scopes carry `segments:read`.** Reader entitlements decide which
 * published entries a request sees at all, so a token that cannot ask whether an
 * entry is restricted is a client that silently reports a partial list as the
 * whole one. It grants nothing new about the content itself: an entry a `read`
 * token can already fetch is the only one whose access it can look up.
 *
 * **Why only `full` carries `segments:manage`.** Setting who may read a record
 * is an entry-level editorial decision of the same weight as publishing or
 * deleting it, both of which `full` already grants. What it does **not** open is
 * the audience *vocabulary*: creating, renaming or deleting a segment changes
 * visibility across every entry naming it, installation-wide, and no
 * token-authenticated surface exposes it — the directory routes are
 * session-guarded and the tool catalogue offers entry access only. A future tool
 * over the directory is therefore a deliberate decision, not something this
 * mapping already made.
 *
 * Framework-free on purpose (no Nest/Drizzle), so the mapping is exhaustively
 * unit-testable and the single source of truth for "what may this scope do?".
 */
export function scopePermissions(scope: ApiTokenScope): PermissionKey[] {
    switch (scope) {
        case 'read':
            return [
                PERMISSIONS.CONTENT_READ,
                PERMISSIONS.MEDIA_READ,
                PERMISSIONS.SEGMENTS_READ
            ];
        case 'full':
            return [
                PERMISSIONS.CONTENT_READ,
                PERMISSIONS.CONTENT_CREATE,
                PERMISSIONS.CONTENT_UPDATE,
                PERMISSIONS.CONTENT_PUBLISH,
                PERMISSIONS.CONTENT_DELETE,
                PERMISSIONS.MEDIA_READ,
                PERMISSIONS.MEDIA_CREATE,
                PERMISSIONS.SEGMENTS_READ,
                PERMISSIONS.SEGMENTS_MANAGE
            ];
    }
}

/** The minimum of a verified token an access decision needs. */
export interface ScopedToken {
    /** Stable token id — the actor identity a decision is made for. */
    id: string;
    /** The token's access level. */
    scope: ApiTokenScope;
}

/**
 * A verified token as an {@link Actor}, so a permission check on a token goes
 * through the **same** {@link AccessPolicy} a session's does.
 *
 * The token's own id is the actor identity, and the `createdBy` user's role
 * grants are deliberately never consulted: revoking a token must be enough to
 * revoke its access, whoever minted it and whatever they may still do.
 *
 * One function rather than four inline lines at each call site, because there
 * are now several — the bearer guard on the REST routes, and every field
 * resolver on the GraphQL endpoint, where a single request mixes operations and
 * a route-level `@RequirePermissions` cannot decide for all of them.
 */
export function tokenActor(token: ScopedToken): Actor {
    return {
        userId: token.id,
        grantedPermissions: new Set(scopePermissions(token.scope))
    };
}

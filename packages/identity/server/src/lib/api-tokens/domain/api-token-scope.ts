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
 * Framework-free on purpose (no Nest/Drizzle), so the mapping is exhaustively
 * unit-testable and the single source of truth for "what may this scope do?".
 */
export function scopePermissions(scope: ApiTokenScope): PermissionKey[] {
    switch (scope) {
        case 'read':
            return [PERMISSIONS.CONTENT_READ, PERMISSIONS.MEDIA_READ];
        case 'full':
            return [
                PERMISSIONS.CONTENT_READ,
                PERMISSIONS.CONTENT_CREATE,
                PERMISSIONS.CONTENT_UPDATE,
                PERMISSIONS.CONTENT_PUBLISH,
                PERMISSIONS.CONTENT_DELETE,
                PERMISSIONS.MEDIA_READ,
                PERMISSIONS.MEDIA_CREATE
            ];
    }
}

import { useHasPermission } from '@orthacms/identity-admin';
import type {
    BuilderCapabilities,
    ReadOnlyReason
} from '@orthacms/schema-builder-domain';

/** Why the page is read-only for this person on this server, when it is. */
export type AccessReason = 'no-permission' | ReadOnlyReason;

/** The permission and the server's capabilities, folded into one answer. */
export type BuilderAccess = {
    readonly canEdit: boolean;
    readonly canManage: boolean;
    readonly reason?: AccessReason;
};

/**
 * The server decides first — a production server is read-only for everyone,
 * and saying "ask for a permission" there would send someone the wrong way.
 * Then `schema:manage`.
 */
export function useBuilderAccess(
    capabilities: BuilderCapabilities
): BuilderAccess {
    const canManage = useHasPermission('schema:manage');
    if (!capabilities.editable)
        return {
            canEdit: false,
            canManage,
            reason: capabilities.reason ?? 'disabled'
        };
    if (!canManage)
        return { canEdit: false, canManage, reason: 'no-permission' };
    return { canEdit: true, canManage };
}

import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../system-roles';

/** Metadata key under which {@link RequirePermissions} stores its keys. */
export const PERMISSIONS_KEY = 'ortha:required-permissions';

/**
 * Marks a route (or controller) as requiring every listed permission. The
 * app-wide `AuthGuard` authenticates; `PermissionsGuard` reads this metadata and
 * checks the current user's role grants. With no decorator, no permission is
 * required (authentication still is).
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);

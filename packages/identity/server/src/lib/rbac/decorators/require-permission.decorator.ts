import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../system-roles';

/**
 * Reflector key carrying the permissions a route demands. Internal to the
 * rbac feature; set it via {@link RequirePermission}.
 */
export const REQUIRED_PERMISSIONS_KEY = 'identity:requiredPermissions';

/**
 * Declares the permission(s) a route or controller requires. Enforced by
 * {@link PermissionsGuard}, which must be applied alongside it:
 *
 * ```typescript
 * @UseGuards(PermissionsGuard)
 * @RequirePermission('users:read')
 * @Controller('users')
 * export class ListUsersController { … }
 * ```
 *
 * Multiple keys mean the caller needs **all** of them.
 */
export const RequirePermission = (...keys: PermissionKey[]) =>
    SetMetadata(REQUIRED_PERMISSIONS_KEY, keys);

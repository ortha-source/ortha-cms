export type {
    IdentityPluginConfig,
    IdentitySessionConfig,
    IdentityTokenConfig,
    IdentityRateLimitConfig,
    IdentityRootAdminConfig
} from './lib/types';
export { IdentityPlugin } from './lib/utils/identity-plugin';
export type { IdentityServerPlugin } from './lib/utils/identity-plugin';
export { IdentityModule } from './lib/identity.module';
export { AuthGuard } from './lib/auth/guards/auth.guard';
export { Public } from './lib/auth/decorators/public.decorator';
export { CurrentUser } from './lib/auth/decorators/current-user.decorator';
export type { AuthenticatedRequest } from './lib/auth/decorators/current-user.decorator';
export type { PublicUser } from './lib/auth/services/auth.service';
export {
    PERMISSIONS,
    PERMISSION_KEYS,
    SYSTEM_ROLES
} from './lib/rbac/system-roles';
export type { PermissionKey, SystemRole } from './lib/rbac/system-roles';
export { seedSystemRoles } from './lib/rbac/seeders/seed-system-roles';
export { RolesService } from './lib/rbac/services/roles.service';
export { PermissionsService } from './lib/rbac/services/permissions.service';
export { PermissionsGuard } from './lib/rbac/guards/permissions.guard';
export { RequirePermissions } from './lib/rbac/decorators/require-permissions.decorator';
export { RoleNotFoundError, SystemRoleProtectedError } from './lib/rbac/errors';
export { RootAdminService } from './lib/root-admin/services/root-admin.service';
export type {
    RootAdminOutcome,
    RootAdminBootstrapResult
} from './lib/root-admin/services/root-admin.service';
export { MissingRootAdminPasswordError } from './lib/root-admin/errors';
export * from './lib/schema';

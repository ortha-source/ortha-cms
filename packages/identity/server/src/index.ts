export type {
    IdentityPluginConfig,
    IdentitySessionConfig,
    IdentityTokenConfig,
    IdentityRateLimitConfig
} from './lib/types';
export { IdentityPlugin } from './lib/utils/identity-plugin';
export type { IdentityServerPlugin } from './lib/utils/identity-plugin';
export { IdentityModule } from './lib/identity.module';
export { PERMISSION_KEYS, SYSTEM_ROLES } from './lib/rbac/system-roles';
export type { PermissionKey, SystemRole } from './lib/rbac/system-roles';
export { seedSystemRoles } from './lib/rbac/seed-system-roles';
export { RolesService } from './lib/rbac/roles.service';
export { RoleNotFoundError, SystemRoleProtectedError } from './lib/rbac/errors';
export * from './lib/schema';

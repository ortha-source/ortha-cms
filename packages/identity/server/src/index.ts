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
// The identity config token, exported so the users plugin's invite issuer can
// read the host-configured invite TTL instead of hard-coding one.
export { IDENTITY_CONFIG, InjectIdentityConfig } from './lib/identity.tokens';
export {
    MIN_PASSWORD_LENGTH,
    MAX_PASSWORD_LENGTH
} from './lib/auth/auth.constants';
export { AuthGuard } from './lib/auth/guards/auth.guard';
export { OriginGuard } from './lib/auth/guards/origin.guard';
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
export { ACTIVITY_RECORDER } from './lib/activity/activity-recorder';
export type {
    ActivityRecorder,
    ActivityRecordInput,
    ActivityExecutor
} from './lib/activity/activity-recorder';
export {
    IDENTITY_ACTIVITY_KINDS
} from './lib/activity/activity-kinds';
export type { IdentityActivityKind } from './lib/activity/activity-kinds';
export * from './lib/schema';
// External-API bearer tokens. The service mints, lists, and revokes them; the
// scope helper is the contract for turning a token's scope into a permission
// set. The guard that authenticates `Authorization: Bearer` on the public
// content API ships with that API.
export { ApiTokenService } from './lib/api-tokens/application/api-token.service';
export type {
    ApiTokenView,
    MintApiTokenInput,
    MintedApiToken
} from './lib/api-tokens/application/api-token.service';
export {
    API_TOKEN_SCOPES,
    scopePermissions
} from './lib/api-tokens/domain/api-token-scope';
export type { ApiTokenScope } from './lib/api-tokens/domain/api-token-scope';

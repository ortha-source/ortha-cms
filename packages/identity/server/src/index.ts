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
export {
    ACTIVITY_RECORDER
} from './lib/activity/activity-recorder';
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
// External-API bearer tokens. The guard + service back the public content API
// in `@ortha-cms/content-server`; the scope helper and principal are its
// contract for turning a token into a workspace + permission set.
export { ApiTokenGuard } from './lib/api-tokens/http/guards/api-token.guard';
export {
    CurrentApiToken
} from './lib/api-tokens/http/decorators/current-api-token.decorator';
export type {
    ApiTokenPrincipal,
    ApiTokenRequest
} from './lib/api-tokens/http/decorators/current-api-token.decorator';
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

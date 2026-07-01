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
export { WorkspaceGuard } from './lib/workspaces/guards/workspace.guard';
export { CurrentWorkspace } from './lib/workspaces/decorators/current-workspace.decorator';
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
export { CONTENT_CATALOG } from './lib/content/content-catalog';
export type { ContentCatalog } from './lib/content/content-catalog';
export { CONTENT_ENTRY_COUNTER } from './lib/content/content-entry-counter';
export type { ContentEntryCounter } from './lib/content/content-entry-counter';
export type { ContentTypeDescriptor } from './lib/content/content.constants';
export * from './lib/schema';

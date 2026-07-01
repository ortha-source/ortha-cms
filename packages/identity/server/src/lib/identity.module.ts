import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { IdentityPluginConfig, IdentityRateLimitConfig } from './types';
import { IDENTITY_CONFIG } from './identity.tokens';
import { RolesService } from './rbac/services/roles.service';
import { PermissionsService } from './rbac/services/permissions.service';
import { PermissionsGuard } from './rbac/guards/permissions.guard';
import { SystemRolesSeeder } from './rbac/seeders/system-roles.seeder';
import { RootAdminService } from './root-admin/services/root-admin.service';
import { RootAdminSeeder } from './root-admin/seeders/root-admin.seeder';
import { LoginController } from './auth/controllers/login.controller';
import { MeController } from './auth/controllers/me.controller';
import { LogoutController } from './auth/controllers/logout.controller';
import { UserSessionsController } from './auth/controllers/user-sessions.controller';
import { AuthService } from './auth/services/auth.service';
import { SessionService } from './auth/services/session.service';
import { HashingService } from './auth/services/hashing.service';
import { CookieService } from './auth/services/cookie.service';
import { OriginGuard } from './auth/guards/origin.guard';
import { AuthGuard } from './auth/guards/auth.guard';
import { CreateWorkspaceController } from './workspaces/controllers/create-workspace.controller';
import { ListWorkspacesController } from './workspaces/controllers/list-workspaces.controller';
import { CheckSlugController } from './workspaces/controllers/check-slug.controller';
import { UpdateWorkspaceController } from './workspaces/controllers/update-workspace.controller';
import { SetWorkspaceStatusController } from './workspaces/controllers/set-workspace-status.controller';
import { DeleteWorkspaceController } from './workspaces/controllers/delete-workspace.controller';
import { AddWorkspaceMemberController } from './workspaces/controllers/add-workspace-member.controller';
import { RemoveWorkspaceMemberController } from './workspaces/controllers/remove-workspace-member.controller';
import { AddWorkspaceContentController } from './workspaces/controllers/add-workspace-content.controller';
import { RemoveWorkspaceContentController } from './workspaces/controllers/remove-workspace-content.controller';
import { WorkspaceService } from './workspaces/services/workspace.service';
import { SlugService } from './workspaces/services/slug.service';
import { MembershipService } from './workspaces/services/membership.service';
import { ContentGrantService } from './workspaces/services/content-grant.service';
import { WorkspaceGuard } from './workspaces/guards/workspace.guard';
import { ListContentTypesController } from './content/controllers/list-content-types.controller';

/**
 * NestJS module for the identity plugin. Registered globally so identity
 * services (permission checks, user management) are injectable from any
 * plugin module without an explicit import.
 *
 * Provides the resolved config and the RBAC services, and mounts the auth
 * controllers (`/auth/login`, `/auth/me`). The Drizzle client is injected
 * straight from `@ortha-cms/database`'s global `DatabaseModule`
 * (`@InjectDatabase()`), so identity registers no db provider of its own.
 */
/** Default login rate limit when the host supplies none: 10 requests / 60s. */
const DEFAULT_RATE_LIMIT: IdentityRateLimitConfig = {
    ttlSeconds: 60,
    limit: 10
};

@Module({})
export class IdentityModule {
    /** Creates the global dynamic module: config, services, and auth routes. */
    static forRoot(config: IdentityPluginConfig): DynamicModule {
        const rateLimit = config.rateLimit ?? DEFAULT_RATE_LIMIT;
        return {
            module: IdentityModule,
            global: true,
            imports: [
                // Per-instance, in-memory rate limit guarding /auth/login
                // against brute-force + bcrypt CPU-DoS. For multi-instance
                // deploys swap in a shared store (e.g. Redis); set Express
                // `trust proxy` behind a load balancer so the client IP — not
                // the proxy's — is what gets throttled.
                ThrottlerModule.forRoot([
                    { ttl: rateLimit.ttlSeconds * 1000, limit: rateLimit.limit }
                ])
            ],
            controllers: [
                LoginController,
                MeController,
                LogoutController,
                UserSessionsController,
                CreateWorkspaceController,
                ListWorkspacesController,
                CheckSlugController,
                UpdateWorkspaceController,
                SetWorkspaceStatusController,
                DeleteWorkspaceController,
                AddWorkspaceMemberController,
                RemoveWorkspaceMemberController,
                AddWorkspaceContentController,
                RemoveWorkspaceContentController,
                ListContentTypesController
            ],
            providers: [
                { provide: IDENTITY_CONFIG, useValue: config },
                WorkspaceService,
                SlugService,
                MembershipService,
                ContentGrantService,
                // Resolved by `@UseGuards(WorkspaceGuard)` on workspace-scoped
                // routes in other plugins; injectable everywhere since this
                // module is global (same pattern as PermissionsGuard).
                WorkspaceGuard,
                SystemRolesSeeder,
                // RootAdminSeeder declared after SystemRolesSeeder so the
                // `admin` role is seeded before it ensures the root admin
                // (FR-10); it delegates to RootAdminService.
                RootAdminService,
                RootAdminSeeder,
                RolesService,
                PermissionsService,
                PermissionsGuard,
                AuthService,
                SessionService,
                HashingService,
                CookieService,
                OriginGuard,
                // App-wide guard: every route requires a valid session unless
                // marked `@Public()`. Resolves the user and attaches it for
                // `@CurrentUser()`. APP_GUARD providers are collected globally,
                // even from this dynamic module.
                { provide: APP_GUARD, useClass: AuthGuard }
            ],
            exports: [
                IDENTITY_CONFIG,
                RolesService,
                PermissionsService,
                AuthService,
                // Exported so a feature plugin's `@UseGuards(WorkspaceGuard)`
                // (instantiated in the consuming module's injector) can resolve
                // the guard and its `MembershipService` dependency — same reason
                // PermissionsService is exported for PermissionsGuard.
                MembershipService,
                WorkspaceGuard
            ]
        };
    }
}

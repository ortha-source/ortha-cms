import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type {
    ApiTokenRateLimitConfig,
    IdentityPluginConfig,
    IdentityRateLimitConfig
} from './types';
import { IDENTITY_CONFIG } from './identity.tokens';
import { RolesService } from './rbac/services/roles.service';
import { PermissionsService } from './rbac/services/permissions.service';
import { PermissionsGuard } from './rbac/guards/permissions.guard';
import { SystemRolesSeeder } from './rbac/seeders/system-roles.seeder';
import { RootAdminService } from './root-admin/services/root-admin.service';
import { RootAdminSeeder } from './root-admin/seeders/root-admin.seeder';
import { LoginController } from './auth/controllers/login.controller';
import { InviteController } from './auth/controllers/invite.controller';
import { PasswordResetController } from './auth/controllers/password-reset.controller';
import { MeController } from './auth/controllers/me.controller';
import { LogoutController } from './auth/controllers/logout.controller';
import { UserSessionsController } from './auth/controllers/user-sessions.controller';
import { PreferencesController } from './preferences/controllers/preferences.controller';
import { PreferencesService } from './preferences/services/preferences.service';
import { AuthService } from './auth/services/auth.service';
import { HashingService } from './auth/services/hashing.service';
import { CookieService } from './auth/services/cookie.service';
import { OriginGuard } from './auth/guards/origin.guard';
import { AuthGuard } from './auth/guards/auth.guard';
import { AccessPolicy } from './domain/access-policy';
import { SessionPolicy } from './domain/session-policy';
import { SESSION_REPOSITORY } from './domain/session.repository';
import { USER_ACCOUNT_REPOSITORY } from './domain/user-account.repository';
import { INVITE_REPOSITORY } from './domain/invite.repository';
import { PASSWORD_RESET_REPOSITORY } from './domain/password-reset.repository';
import { DrizzleSessionRepository } from './infrastructure/persistence/drizzle-session.repository';
import { DrizzleUserAccountRepository } from './infrastructure/persistence/drizzle-user-account.repository';
import { DrizzleInviteRepository } from './infrastructure/persistence/drizzle-invite.repository';
import { DrizzlePasswordResetRepository } from './infrastructure/persistence/drizzle-password-reset.repository';
import { UserAccountMapper } from './infrastructure/persistence/user-account.mapper';
import { UserLookupQuery } from './infrastructure/queries/user-lookup.query';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { AcceptInviteUseCase } from './application/use-cases/accept-invite.use-case';
import { DescribeInviteUseCase } from './application/use-cases/describe-invite.use-case';
import { DescribePasswordResetUseCase } from './application/use-cases/describe-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { ApiTokenService } from './api-tokens/application/api-token.service';
import { DrizzleApiTokenRepository } from './api-tokens/infrastructure/persistence/drizzle-api-token.repository';
import { ApiTokensController } from './api-tokens/http/controllers/api-tokens.controller';
import { RateLimitPolicy } from './api-tokens/domain/rate-limit-policy';
import { ApiTokenRateLimiter } from './api-tokens/application/api-token-rate-limiter';
import { ApiTokenRateLimitFilter } from './api-tokens/http/api-token-rate-limit.filter';

/**
 * NestJS module for the identity plugin. Registered globally so identity
 * services (permission checks, user management) are injectable from any
 * plugin module without an explicit import.
 *
 * Provides the resolved config and the RBAC services, and mounts the auth
 * controllers (`/auth/login`, `/auth/me`). The Drizzle client is injected
 * straight from `@ortha-cms/database`'s global `DatabaseModule`
 * (`@InjectDatabase()`), so identity registers no db provider of its own.
 *
 * The invariant-bearing core is layered per ADR-0003: the auth use-cases
 * (`LoginUseCase` / `LogoutUseCase` / `RefreshSessionUseCase` /
 * `ChangePasswordUseCase`) run over the `UnitOfWork` + outbox and the
 * repository ports (`SESSION_REPOSITORY`, `USER_ACCOUNT_REPOSITORY`); the RBAC
 * decision is the pure `AccessPolicy` domain service the guard delegates to. The
 * public barrel and every route's contract are unchanged.
 */
/** Default login rate limit when the host supplies none: 10 requests / 60s. */
const DEFAULT_RATE_LIMIT: IdentityRateLimitConfig = {
    ttlSeconds: 60,
    limit: 10
};

/**
 * Default public-API budget when the host supplies none: 300 requests / 60s,
 * per API token, shared across REST, GraphQL and MCP.
 *
 * Two orders of magnitude above the login limit because the two protect against
 * different things: login is guessing a secret (ten tries a minute is already
 * generous), while this bounds amplification by a caller that has a valid
 * credential and a legitimate reason to be busy. Five requests a second is
 * comfortably above a site build fetching a few hundred entries, an incremental
 * revalidation, or an agent working through an MCP session — and far below the
 * sustained rate that makes a public read endpoint a useful lever against the
 * database.
 */
const DEFAULT_API_TOKEN_RATE_LIMIT: ApiTokenRateLimitConfig = {
    ttlSeconds: 60,
    limit: 300
};

@Module({})
export class IdentityModule {
    /** Creates the global dynamic module: config, services, and auth routes. */
    static forRoot(config: IdentityPluginConfig): DynamicModule {
        const rateLimit = config.rateLimit ?? DEFAULT_RATE_LIMIT;
        const apiTokenRateLimit =
            config.apiTokenRateLimit ?? DEFAULT_API_TOKEN_RATE_LIMIT;
        return {
            module: IdentityModule,
            global: true,
            imports: [
                // Per-instance, in-memory rate limit guarding /auth/login
                // against brute-force + bcrypt CPU-DoS. The bucket key is
                // `req.ip`, so it is only per-client if the host set Express
                // `trust proxy` — `createServer`'s `trustProxy` option, fed by
                // `TRUST_PROXY`. Unset behind a load balancer, every caller
                // reports the proxy's address and shares one bucket, which
                // turns one attacker's quota into a global login outage. For
                // multi-instance deploys also swap in a shared store (Redis).
                ThrottlerModule.forRoot([
                    { ttl: rateLimit.ttlSeconds * 1000, limit: rateLimit.limit }
                ])
            ],
            controllers: [
                LoginController,
                InviteController,
                PasswordResetController,
                MeController,
                LogoutController,
                UserSessionsController,
                PreferencesController,
                ApiTokensController
            ],
            providers: [
                { provide: IDENTITY_CONFIG, useValue: config },
                SystemRolesSeeder,
                // RootAdminSeeder declared after SystemRolesSeeder so the
                // `admin` role is seeded before it ensures the root admin
                // (FR-10); it delegates to RootAdminService.
                RootAdminService,
                RootAdminSeeder,
                RolesService,
                PermissionsService,
                // Domain services — plain classes, framework-free, so they are
                // wired via factories rather than `@Injectable()` scanning.
                { provide: AccessPolicy, useFactory: () => new AccessPolicy() },
                {
                    provide: SessionPolicy,
                    useFactory: (cfg: IdentityPluginConfig) =>
                        new SessionPolicy(cfg.session.ttlSeconds),
                    inject: [IDENTITY_CONFIG]
                },
                PermissionsGuard,
                // Application — auth flows as use-cases over the unit of work.
                LoginUseCase,
                LogoutUseCase,
                RefreshSessionUseCase,
                ChangePasswordUseCase,
                DescribeInviteUseCase,
                AcceptInviteUseCase,
                DescribePasswordResetUseCase,
                ResetPasswordUseCase,
                AuthService,
                PreferencesService,
                HashingService,
                CookieService,
                OriginGuard,
                // Infrastructure — repository adapters, mapper, and read model.
                {
                    provide: SESSION_REPOSITORY,
                    useClass: DrizzleSessionRepository
                },
                {
                    provide: USER_ACCOUNT_REPOSITORY,
                    useClass: DrizzleUserAccountRepository
                },
                {
                    provide: INVITE_REPOSITORY,
                    useClass: DrizzleInviteRepository
                },
                {
                    provide: PASSWORD_RESET_REPOSITORY,
                    useClass: DrizzlePasswordResetRepository
                },
                UserAccountMapper,
                UserLookupQuery,
                // External-API bearer tokens: the store and the
                // mint/verify/list/revoke service behind `/api/api-tokens`.
                DrizzleApiTokenRepository,
                ApiTokenService,
                // The public API's per-token request budget — the one counter
                // the REST, GraphQL and MCP front doors all spend against, so a
                // credential has a single ceiling however it is used. Built as
                // a factory because the policy is a plain domain value object,
                // configured from the host rather than scanned.
                {
                    provide: RateLimitPolicy,
                    useFactory: () =>
                        new RateLimitPolicy({
                            windowMs: apiTokenRateLimit.ttlSeconds * 1000,
                            limit: apiTokenRateLimit.limit
                        })
                },
                ApiTokenRateLimiter,
                // Global filter: gives every protocol's 429 the same
                // `Retry-After` + `X-RateLimit-*` shape without the throw sites
                // having to touch a response. APP_FILTER providers are
                // collected globally, as APP_GUARD below is.
                { provide: APP_FILTER, useClass: ApiTokenRateLimitFilter },
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
                // Exported so a consuming module's `@UseGuards(PermissionsGuard)`
                // (instantiated in that module's injector) can resolve the
                // guard's `AccessPolicy` dependency, like `PermissionsService`.
                AccessPolicy,
                // Exported so a consuming plugin can resolve the token store —
                // the public content API's bearer guard depends on it.
                ApiTokenService,
                // Exported for the same reason, one layer up: the budget is
                // consumed by `content-server`'s `ApiTokenGuard` (REST +
                // GraphQL) and `mcp-server`'s `McpAuthService`, and both must
                // reach *this* instance or a token would get a fresh ceiling
                // per protocol.
                ApiTokenRateLimiter
            ]
        };
    }
}

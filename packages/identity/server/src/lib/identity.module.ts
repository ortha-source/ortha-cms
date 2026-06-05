import { DynamicModule, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { IdentityPluginConfig, IdentityRateLimitConfig } from './types';
import { IDENTITY_CONFIG } from './identity.tokens';
import { RolesService } from './rbac/roles.service';
import { SystemRolesSeeder } from './rbac/system-roles.seeder';
import { LoginController } from './auth/login.controller';
import { MeController } from './auth/me.controller';
import { LogoutController } from './auth/logout.controller';
import { AuthService } from './auth/auth.service';
import { SessionService } from './auth/session.service';
import { HashingService } from './auth/hashing.service';
import { CookieService } from './auth/cookie.service';
import { OriginGuard } from './auth/origin.guard';

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
            controllers: [LoginController, MeController, LogoutController],
            providers: [
                { provide: IDENTITY_CONFIG, useValue: config },
                SystemRolesSeeder,
                RolesService,
                AuthService,
                SessionService,
                HashingService,
                CookieService,
                OriginGuard
            ],
            exports: [IDENTITY_CONFIG, RolesService, AuthService]
        };
    }
}

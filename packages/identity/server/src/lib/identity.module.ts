import { DynamicModule, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { IdentityPluginConfig } from './types';
import { IDENTITY_CONFIG } from './identity.tokens';
import { RolesService } from './rbac/roles.service';
import { SystemRolesSeeder } from './rbac/system-roles.seeder';
import { LoginController } from './auth/login.controller';
import { MeController } from './auth/me.controller';
import { AuthService } from './auth/auth.service';
import { SessionService } from './auth/session.service';
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
@Module({})
export class IdentityModule {
    /** Creates the global dynamic module: config, services, and auth routes. */
    static forRoot(config: IdentityPluginConfig): DynamicModule {
        return {
            module: IdentityModule,
            global: true,
            imports: [
                // Per-instance, in-memory rate limit guarding /auth/login
                // against brute-force + bcrypt CPU-DoS. For multi-instance
                // deploys swap in a shared store (e.g. Redis); set Express
                // `trust proxy` behind a load balancer so the client IP — not
                // the proxy's — is what gets throttled.
                ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])
            ],
            controllers: [LoginController, MeController],
            providers: [
                { provide: IDENTITY_CONFIG, useValue: config },
                SystemRolesSeeder,
                RolesService,
                AuthService,
                SessionService,
                OriginGuard
            ],
            exports: [IDENTITY_CONFIG, RolesService, AuthService]
        };
    }
}

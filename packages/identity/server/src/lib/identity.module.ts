import { DynamicModule, Module } from '@nestjs/common';
import type { IdentityPluginConfig, IdentityPluginDeps } from './types';
import { IDENTITY_CONFIG, IDENTITY_DB } from './identity.tokens';
import { RolesService } from './rbac/roles.service';
import { SystemRolesSeeder } from './rbac/system-roles.seeder';

/**
 * NestJS module for the identity plugin. Registered globally so identity
 * services (permission checks, user management) are injectable from any
 * plugin module without an explicit import.
 *
 * Provides the resolved config, the host-supplied Drizzle client, and the
 * RBAC services. Controllers land in later tickets.
 */
@Module({})
export class IdentityModule {
    /**
     * Creates the global dynamic module: config, the db client, and identity
     * services. The client is bound by aliasing identity's `IDENTITY_DB`
     * token to the host-supplied `deps.dbToken` (§5) — the value flows
     * through DI, so {@link SystemRolesSeeder} receives it by injection.
     */
    static forRoot(
        config: IdentityPluginConfig,
        deps: IdentityPluginDeps
    ): DynamicModule {
        return {
            module: IdentityModule,
            global: true,
            providers: [
                { provide: IDENTITY_CONFIG, useValue: config },
                { provide: IDENTITY_DB, useExisting: deps.dbToken },
                SystemRolesSeeder,
                RolesService
            ],
            exports: [IDENTITY_CONFIG, IDENTITY_DB, RolesService]
        };
    }
}

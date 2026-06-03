import { DynamicModule, Module } from '@nestjs/common';
import type { IdentityPluginConfig } from './types';
import { IDENTITY_CONFIG } from './identity.tokens';
import { RolesService } from './rbac/roles.service';
import { SystemRolesSeeder } from './rbac/system-roles.seeder';

/**
 * NestJS module for the identity plugin. Registered globally so identity
 * services (permission checks, user management) are injectable from any
 * plugin module without an explicit import.
 *
 * Provides the resolved config and the RBAC services. The Drizzle client is
 * injected straight from `@ortha-cms/database`'s global `DatabaseModule`
 * (`@InjectDatabase()`), so identity registers no db provider of its own.
 * Controllers land in later tickets.
 */
@Module({})
export class IdentityModule {
    /** Creates the global dynamic module: config + identity services. */
    static forRoot(config: IdentityPluginConfig): DynamicModule {
        return {
            module: IdentityModule,
            global: true,
            providers: [
                { provide: IDENTITY_CONFIG, useValue: config },
                SystemRolesSeeder,
                RolesService
            ],
            exports: [IDENTITY_CONFIG, RolesService]
        };
    }
}

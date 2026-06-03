import { DynamicModule, Inject, Module } from '@nestjs/common';
import type { IdentityPluginConfig, IdentityPluginDeps } from './types';
import { RolesService } from './rbac/roles.service';

/**
 * Injection token for the resolved identity configuration. Internal for
 * now — not part of the public barrel until a consumer (auth services,
 * #5+) injects it.
 */
export const IDENTITY_CONFIG = Symbol('IDENTITY_CONFIG');

/** Parameter decorator that injects the identity configuration. */
export const InjectIdentityConfig = (): ParameterDecorator =>
    Inject(IDENTITY_CONFIG);

/**
 * Injection token for identity's Drizzle client. The host supplies the
 * client (§5); identity never imports `@ortha-cms/database`. Internal —
 * kept out of the public barrel until a consumer outside this package
 * injects it.
 */
export const IDENTITY_DB = Symbol('IDENTITY_DB');

/** Parameter decorator that injects identity's Drizzle client. */
export const InjectIdentityDb = (): ParameterDecorator => Inject(IDENTITY_DB);

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
     * Creates the global dynamic module: config, the host-supplied db
     * client, and identity services.
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
                // Evaluated at app-creation — i.e. after every plugin's
                // onPluginInit ran — so the connection is already open and
                // getDb() will not throw.
                { provide: IDENTITY_DB, useFactory: () => deps.getDb() },
                RolesService
            ],
            exports: [IDENTITY_CONFIG, IDENTITY_DB, RolesService]
        };
    }
}

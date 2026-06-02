import { DynamicModule, Inject, Module } from '@nestjs/common';
import type { IdentityPluginConfig } from './types';

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
 * NestJS module for the identity plugin. Registered globally so future
 * identity services (auth guard, permission checks, user management) are
 * injectable from any plugin module without an explicit import.
 *
 * Scaffolding only: it provides the config and nothing else. Schema,
 * services, and controllers land in later tickets.
 */
@Module({})
export class IdentityModule {
    /** Creates the global dynamic module, exposing the identity config. */
    static forRoot(config: IdentityPluginConfig): DynamicModule {
        return {
            module: IdentityModule,
            global: true,
            providers: [{ provide: IDENTITY_CONFIG, useValue: config }],
            exports: [IDENTITY_CONFIG]
        };
    }
}

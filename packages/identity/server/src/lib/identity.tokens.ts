import { Inject } from '@nestjs/common';

/**
 * DI tokens and their inject decorators for the identity plugin. Kept in a
 * dependency-free module (imports only `@nestjs/common`) so providers and
 * services can reference them without forming an import cycle with
 * `identity.module.ts`.
 */

/**
 * Injection token for the resolved identity configuration. Internal — not
 * part of the public barrel until a consumer outside this package injects it.
 */
export const IDENTITY_CONFIG = Symbol('IDENTITY_CONFIG');

/** Parameter decorator that injects the identity configuration. */
export const InjectIdentityConfig = (): ParameterDecorator =>
    Inject(IDENTITY_CONFIG);

/**
 * Injection token for identity's Drizzle client. The host supplies the
 * client by aliasing this token to its own (§5); identity never imports
 * `@ortha-cms/database`. Internal — kept out of the public barrel.
 */
export const IDENTITY_DB = Symbol('IDENTITY_DB');

/** Parameter decorator that injects identity's Drizzle client. */
export const InjectIdentityDb = (): ParameterDecorator => Inject(IDENTITY_DB);

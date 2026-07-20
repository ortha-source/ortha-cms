import { Inject } from '@nestjs/common';

/**
 * Dependency-free DI tokens for the database plugin. Kept in their own module
 * (importing only `@nestjs/common`) so the shared primitives —
 * {@link UnitOfWork}, {@link OutboxWriter}, {@link OutboxDispatcher} — can
 * reference the injection token without importing `database.module`, which in
 * turn imports *them* as providers. Routing the token through the module would
 * form an import cycle whose top-level `@InjectDatabase()` decorators run while
 * the module is still initializing (a TDZ `Cannot access 'InjectDatabase'
 * before initialization`). This is the same token-module pattern plugins use.
 */

/** Injection token for the Drizzle database instance. */
export const DATABASE_TOKEN = Symbol('DATABASE_TOKEN');

/**
 * Parameter decorator that injects the Drizzle database instance.
 */
export const InjectDatabase = (): ParameterDecorator => Inject(DATABASE_TOKEN);

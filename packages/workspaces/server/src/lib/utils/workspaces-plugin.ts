import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { WorkspacesModule } from '../workspaces.module';

/**
 * Server plugin for workspaces. A plain {@link ServerPlugin} — the read surface
 * carries no extra config, so (unlike identity) there is nothing to attach.
 */
export type WorkspacesServerPlugin = ServerPlugin;

/**
 * Creates the workspaces plugin. Conventionally registered **after**
 * `IdentityPlugin` in the `plugins` array, whose workspace/membership/user
 * tables it reads and whose migrations must be applied for the route to work.
 * (Identity's `AuthGuard` is an `APP_GUARD`, collected globally regardless of
 * plugin order, so it protects this route either way.)
 *
 * Ships **no migrations**: it owns no schema (the tables it reads are migrated
 * by identity).
 *
 * @example
 * ```typescript
 * createServer({
 *   plugins: [
 *     DatabasePlugin({ connectionString: config.database.url }),
 *     IdentityPlugin(config.plugins.identity),
 *     WorkspacesPlugin(),
 *   ],
 * });
 * ```
 */
export function WorkspacesPlugin(): WorkspacesServerPlugin {
    return {
        name: 'workspaces',
        module: WorkspacesModule.forRoot()
    };
}

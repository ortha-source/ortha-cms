import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { WorkspacesModule } from '../workspaces.module';

/**
 * Server plugin for workspaces. A plain {@link ServerPlugin} — the read surface
 * carries no extra config, so (unlike identity) there is nothing to attach.
 */
export type WorkspacesServerPlugin = ServerPlugin;

/**
 * Creates the workspaces plugin. Register it **after** `IdentityPlugin` in the
 * `plugins` array — it reads the workspace/membership/user tables identity
 * owns and relies on identity's global `AuthGuard` to authenticate requests.
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

import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { DatabasePlugin } from '@ortha-cms/database';
import { IdentityPlugin } from '@ortha-cms/identity-server';
import { UsersPlugin } from '@ortha-cms/users-server';
import type { OrthaConfig } from '../ortha.config';

/**
 * Builds the host's plugin list. Shared by `main.ts` (boot) and the
 * `db:migrate` target (which reads each plugin's `migrations` descriptor),
 * so both see exactly the same plugins, in the same order.
 *
 * Order matters: `DatabasePlugin` must come first — it opens the connection
 * every other plugin assumes. Identity owns the workspaces schema and its
 * read/create endpoints; `UsersPlugin` is listed after `IdentityPlugin`, whose
 * tables it reads (a convention; the routes' `AuthGuard` is global and
 * order-independent).
 */
export function buildPlugins(config: OrthaConfig): ServerPlugin[] {
    return [
        DatabasePlugin({ connectionString: config.database.url }),
        IdentityPlugin(config.plugins.identity),
        UsersPlugin()
    ];
}

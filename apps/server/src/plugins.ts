import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { ActivityPlugin } from '@ortha-cms/activity-server';
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
 * read/create endpoints; `ActivityPlugin` follows it (its read API is gated by
 * identity's guard + `activity:read` permission, and identity records audit
 * events through its globally-bound recorder). `UsersPlugin` is listed last,
 * reading identity's tables and recording through the activity plugin (all
 * three modules are global, so DI is order-independent — the order here just
 * keeps migrations and intent legible).
 */
export function buildPlugins(config: OrthaConfig): ServerPlugin[] {
    return [
        DatabasePlugin({ connectionString: config.database.url }),
        IdentityPlugin(config.plugins.identity),
        ActivityPlugin(),
        UsersPlugin()
    ];
}

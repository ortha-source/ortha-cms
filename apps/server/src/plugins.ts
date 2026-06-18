import { join } from 'node:path';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { ActivityPlugin } from '@ortha-cms/activity-server';
import { ContentPlugin } from '@ortha-cms/content-server';
import { DatabasePlugin } from '@ortha-cms/database';
import { IdentityPlugin } from '@ortha-cms/identity-server';
import { UsersPlugin } from '@ortha-cms/users-server';
import type { OrthaConfig } from '../ortha.config';
import { contentTypes } from './content';

/**
 * Builds the host's plugin list. Shared by `main.ts` (boot) and the
 * `db:migrate` target (which reads each plugin's `migrations` descriptor),
 * so both see exactly the same plugins, in the same order.
 *
 * Order matters: `DatabasePlugin` must come first — it opens the connection
 * every other plugin assumes. Identity owns the workspaces schema and its
 * read/create endpoints; `ActivityPlugin` follows it (its read API is gated by
 * identity's guard + `activity:read` permission, and identity records audit
 * events through its globally-bound recorder). `UsersPlugin` reads identity's
 * tables and records through the activity plugin. `ContentPlugin` is listed
 * last; its generated collection tables are host-owned migrations, independent
 * of the other plugins (all modules are global, so DI is order-independent —
 * the order here just keeps migrations and intent legible).
 */
export function buildPlugins(config: OrthaConfig): ServerPlugin[] {
    return [
        DatabasePlugin({ connectionString: config.database.url }),
        IdentityPlugin(config.plugins.identity),
        ActivityPlugin(),
        UsersPlugin(),
        ContentPlugin({
            types: contentTypes,
            // The HOST owns the generated collection tables (drizzle.config.ts
            // diffs src/content.ts into ./migrations); routing the
            // descriptor through the plugin lets the standard db:migrate
            // machinery apply them with every other plugin's migrations.
            migrations: {
                dir: () => join(__dirname, '../migrations'),
                table: '__drizzle_migrations_content'
            }
        })
    ];
}

import type { ServerPlugin } from '@orthacms/bootstrap-server';
import { ActivityPlugin } from '@orthacms/activity-server';
import { ContentPlugin } from '@orthacms/content-server';
import { DatabasePlugin } from '@orthacms/database';
import { I18nServerPlugin } from '@orthacms/i18n-server';
import { IdentityPlugin } from '@orthacms/identity-server';
import { MediaServerPlugin } from '@orthacms/media-server';
import { createLocalStorageProvider } from '@orthacms/media-provider-local';
import { UsersPlugin } from '@orthacms/users-server';
import { WorkspacesPlugin } from '@orthacms/workspaces-server';
import type { OrthaConfig } from './ortha.config';

/**
 * This app's composition — the whole of what its API is.
 *
 * **The order is migration order.** Migrations are applied by walking this
 * array, with no transaction spanning plugins, so a plugin whose tables
 * reference another's must come after it. `WorkspacesPlugin` follows
 * `IdentityPlugin` because its `memberships` table FK-references identity's
 * `users`: put it first and a *fresh* `ortha migrate` fails with
 * `relation "users" does not exist`, while an already-migrated database
 * migrates perfectly happily — so the mistake ships and bites the next clean
 * install. Add new plugins at the end unless you have a reason not to.
 *
 * Order does **not** decide dependency injection: every plugin module is
 * global and every `onPluginInit` runs before the Nest app is created, so no
 * provider can be constructed before the database connection is open.
 *
 * To add a plugin, install it and add a line. To remove one, delete its line —
 * plugins that extend each other do so through optional ports, so removing one
 * degrades the feature rather than failing boot.
 */
export function buildPlugins(config: OrthaConfig): ServerPlugin[] {
    return [
        // First: the only plugin that opens a resource in `onPluginInit`.
        DatabasePlugin({ connectionString: config.database.url }),
        IdentityPlugin(config.plugins.identity),
        WorkspacesPlugin(),
        ActivityPlugin(),
        UsersPlugin(),
        // No content types yet. Define some in `src/server/content/`, pass them
        // here as `types`, then add a `drizzle.config.ts` pointing at them and
        // a `migrations` descriptor so `ortha generate` / `ortha migrate` can
        // manage their tables:
        //
        //   ContentPlugin({
        //       types: contentTypes,
        //       migrations: {
        //           dir: () => join(process.cwd(), 'migrations'),
        //           table: '__drizzle_migrations_content'
        //       }
        //   })
        //
        // Until then the plugin serves its generic routes with an empty
        // registry, and owns no tables of its own.
        ContentPlugin({ types: [] }),
        // Fills the Content Library's locale extensions, so it reads after it.
        I18nServerPlugin(config.plugins.i18n),
        // This line is the single place that selects storage — one constructed
        // provider, writing every upload to local disk. Swapping backend is
        // swapping this expression (and the type of `media.storage` with it).
        MediaServerPlugin({
            provider: createLocalStorageProvider(config.plugins.media.storage),
            config: config.plugins.media
        })
    ];
}

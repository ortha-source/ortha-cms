import { join } from 'node:path';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { ContentPlugin } from '@ortha-cms/content-server';
import { DatabasePlugin } from '@ortha-cms/database';
import { IdentityPlugin } from '@ortha-cms/identity-server';
import type { OrthaConfig } from '../ortha.config';
import { contentTypes } from './collections';

/**
 * Builds the host's plugin list. Shared by `main.ts` (boot) and the
 * `db:migrate` target (which reads each plugin's `migrations` descriptor),
 * so both see exactly the same plugins, in the same order.
 *
 * Order matters: `DatabasePlugin` must come first — it opens the
 * connection every other plugin assumes.
 */
export function buildPlugins(config: OrthaConfig): ServerPlugin[] {
    return [
        DatabasePlugin({ connectionString: config.database.url }),
        IdentityPlugin(config.plugins.identity),
        ContentPlugin({
            types: contentTypes,
            // The HOST owns the generated collection tables (drizzle.config.ts
            // diffs src/collections/schema.ts into ./migrations); routing the
            // descriptor through the plugin lets the standard db:migrate
            // machinery apply them with every other plugin's migrations.
            migrations: {
                dir: () => join(__dirname, '../migrations'),
                table: '__drizzle_migrations_content'
            }
        })
    ];
}

import { join } from 'node:path';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { ActivityPlugin } from '@ortha-cms/activity-server';
import { ContentPlugin } from '@ortha-cms/content-server';
import { ContentGraphqlPlugin } from '@ortha-cms/content-graphql';
import { DatabasePlugin } from '@ortha-cms/database';
import { I18nServerPlugin } from '@ortha-cms/i18n-server';
import { IdentityPlugin } from '@ortha-cms/identity-server';
import { MediaServerPlugin } from '@ortha-cms/media-server';
import { UsersPlugin } from '@ortha-cms/users-server';
import { WorkspacesPlugin } from '@ortha-cms/workspaces-server';
import type { OrthaConfig } from '../../../server/ortha.config';
import { testContentTypes } from './content';
import { createInMemoryStorageProvider } from './media-storage';

/**
 * Builds the plugin list the e2e harness boots with — the e2e-owned analogue of
 * the host's `apps/server/src/plugins.ts:buildPlugins`. It mirrors the host's
 * wiring and order exactly EXCEPT for content: `ContentPlugin` is registered
 * with the harness's own {@link testContentTypes} and points its `migrations`
 * descriptor at the e2e-owned migration dir (`apps/server-e2e/migrations/
 * content`, generated from `drizzle.config.ts`). This is what decouples the
 * whole e2e run from `apps/server/src/content` — renaming or dropping an app
 * collection no longer affects these tests.
 *
 * Shared by `global-setup` (which reads each plugin's `migrations` descriptor to
 * migrate the shared testcontainer) and `test-app` (which boots the app), so
 * both see exactly the same plugins in the same order. Order matters as in the
 * host: `DatabasePlugin` first (opens the connection), identity before
 * workspaces (FK + reads), workspaces before content (its `WorkspaceGuard` +
 * ports), and i18n after content (binds content's extension port).
 */
export function buildTestPlugins(config: OrthaConfig): ServerPlugin[] {
    const content = ContentPlugin({
        types: testContentTypes,
        // The e2e harness OWNS these generated tables: drizzle.config.ts
        // diffs src/support/content into ./migrations/content. Routing the
        // descriptor through the plugin lets `global-setup`'s standard
        // migrate loop apply them with every other plugin's migrations.
        migrations: {
            dir: () => join(__dirname, '../../migrations/content'),
            table: '__drizzle_migrations_content'
        }
    });
    return [
        DatabasePlugin({ connectionString: config.database.url }),
        IdentityPlugin(config.plugins.identity),
        WorkspacesPlugin(),
        ActivityPlugin(),
        UsersPlugin(),
        content,
        // The GraphQL protocol over the same public content API — registered
        // here so the e2e suite exercises the real composition, including the
        // shared bearer guards it depends on.
        ContentGraphqlPlugin({
            content,
            ...config.plugins.contentGraphql,
            // GraphiQL rides the same switch as the Scalar reference: both are
            // developer tooling, and neither should be reachable in production
            // unless the operator asks (`API_DOCS=true`).
            playground: config.docs.enabled === true
        }),
        // Media ships its own migrations (picked up by the migrate loop) and
        // registers an in-memory storage provider so uploads never touch disk.
        MediaServerPlugin({
            providers: { memory: createInMemoryStorageProvider() },
            config: config.plugins.media
        }),
        I18nServerPlugin(config.plugins.i18n)
    ];
}

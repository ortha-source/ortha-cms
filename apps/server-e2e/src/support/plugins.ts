import { join } from 'node:path';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { ActivityPlugin } from '@ortha-cms/activity-server';
import { ContentPlugin } from '@ortha-cms/content-server';
import { ContentGraphqlPlugin } from '@ortha-cms/content-graphql';
import { CopilotPlugin } from '@ortha-cms/copilot-server';
import { DatabasePlugin } from '@ortha-cms/database';
import { I18nServerPlugin } from '@ortha-cms/i18n-server';
import { IdentityPlugin } from '@ortha-cms/identity-server';
import { McpPlugin } from '@ortha-cms/mcp-server';
import { MediaServerPlugin } from '@ortha-cms/media-server';
import { UsersPlugin } from '@ortha-cms/users-server';
import { WorkspacesPlugin } from '@ortha-cms/workspaces-server';
import type { OrthaConfig } from '../../../server/ortha.config';
import { testContentTypes } from './content';
import { fakeProvider, testCodeSkills } from './copilot';
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
        I18nServerPlugin(config.plugins.i18n),
        // Copilot before MCP: runs are workspace-scoped and execute as the
        // calling user, so it must register after workspaces and identity. Its
        // only provider is the scripted fake — no key, no network, and the
        // whole tool loop still exercised.
        CopilotPlugin({
            providers: [{ name: 'fake', provider: fakeProvider }],
            // Code-defined skills, so the half of the feature that never
            // touches the database is exercised by the same boot the host
            // performs — including a code skill's name being unavailable to a
            // CMS one.
            skills: testCodeSkills,
            config: config.plugins.copilot
        }),
        // MCP last, as in the host. Enabled here regardless of the
        // `MCP_ENABLED` default so the endpoint is testable; the disabled path
        // is covered by a per-suite config override.
        McpPlugin({ config: config.plugins.mcp })
    ];
}

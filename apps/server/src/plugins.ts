import { join } from 'node:path';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { ActivityPlugin } from '@ortha-cms/activity-server';
import { ContentPlugin } from '@ortha-cms/content-server';
import { ContentGraphqlPlugin } from '@ortha-cms/content-graphql';
import { CopilotPlugin } from '@ortha-cms/copilot-server';
import { createAnthropicProvider } from '@ortha-cms/copilot-provider-anthropic';
import { createFakeProvider } from '@ortha-cms/copilot-provider-fake';
import { createOpenAiProvider } from '@ortha-cms/copilot-provider-openai';
import { DatabasePlugin } from '@ortha-cms/database';
import { I18nServerPlugin } from '@ortha-cms/i18n-server';
import { IdentityPlugin } from '@ortha-cms/identity-server';
import { McpPlugin } from '@ortha-cms/mcp-server';
import { MediaServerPlugin } from '@ortha-cms/media-server';
import { createLocalStorageProvider } from '@ortha-cms/media-provider-local';
import { UsersPlugin } from '@ortha-cms/users-server';
import { WorkspacesPlugin } from '@ortha-cms/workspaces-server';
import type { OrthaConfig } from '../ortha.config';
import { contentTypes } from './content';

/**
 * Builds the host's plugin list. Shared by `main.ts` (boot) and the
 * `db:migrate` target (which reads each plugin's `migrations` descriptor),
 * so both see exactly the same plugins, in the same order.
 *
 * Order matters: `DatabasePlugin` must come first — it opens the connection
 * every other plugin assumes. `WorkspacesPlugin` follows identity (its
 * `memberships` table FK-references identity's `users`, so `users` must be
 * migrated first, and its services read identity's `users`/`roles`); it must
 * also precede `ContentPlugin`, which scopes routes with its `WorkspaceGuard`
 * and binds its `CONTENT_CATALOG` / `CONTENT_ENTRY_COUNTER` ports. `ActivityPlugin`
 * follows (its read API is gated by identity's guard + `activity:read`
 * permission, and workspaces records audit events through the globally-bound
 * recorder). `UsersPlugin` reads identity's and workspaces' tables and records
 * through the activity plugin. `ContentPlugin`'s generated
 * collection tables are host-owned migrations, independent of the other
 * plugins (all modules are global, so DI is order-independent — the order
 * here just keeps migrations and intent legible). `I18nServerPlugin` follows
 * `ContentPlugin`: it binds content's `CONTENT_ENTRY_EXTENSION` port and
 * reads its registry.
 */
export function buildPlugins(config: OrthaConfig): ServerPlugin[] {
    const content = ContentPlugin({
        types: contentTypes,
        // The HOST owns the generated collection tables (drizzle.config.ts
        // diffs src/content/index.ts into ./migrations); routing the
        // descriptor through the plugin lets the standard db:migrate
        // machinery apply them with every other plugin's migrations.
        migrations: {
            dir: () => join(__dirname, '../migrations'),
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
        // The same public content API over GraphQL, on `/api/v1/graphql`. It
        // owns no schema and adds no credential — it reuses content's bearer
        // guards and read/write services, so a token minted before it existed
        // works against it unchanged. Taking `content` by value lets it fail
        // boot on two content types that would collide as GraphQL names,
        // rather than on the first request from a workspace granted both.
        ContentGraphqlPlugin({
            content,
            ...config.plugins.contentGraphql,
            // GraphiQL rides the same switch as the Scalar reference: both are
            // developer tooling, and neither should be reachable in production
            // unless the operator asks (`API_DOCS=true`).
            playground: config.docs.enabled === true
        }),
        // Media — registered after workspaces (its routes use `WorkspaceGuard`)
        // and identity (its routes use `PermissionsGuard`). The composition root
        // is the single place that selects storage: register providers by name
        // and, optionally, a `resolve` handler to route per file. The default
        // install runs one local-filesystem provider and no handler, so every
        // upload lands on disk under `config.plugins.media.local.rootDir`.
        //
        // To route by file (once the S3 adapter lands), add more providers and a
        // handler, e.g.:
        //   providers: { local: createLocalStorageProvider(...), s3: createS3StorageProvider(...) },
        //   resolve: (ctx) => (ctx.kind === 'video' ? 's3' : 'local'),
        MediaServerPlugin({
            providers: {
                local: createLocalStorageProvider(config.plugins.media.local)
            },
            config: config.plugins.media
        }),
        I18nServerPlugin(config.plugins.i18n),
        // Copilot — registered after workspaces (runs are workspace-scoped)
        // and identity (runs execute as the calling user, gated on
        // `copilot:use`). Like media, the composition root is the single place
        // that selects a backend, and the plugin never learns which adapters
        // exist: it takes a list of named, already-constructed providers.
        //
        // Each provider declares several models, so a user can switch between
        // them mid-conversation, and an operator can switch provider entirely
        // with `COPILOT_PROVIDER` — no redeploy, which is most of what
        // self-hosters are asking for (ADR-0004 §5). Registering two of the
        // same kind is just another entry:
        //   { name: 'ollama-big', provider: createOpenAiProvider({ … }) },
        //
        // To route per run, add a `resolve` handler, e.g.:
        //   resolve: (ctx) => (isBigWorkspace(ctx.workspaceId) ? 'claude' : 'ollama'),
        //
        // Phase 0 ships nothing visible: this binds the model seam and the
        // config so the chat vertical slice has something to build on.
        CopilotPlugin({
            providers: [
                {
                    name: 'claude',
                    provider: createAnthropicProvider(
                        config.plugins.copilot.providers.claude
                    )
                },
                {
                    name: 'ollama',
                    provider: createOpenAiProvider(
                        config.plugins.copilot.providers.ollama
                    )
                },
                // Shipped, not test scaffolding (ADR-0004 §3): it is how
                // server-e2e drives the loop with no key and no network, and
                // how a contributor runs the admin offline.
                { name: 'fake', provider: createFakeProvider() }
            ],
            config: config.plugins.copilot
        }),
        // MCP — the Model Context Protocol front door, registered LAST because
        // it serves whatever the plugins above contributed. Order is legibility
        // only: every plugin module is global, and a contributor registers its
        // tools in `onModuleInit`, once the whole graph exists.
        //
        // It owns no tools itself. `ContentPlugin` contributes the content CRUD
        // set; a future media or users provider is a `ToolProvider` in that
        // plugin and nothing at all here. The same registry is what the
        // copilot's tool loop will consume in-process, so a tool added for one
        // consumer is automatically available to the other.
        //
        // Disabled unless `MCP_ENABLED=true` — see the config's note.
        McpPlugin({ config: config.plugins.mcp })
    ];
}

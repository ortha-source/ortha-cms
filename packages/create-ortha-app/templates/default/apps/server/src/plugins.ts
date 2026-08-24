import type { ServerPlugin } from '@orthacms/bootstrap-server';
import { ActivityPlugin } from '@orthacms/activity-server';
import { ContentPlugin } from '@orthacms/content-server';
import { DatabasePlugin } from '@orthacms/database';
import { I18nServerPlugin } from '@orthacms/i18n-server';
import { IdentityPlugin } from '@orthacms/identity-server';
import { MediaServerPlugin } from '@orthacms/media-server';
// ortha:if media-local
import { createLocalStorageProvider } from '@orthacms/media-provider-local';
// ortha:end
// ortha:if media-s3
import { createS3StorageProvider } from '@orthacms/media-provider-s3';
// ortha:end
// ortha:if media-azure
import { createAzureStorageProvider } from '@orthacms/media-provider-azure';
// ortha:end
// ortha:if media-gcs
import { createGcsStorageProvider } from '@orthacms/media-provider-gcs';
// ortha:end
import { UsersPlugin } from '@orthacms/users-server';
// ortha:if graphql
import { ContentGraphqlPlugin } from '@orthacms/content-graphql';
// ortha:end
// ortha:if mcp
import { McpPlugin } from '@orthacms/mcp-server';
// ortha:end
import {
    CopilotPlugin,
    type ProviderRegistration
} from '@orthacms/copilot-server';
import { createFakeProvider } from '@orthacms/copilot-provider-fake';
// ortha:if copilot-anthropic
import { createAnthropicProvider } from '@orthacms/copilot-provider-anthropic';
// ortha:end
// ortha:if copilot-openai
import { createOpenAiProvider } from '@orthacms/copilot-provider-openai';
// ortha:end
import { WorkspacesPlugin } from '@orthacms/workspaces-server';
import type { OrthaConfig } from '../ortha.config';

/**
 * The model backends this deployment can actually reach, in preference order.
 *
 * **Only what is configured is registered.** `ortha.config.ts` omits a provider
 * whose connection settings are absent, and an unconfigured backend is skipped
 * here too: the first entry serves a run that names no provider, so a keyless
 * one at the top of the list would be the house default and would fail on the
 * first message.
 *
 * `fake` is last and unconditional. It is a shipped adapter, not test
 * scaffolding — it needs no key and no network, so it is what makes the chat
 * work offline, and being last it is the default only when it is the only one.
 */
export function copilotProviders(config: OrthaConfig): ProviderRegistration[] {
    const providers: ProviderRegistration[] = [];
    // ortha:if copilot-anthropic
    if (config.plugins.copilot.providers.claude) {
        providers.push({
            name: 'claude',
            provider: createAnthropicProvider(
                config.plugins.copilot.providers.claude
            )
        });
    }
    // ortha:end
    // ortha:if copilot-openai
    if (config.plugins.copilot.providers.openai) {
        providers.push({
            name: 'openai',
            provider: createOpenAiProvider(
                config.plugins.copilot.providers.openai
            )
        });
    }
    // ortha:end
    providers.push({ name: 'fake', provider: createFakeProvider() });

    return providers;
}

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
    // No content types yet — see the note below. Held in a variable because
    // the GraphQL adapter takes the plugin itself, not just its types.
    const content = ContentPlugin({ types: [] });

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
        content,
        // ortha:if graphql
        // The same public content API over GraphQL, on /api/v1/graphql. It owns
        // no schema and adds no credential — it reuses content's bearer guards
        // and read services, so a token minted before it existed works against
        // it unchanged. Taking `content` by value lets it fail boot on two
        // content types that would collide as GraphQL names, rather than on the
        // first request from a workspace granted both.
        ContentGraphqlPlugin({
            content,
            playground: config.docs.enabled === true
        }),
        // ortha:end
        // Fills the Content Library's locale extensions, so it reads after it.
        I18nServerPlugin(config.plugins.i18n),
        // This line is the single place that selects storage — one constructed
        // provider, writing every upload to local disk. A deployment runs
        // exactly one; swapping backend is swapping this expression (and the
        // type of `media.storage` with it).
        MediaServerPlugin({
            // ortha:if media-local
            provider: createLocalStorageProvider(config.plugins.media.storage),
            // ortha:end
            // ortha:if media-s3
            provider: createS3StorageProvider(config.plugins.media.storage),
            // ortha:end
            // ortha:if media-azure
            provider: createAzureStorageProvider(config.plugins.media.storage),
            // ortha:end
            // ortha:if media-gcs
            provider: createGcsStorageProvider(config.plugins.media.storage),
            // ortha:end
            config: config.plugins.media
        }),
        // Registered after workspaces (runs are workspace-scoped) and identity
        // (runs execute as the calling user, gated on `copilot:use`). The
        // composition root is the single place that selects a backend: the
        // plugin never learns which adapters exist, it takes a list of named,
        // already-constructed providers, and **the order is the setting** —
        // there is no `defaultProvider`, the first entry serves a run that
        // names none.
        CopilotPlugin({
            providers: copilotProviders(config),
            config: config.plugins.copilot
        }),
        // ortha:if mcp
        // The Model Context Protocol front door, registered LAST because it
        // serves whatever the plugins above contributed. Off unless
        // MCP_ENABLED=true: it hands an external agent the same content CRUD a
        // full-scope token has.
        McpPlugin({ config: config.plugins.mcp })
        // ortha:end
    ];
}

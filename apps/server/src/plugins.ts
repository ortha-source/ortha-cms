import { join } from 'node:path';
import type { ServerPlugin } from '@orthacms/bootstrap-server';
import { ActivityPlugin } from '@orthacms/activity-server';
import { ContentPlugin } from '@orthacms/content-server';
import { ContentGraphqlPlugin } from '@orthacms/content-graphql';
import {
    CopilotPlugin,
    type ProviderRegistration
} from '@orthacms/copilot-server';
import { createAnthropicProvider } from '@orthacms/copilot-provider-anthropic';
import { createFakeProvider } from '@orthacms/copilot-provider-fake';
import { createOpenAiProvider } from '@orthacms/copilot-provider-openai';
import { DatabasePlugin } from '@orthacms/database';
import { I18nServerPlugin } from '@orthacms/i18n-server';
import { IdentityPlugin } from '@orthacms/identity-server';
import { McpPlugin } from '@orthacms/mcp-server';
import { MediaServerPlugin } from '@orthacms/media-server';
import { createLocalStorageProvider } from '@orthacms/media-provider-local';
import { UsersPlugin } from '@orthacms/users-server';
import { WorkspacesPlugin } from '@orthacms/workspaces-server';
import type { OrthaConfig } from '../ortha.config';
import { contentTypes } from './content';

/**
 * The copilot backends this deployment can actually reach, in preference
 * order — a real one first, `fake` last.
 *
 * **Only what is configured is registered.** `ortha.config.ts` omits a
 * provider whose connection settings are absent, and an unconfigured backend
 * is not registered here either: the first entry is what a run that names no
 * provider gets, so a keyless `claude` at the top of the list would be the
 * house default and would fail on the first message. A clone with no keys is
 * left with `fake` alone, which is a working chat and a picker with nothing to
 * choose (the admin hides a one-option picker).
 *
 * **Exported for `plugins.spec.ts`.** The order this returns is what decides
 * the house default, and it is unreachable from the outside otherwise: the
 * plugin object carries its `copilotConfig`, not its providers, and `server-e2e`
 * builds its own plugin list rather than calling `buildPlugins`. So a config
 * threaded into the wrong factory here would have passed every test in the
 * repo.
 */
export function copilotProviders(config: OrthaConfig): ProviderRegistration[] {
    const { claude, ollama } = config.plugins.copilot.providers;
    return [
        ...(claude
            ? [{ name: 'claude', provider: createAnthropicProvider(claude) }]
            : []),
        ...(ollama
            ? [{ name: 'ollama', provider: createOpenAiProvider(ollama) }]
            : []),
        // Shipped, not test scaffolding (ADR-0004 §3): it is how server-e2e
        // drives the loop with no key and no network, and how a contributor
        // runs the admin offline. Last, so it is the default only when it is
        // the only thing there is.
        { name: 'fake', provider: createFakeProvider() }
    ];
}

/**
 * Builds the host's plugin list. Shared by `main.ts` (boot) and the
 * `db:migrate` target (which reads each plugin's `migrations` descriptor),
 * so both see exactly the same plugins, in the same order.
 *
 * **What the order actually decides.** Not dependency injection: every plugin
 * module is global, and `createServer` runs every `onPluginInit` before
 * `NestFactory.create`, so no provider can be constructed before the database
 * connection is open regardless of position. Measured: moving `IdentityPlugin`
 * above `DatabasePlugin` boots and serves normally. `DatabasePlugin` is
 * nonetheless listed first because it is the only plugin that opens a resource
 * in `onPluginInit`, and the moment a second one does, that hook order — which
 * *is* array order — becomes load-bearing with nothing to catch a mistake.
 *
 * What the order does decide is **migration order**: `applyPluginMigrations`
 * walks this array, with no transaction spanning plugins, so a plugin whose
 * tables reference another's must come after it. `WorkspacesPlugin` follows
 * identity because `memberships` FK-references identity's `users`; moving it
 * above fails a *fresh* migrate with `relation "users" does not exist` and
 * migrates an already-migrated database happily — so the mistake ships and bites
 * the next clean install. `apps/server/src/plugins.spec.ts` asserts the
 * ordering; ORT-131 tracks making it a declaration rather than a comment.
 *
 * The rest is intent, and reads in dependency order for that reason:
 * `WorkspacesPlugin` precedes `ContentPlugin`, which scopes routes with its
 * `WorkspaceGuard` and binds its `CONTENT_CATALOG` / `CONTENT_ENTRY_COUNTER`
 * ports; `ActivityPlugin`'s read API is gated by identity's guard plus
 * `activity:read`, and workspaces records audit events through the globally-bound
 * recorder; `UsersPlugin` reads identity's and workspaces' tables and records
 * through activity; `I18nServerPlugin` follows `ContentPlugin` because it binds
 * content's `CONTENT_ENTRY_EXTENSION` port and reads its registry. Those ports
 * are injected `@Optional()`, so **removing** one of these plugins degrades
 * silently rather than failing boot — which is what `plugins.spec.ts` pins the
 * membership of this list for.
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
        // and identity (its routes use `PermissionsGuard`). This line is the
        // single place that selects storage: one constructed provider, so
        // switching backend is swapping this expression (and the type of
        // `config.plugins.media.storage` with it).
        //
        // A deployment runs exactly one. The provider's own `id` is recorded on
        // every asset row, and `StorageProviderCheck` refuses to boot if the
        // library already holds assets written by a different one — those bytes
        // are in a backend this process is not connected to.
        MediaServerPlugin({
            provider: createLocalStorageProvider(config.plugins.media.storage),
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
        // them mid-conversation, and an operator changes what is on offer by
        // changing this list — no redeploy of the copilot packages, which is
        // most of what self-hosters are asking for (ADR-0004 §5). Registering
        // two of the same kind is just another entry:
        //   { name: 'ollama-big', provider: createOpenAiProvider({ … }) },
        //
        // **The order is the setting.** There is no `defaultProvider`: the
        // first entry serves a run that names no provider (MCP, the API, e2e)
        // and is what the admin's model picker opens on. To route per run
        // instead, add a `resolve` handler, e.g.:
        //   resolve: (ctx) => (isBigWorkspace(ctx.workspaceId) ? 'claude' : 'ollama'),
        //
        // Every provider × model pair registered here is what the chat panel's
        // model picker offers (`GET /api/copilot/models`), so adding a backend
        // is an entry in this list and nothing else.
        CopilotPlugin({
            providers: copilotProviders(config),
            // Skills defined in code — reusable instruction packets available
            // in every workspace, reviewed in git and changed by a deploy
            // (ADR-0010). Workspaces author their own in the admin; a code
            // skill wins a name collision and is read-only there.
            //
            // The default install ships none, because a skill is editorial
            // guidance and nobody else's is right for your content. Adding one
            // is an entry here plus a Markdown file beside this one:
            //
            //   skills: [
            //       {
            //           name: 'house-style',
            //           title: 'House style',
            //           description:
            //               'How we write product copy: sentence case, second person.',
            //           // `always` puts it in force on every run; omit for
            //           // "only when someone attaches it in the composer".
            //           mode: 'always',
            //           instructions: readFileSync(
            //               join(__dirname, 'skills/house-style.md'),
            //               'utf8'
            //           )
            //       }
            //   ],
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

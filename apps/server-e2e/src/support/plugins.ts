import { join } from 'node:path';
import type { ServerPlugin } from '@orthacms/bootstrap-server';
import { ActivityPlugin } from '@orthacms/activity-server';
import { ContentPlugin } from '@orthacms/content-server';
import { ContentGraphqlPlugin } from '@orthacms/content-graphql';
import { CopilotPlugin } from '@orthacms/copilot-server';
import { DatabasePlugin } from '@orthacms/database';
import { I18nServerPlugin } from '@orthacms/i18n-server';
import { TransferPlugin } from '@orthacms/transfer-server';
import { IdentityPlugin } from '@orthacms/identity-server';
import { McpPlugin } from '@orthacms/mcp-server';
import { createLocalStorageProvider } from '@orthacms/media-provider-local';
import { MediaServerPlugin } from '@orthacms/media-server';
import { UsersPlugin } from '@orthacms/users-server';
import { WorkspacesPlugin } from '@orthacms/workspaces-server';
import type { OrthaConfig } from '../../../server/ortha.config';
import { testContentTypes } from './content';
import { fakeAltProvider, fakeProvider, testCodeSkills } from './copilot';
import { fakeSsoProvider, ssoRoleResolver } from './sso';
import {
    createInMemoryStorageProvider,
    createSigningStorageProvider
} from './media-storage';

/** Harness-only wiring choices that are not expressible as config. */
export interface BuildTestPluginsOptions {
    /**
     * Boot on the real filesystem provider rooted here, instead of the
     * in-memory one.
     *
     * A deployment runs exactly one storage provider, so this is a choice about
     * which object to construct — not a name in config that something else
     * selects between.
     */
    localMediaRoot?: string;
    /**
     * Boot on a provider that can mint a signed URL, for the direct-serve
     * suites. Mutually exclusive with `localMediaRoot` in practice — nothing
     * needs both, and the filesystem cannot sign.
     */
    signingProvider?: boolean;
}

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
export function buildTestPlugins(
    config: OrthaConfig,
    options: BuildTestPluginsOptions = {}
): ServerPlugin[] {
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
        // Identity, with the scripted identity provider registered under
        // `fake`. The host registers none by default; the harness registers one
        // so the entire SSO redirect handshake — attempt row, state, PKCE,
        // verification, account resolution, session — runs in CI with no
        // tenant and no network.
        IdentityPlugin(config.plugins.identity, {
            sso: {
                providers: [{ name: 'fake', provider: fakeSsoProvider }],
                // Always registered, so the wiring is exercised on every boot.
                // It answers `null` — "leave the role alone", the shipped
                // default — unless a test scripts something with
                // `scriptSsoRole`.
                resolveRole: ssoRoleResolver
            }
        }),
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
        // runs one storage provider, like any deployment: the in-memory one, so
        // uploads never touch disk — or the real filesystem adapter when a
        // suite sets `localMediaRoot`, because the claims about what lands on
        // disk, and about a `storage_key` that tries to walk out of the root,
        // can only be checked against a real directory.
        MediaServerPlugin({
            provider: options.localMediaRoot
                ? createLocalStorageProvider(config.plugins.media.storage)
                : options.signingProvider
                  ? createSigningStorageProvider()
                  : createInMemoryStorageProvider(),
            config: config.plugins.media
        }),
        I18nServerPlugin(config.plugins.i18n),
        // Export/import, after content and media for the same reasons the host
        // registers it there.
        TransferPlugin(config.plugins.transfer),
        // Copilot before MCP: runs are workspace-scoped and execute as the
        // calling user, so it must register after workspaces and identity. Both
        // providers are scripted fakes — no key, no network, and the whole tool
        // loop still exercised.
        //
        // **Two of them, and the order is the assertion.** There is no
        // `defaultProvider` config: a run naming no provider is served by the
        // first registration, so a harness with one provider could not tell a
        // working rule from a broken one. `fake` is first and is what an
        // unnamed run must land on; `fake-alt` is what naming a provider must
        // reach instead.
        CopilotPlugin({
            providers: [
                { name: 'fake', provider: fakeProvider },
                { name: 'fake-alt', provider: fakeAltProvider }
            ],
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

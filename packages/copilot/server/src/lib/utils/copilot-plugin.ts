import { join } from 'node:path';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import type { ModelResolver } from '@ortha-cms/copilot-domain';
import { CopilotModule } from '../copilot.module';
import type { ProviderRegistration } from '../infrastructure/model-registry';
import type { CopilotPluginConfig } from '../types/copilot-config';

/** The copilot plugin shape, with its config attached. */
export type CopilotServerPluginDefinition = ServerPlugin & {
    copilotConfig: CopilotPluginConfig;
};

/** Options the host passes to {@link CopilotPlugin}. */
export interface CopilotPluginOptions {
    /**
     * The model backends this deployment can reach, in preference order. Each
     * entry pairs an operator-chosen name with an already-constructed adapter,
     * so the plugin never learns which adapters exist — register two of the
     * same kind (`ollama-fast`, `ollama-big`) freely.
     */
    providers: readonly ProviderRegistration[];
    /** Optional custom handler picking a provider per run (plain code). */
    resolve?: ModelResolver;
    /** Host config (kill switch + default provider + output ceiling). */
    config: CopilotPluginConfig;
}

/**
 * Validate the wiring **eagerly** (like `ContentPlugin`'s registry and
 * `I18nServerPlugin`'s locales): a `defaultProvider` naming a provider nobody
 * registered, or a provider declaring no models, is a misconfiguration that
 * should fail at construction — before boot — rather than on the first chat
 * message, where it is most expensive to diagnose.
 *
 * Name uniqueness is enforced by `buildModelRegistry`, which the module builds
 * from the same list.
 */
function assertOptions(options: CopilotPluginOptions): void {
    const names = options.providers.map((entry) => entry.name);
    if (names.length === 0) {
        throw new Error(
            'CopilotPlugin requires at least one model provider. Register one at the composition root, ' +
                "e.g. `providers: [{ name: 'fake', provider: createFakeProvider() }]`."
        );
    }
    for (const entry of options.providers) {
        if (entry.provider.models().length === 0) {
            throw new Error(
                `Copilot model provider "${entry.name}" declares no models. Configure at least one.`
            );
        }
    }
    if (!options.config.defaultProvider) {
        throw new Error(
            'CopilotPlugin requires `config.defaultProvider` to name one of the registered providers. ' +
                `Registered: ${names.join(', ')}.`
        );
    }
    if (!names.includes(options.config.defaultProvider)) {
        throw new Error(
            `CopilotPlugin's defaultProvider "${options.config.defaultProvider}" is not registered. ` +
                `Registered: ${names.join(', ')}.`
        );
    }
    if (options.config.maxOutputTokens <= 0) {
        throw new Error(
            `CopilotPlugin's maxOutputTokens must be a positive number (got ${options.config.maxOutputTokens}).`
        );
    }
}

/**
 * Creates the copilot plugin. Register it **after** `WorkspacesPlugin` (runs
 * are workspace-scoped) and `IdentityPlugin` (runs execute as the calling
 * user, with the `copilot:use` permission checked by its guard). Model
 * providers are constructed at the composition root and passed in here — the
 * plugin never imports a vendor SDK, and never learns which adapters exist
 * ([ADR-0004](../../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §1).
 *
 * **Phase 1 ships the chat vertical slice**: the SSE run route, the bounded run
 * engine, the capability profile, and the transcript tables this plugin now
 * owns and migrates.
 *
 * @example
 * ```typescript
 * CopilotPlugin({
 *     providers: [
 *         { name: 'claude', provider: createAnthropicProvider(providers.claude) },
 *         { name: 'ollama', provider: createOpenAiProvider(providers.ollama) },
 *         { name: 'fake', provider: createFakeProvider() }
 *     ],
 *     config: config.plugins.copilot
 * });
 * ```
 */
export function CopilotPlugin(
    options: CopilotPluginOptions
): CopilotServerPluginDefinition {
    assertOptions(options);
    return {
        name: 'copilot',
        module: CopilotModule.forRoot(options),
        copilotConfig: options.config,
        migrations: {
            // Lazy — only called at migrate time. Source layout: src/lib/utils
            // → ../../../migrations = <pkg>/migrations.
            dir: () => join(__dirname, '../../../migrations'),
            table: '__drizzle_migrations_copilot'
        }
    };
}

import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import type { ModelProvider, ModelResolver } from '@ortha-cms/copilot-domain';
import { CopilotModule } from '../copilot.module';
import type { CopilotPluginConfig } from '../types/copilot-config';

/** The copilot plugin shape, with its config attached. */
export type CopilotServerPluginDefinition = ServerPlugin & {
    copilotConfig: CopilotPluginConfig;
};

/** Options the host passes to {@link CopilotPlugin}. */
export interface CopilotPluginOptions {
    /** Named model providers available to this deployment. */
    providers: Record<string, ModelProvider>;
    /** Optional custom handler picking a provider per run (plain code). */
    resolve?: ModelResolver;
    /** Host config (kill switch + default provider + connection settings). */
    config: CopilotPluginConfig;
}

/**
 * Validate the wiring **eagerly** (like `ContentPlugin`'s registry and
 * `I18nServerPlugin`'s locales): a `defaultProvider` naming a provider nobody
 * registered is a misconfiguration that should fail at construction, before
 * boot, rather than on the first chat message.
 */
function assertOptions(options: CopilotPluginOptions): void {
    const names = Object.keys(options.providers);
    if (names.length === 0) {
        throw new Error(
            'CopilotPlugin requires at least one model provider. Register one at the composition root, ' +
                'e.g. `providers: { fake: createFakeProvider() }`.'
        );
    }
    if (!options.config.defaultProvider) {
        throw new Error(
            'CopilotPlugin requires `config.defaultProvider` to name one of the registered providers. ' +
                `Registered: ${names.join(', ')}.`
        );
    }
    if (
        !Object.prototype.hasOwnProperty.call(
            options.providers,
            options.config.defaultProvider
        )
    ) {
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
 * plugin never imports a vendor SDK
 * ([ADR-0004](../../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §1).
 *
 * **Phase 0 ships nothing visible.** It binds the model seam, the config and
 * the permission surface, so the chat vertical slice has something to build
 * on. It owns no tables, so it declares no migrations; adding them later is a
 * `drizzle.config.ts` plus a `migrations` descriptor, exactly as media does.
 *
 * @example
 * ```typescript
 * CopilotPlugin({
 *     providers: {
 *         anthropic: createAnthropicProvider(config.plugins.copilot.anthropic),
 *         fake: createFakeProvider()
 *     },
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
        copilotConfig: options.config
    };
}

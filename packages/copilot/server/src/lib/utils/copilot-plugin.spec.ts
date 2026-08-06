import type { ModelProvider } from '@ortha-cms/copilot-domain';
import { CopilotPlugin, type CopilotPluginOptions } from './copilot-plugin';
import type { CopilotPluginConfig } from '../types/copilot-config';

const provider = (): ModelProvider => ({
    capabilities: () =>
        Promise.resolve({
            model: 'stub',
            toolCalling: true,
            streaming: true,
            vision: false,
            contextWindow: 32_000,
            maxOutputTokens: 4_096
        }),
    // eslint-disable-next-line require-yield
    stream: async function* () {
        throw new Error('not called');
    }
});

const config = (
    overrides: Partial<CopilotPluginConfig> = {}
): CopilotPluginConfig => ({
    enabled: false,
    defaultProvider: 'fake',
    maxOutputTokens: 8_192,
    anthropic: { apiKey: '', model: 'claude-opus-5' },
    openaiCompatible: {
        baseUrl: 'http://localhost:11434/v1',
        model: 'llama3.1'
    },
    ...overrides
});

const options = (
    overrides: Partial<CopilotPluginOptions> = {}
): CopilotPluginOptions => ({
    providers: { fake: provider() },
    config: config(),
    ...overrides
});

/**
 * `CopilotPlugin` validates its wiring **eagerly** (like `I18nServerPlugin`'s
 * locales), so a misconfigured host fails at construction rather than on the
 * first chat message — the point where a broken default provider is most
 * expensive to diagnose.
 */
describe('CopilotPlugin config validation', () => {
    it('names the plugin "copilot" and carries its config', () => {
        const pluginConfig = config();
        const plugin = CopilotPlugin(options({ config: pluginConfig }));

        expect(plugin.name).toBe('copilot');
        expect(plugin.copilotConfig).toBe(pluginConfig);
    });

    it('ships no migrations — phase 0 owns no tables', () => {
        expect(CopilotPlugin(options()).migrations).toBeUndefined();
    });

    it('accepts a valid wiring', () => {
        expect(() => CopilotPlugin(options())).not.toThrow();
    });

    it('rejects an empty provider map', () => {
        expect(() => CopilotPlugin(options({ providers: {} }))).toThrow(
            /at least one model provider/
        );
    });

    it('rejects a defaultProvider nobody registered', () => {
        expect(() =>
            CopilotPlugin(
                options({ config: config({ defaultProvider: 'anthropic' }) })
            )
        ).toThrow(/"anthropic" is not registered\. Registered: fake/);
    });

    it('rejects a blank defaultProvider', () => {
        expect(() =>
            CopilotPlugin(options({ config: config({ defaultProvider: '' }) }))
        ).toThrow(/requires `config\.defaultProvider`/);
    });

    it('rejects a non-positive maxOutputTokens', () => {
        expect(() =>
            CopilotPlugin(options({ config: config({ maxOutputTokens: 0 }) }))
        ).toThrow(/must be a positive number/);
    });

    it('stays constructible while disabled — the kill switch is not a wiring error', () => {
        expect(() =>
            CopilotPlugin(options({ config: config({ enabled: false }) }))
        ).not.toThrow();
    });
});

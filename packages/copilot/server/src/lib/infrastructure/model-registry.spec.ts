import {
    UnknownModelProviderError,
    type ModelProvider
} from '@ortha-cms/copilot-domain';
import { buildModelRegistry } from './model-registry';

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

describe('buildModelRegistry', () => {
    it('resolves a registered provider by name', () => {
        const anthropic = provider();
        const registry = buildModelRegistry({ anthropic });

        expect(registry.get('anthropic')).toBe(anthropic);
        expect(registry.has('anthropic')).toBe(true);
        expect(registry.names()).toEqual(['anthropic']);
    });

    it('names the registered providers when asked for an unknown one', () => {
        const registry = buildModelRegistry({ anthropic: provider() });

        expect(() => registry.get('ollama')).toThrow(UnknownModelProviderError);
        expect(() => registry.get('ollama')).toThrow(
            /Unknown copilot model provider "ollama"\. Registered: anthropic/
        );
    });

    it('does not resolve inherited Object properties as providers', () => {
        const registry = buildModelRegistry({ fake: provider() });

        expect(registry.has('toString')).toBe(false);
        expect(() => registry.get('constructor')).toThrow(
            UnknownModelProviderError
        );
    });

    it('snapshots the map, so a later mutation cannot reroute a run', () => {
        const providers: Record<string, ModelProvider> = { fake: provider() };
        const registry = buildModelRegistry(providers);

        providers['fake'] = provider();
        providers['sneaky'] = provider();

        expect(registry.get('fake')).not.toBe(providers['fake']);
        expect(registry.has('sneaky')).toBe(false);
    });
});

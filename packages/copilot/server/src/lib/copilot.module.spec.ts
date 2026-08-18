import {
    MODEL_RESOLVER,
    type ModelRegistry,
    type ModelResolver,
    type ModelProvider
} from '@ortha-cms/copilot-domain';
import { CopilotModule } from './copilot.module';
import type { ProviderRegistration } from './infrastructure/model-registry';
import type { CopilotPluginConfig } from './types/copilot-config';

const provider = (models: string[]): ModelProvider => ({
    name: 'stub',
    models: () => models,
    capabilities: (model: string) => ({
        model,
        toolCalling: true,
        streaming: true,
        vision: false,
        contextWindow: 1_000,
        maxOutputTokens: 100
    }),
    // eslint-disable-next-line require-yield
    stream: async function* () {
        throw new Error('not called');
    }
});

const config: CopilotPluginConfig = { enabled: true, maxOutputTokens: 1_024 };

const registrations: ProviderRegistration[] = [
    { name: 'claude', provider: provider(['big', 'small']) },
    { name: 'ollama', provider: provider(['llama3.1']) },
    { name: 'fake', provider: provider(['fake-1']) }
];

/** The bound resolver, as DI would hand it to the engine. */
function resolverOf(providers: readonly ProviderRegistration[]): ModelResolver {
    const module = CopilotModule.forRoot({ providers, config });
    const bound = (module.providers ?? []).find(
        (entry): entry is { provide: symbol; useValue: ModelResolver } =>
            typeof entry === 'object' &&
            'provide' in entry &&
            entry.provide === MODEL_RESOLVER
    );
    if (!bound) {
        throw new Error('MODEL_RESOLVER was not bound');
    }
    return bound.useValue;
}

const ctx = { workspaceId: 'w1', userId: 'u1' };
const registry = {} as ModelRegistry;

/**
 * Which provider serves a run that names none. There is no `defaultProvider`
 * setting to answer that — the **registered list is the setting**, and its
 * order is the answer, so a host cannot name a backend it never registered and
 * cannot leave a name behind when it changes the list.
 */
describe('CopilotModule provider defaulting', () => {
    it('serves a run naming no provider from the first registered one', () => {
        expect(resolverOf(registrations)(ctx, registry)).toBe('claude');
    });

    it('follows the list when the host reorders it', () => {
        expect(resolverOf([...registrations].reverse())(ctx, registry)).toBe(
            'fake'
        );
    });

    it("prefers the host's own resolver over the first entry", () => {
        const module = CopilotModule.forRoot({
            providers: registrations,
            resolve: () => 'ollama',
            config
        });
        const bound = (module.providers ?? []).find(
            (entry): entry is { provide: symbol; useValue: ModelResolver } =>
                typeof entry === 'object' &&
                'provide' in entry &&
                entry.provide === MODEL_RESOLVER
        );

        expect(bound?.useValue(ctx, registry)).toBe('ollama');
    });

    it('refuses to build with no providers at all', () => {
        expect(() => CopilotModule.forRoot({ providers: [], config })).toThrow(
            /at least one model provider/
        );
    });
});

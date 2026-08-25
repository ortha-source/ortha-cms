import {
    MODEL_RESOLVER,
    type ModelRegistry,
    type ModelResolver,
    type ModelProvider
} from '@orthacms/copilot-domain';
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
    { name: 'local', provider: provider(['llama3.1-70b']) }
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
            'local'
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

    /**
     * An enabled copilot with nothing to call is a misconfiguration, and this
     * is the last place to catch it before the first chat message. It is only a
     * misconfiguration when the copilot is **on**: there is no scripted offline
     * adapter registered any more, so a deployment that configured no backend
     * reaches this constructor with an empty list, and that is the ordinary
     * state of a fresh checkout.
     */
    it('refuses to build with no providers once the copilot is on', () => {
        expect(() => CopilotModule.forRoot({ providers: [], config })).toThrow(
            /enabled but has no model provider/
        );
    });

    it('builds with no providers while the copilot is off', () => {
        expect(() =>
            CopilotModule.forRoot({
                providers: [],
                config: { ...config, enabled: false }
            })
        ).not.toThrow();
    });
});

/**
 * The operator's kill switch, applied where MCP applies its own: a disabled
 * deployment registers no controller, so every `/api/copilot/*` route 404s.
 *
 * It used to be read in one place only — `RunEngine.run` — which made "off"
 * mean *the send button returns an error frame*, with the model catalogue, the
 * conversation and skill routes and both admin surfaces still live behind it.
 */
describe('CopilotModule kill switch', () => {
    it('registers the routes when the copilot is on', () => {
        const module = CopilotModule.forRoot({
            providers: registrations,
            config: { ...config, enabled: true }
        });

        expect(module.controllers?.length).toBeGreaterThan(0);
    });

    it('registers no controller at all when it is off', () => {
        const module = CopilotModule.forRoot({
            providers: registrations,
            config: { ...config, enabled: false }
        });

        expect(module.controllers).toEqual([]);
    });

    it('still binds the model registry and resolver when it is off', () => {
        // The switch takes away the *routes*, not the wiring. A disabled
        // deployment must still construct: the module is global, the shared
        // `ToolsModule` is imported rather than provided, and the MCP endpoint
        // serves the same tool catalogue either way.
        const module = CopilotModule.forRoot({
            providers: registrations,
            config: { ...config, enabled: false }
        });

        expect(module.imports).toBeDefined();
        expect(
            (module.providers ?? []).some(
                (entry) =>
                    typeof entry === 'object' &&
                    'provide' in entry &&
                    entry.provide === MODEL_RESOLVER
            )
        ).toBe(true);
    });
});

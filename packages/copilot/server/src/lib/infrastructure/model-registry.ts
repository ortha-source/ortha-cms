import {
    UnknownModelProviderError,
    type ModelProvider,
    type ModelRegistry
} from '@ortha-cms/copilot-domain';

/**
 * Builds an immutable {@link ModelRegistry} over a name→provider map. Bound to
 * `MODEL_REGISTRY` at the composition root; the resolver returns a name, the
 * core looks the provider up here. Structurally identical to media's
 * `buildRegistry`, by decision
 * ([ADR-0004](../../../../../docs/adr/0004-model-agnostic-copilot-provider.md)).
 */
export function buildModelRegistry(
    providers: Record<string, ModelProvider>
): ModelRegistry {
    // Snapshot the map so a later mutation of the caller's object can't change
    // which provider a run resolves to mid-flight. The snapshot has a **null
    // prototype**, so a lookup of `constructor` or `toString` misses instead
    // of returning something off `Object.prototype` that is not a provider.
    const entries: Record<string, ModelProvider> = Object.assign(
        Object.create(null) as Record<string, ModelProvider>,
        providers
    );

    return {
        get(name: string): ModelProvider {
            const provider = entries[name];
            if (!provider) {
                throw new UnknownModelProviderError(name, Object.keys(entries));
            }
            return provider;
        },
        has(name: string): boolean {
            return Object.prototype.hasOwnProperty.call(entries, name);
        },
        names(): string[] {
            return Object.keys(entries);
        }
    };
}

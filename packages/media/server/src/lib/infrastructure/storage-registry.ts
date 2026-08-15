import type {
    StorageProvider,
    StorageRegistry
} from '../domain/storage-provider';

/**
 * Builds an immutable {@link StorageRegistry} over a name→provider map. Bound
 * to `STORAGE_REGISTRY` at the composition root; the resolver returns a name,
 * the core looks the provider up here.
 */
export function buildRegistry(
    providers: Record<string, StorageProvider>
): StorageRegistry {
    return {
        get(name: string): StorageProvider {
            // `hasOwn`, not a bare index — matching `has` below. A bare
            // `providers['constructor']` resolves a prototype member, which is
            // truthy and would be returned as if it were a provider; the name
            // comes from a DB column or the host's resolver, so that is a
            // corrupt-row away rather than user input, but the two accessors
            // disagreeing is a trap either way.
            if (!Object.hasOwn(providers, name)) {
                throw new Error(`Unknown storage provider: ${name}`);
            }
            return providers[name] as StorageProvider;
        },
        has(name: string): boolean {
            return Object.hasOwn(providers, name);
        },
        names(): string[] {
            return Object.keys(providers);
        }
    };
}

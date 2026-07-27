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
            const provider = providers[name];
            if (!provider) {
                throw new Error(`Unknown storage provider: ${name}`);
            }
            return provider;
        },
        has(name: string): boolean {
            return Object.prototype.hasOwnProperty.call(providers, name);
        },
        names(): string[] {
            return Object.keys(providers);
        }
    };
}

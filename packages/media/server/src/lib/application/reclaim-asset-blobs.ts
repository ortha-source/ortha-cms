import type { Asset } from '../domain/asset';
import type { StorageRegistry } from '../domain/storage-provider';

/**
 * Removes every blob one deleted asset owns — the original **and** each
 * generated derivative (`Asset.storageKeys`) — through the provider that holds
 * them. Shared by the two paths that delete assets (a bulk delete, and a folder
 * cascade) so neither can forget the derivatives.
 *
 * Always called **post-commit** and always best-effort: the row is already gone,
 * so a failed blob delete leaves an orphan for GC rather than an error the
 * caller can do anything about.
 */
export async function reclaimAssetBlobs(
    registry: StorageRegistry,
    asset: Asset
): Promise<void> {
    try {
        const provider = registry.get(asset.storageProvider);
        await Promise.all(asset.storageKeys.map((key) => provider.remove(key)));
    } catch {
        // Orphaned blob; nothing useful to report at this point.
    }
}

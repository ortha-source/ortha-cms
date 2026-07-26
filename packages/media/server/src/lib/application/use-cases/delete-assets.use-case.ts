import { Inject, Injectable } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import type { PublicUser } from '@ortha-cms/identity-server';
import { Asset } from '../../domain/asset';
import { AssetId } from '../../domain/value-objects/asset-id';
import {
    ASSET_REPOSITORY,
    type AssetRepository
} from '../../domain/asset.repository';
import {
    STORAGE_REGISTRY,
    type StorageRegistry
} from '../../domain/storage-provider';

/**
 * Bulk-deletes assets. The rows and their `media.asset.deleted` events commit
 * atomically; each blob is then reclaimed **post-commit** through the provider
 * that holds it — so a rolled-back delete never destroys bytes for a row that
 * still exists.
 */
@Injectable()
export class DeleteAssetsUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(ASSET_REPOSITORY) private readonly assets: AssetRepository,
        @Inject(STORAGE_REGISTRY) private readonly registry: StorageRegistry
    ) {}

    /** Runs the delete. Returns the number of assets actually removed. */
    async execute(
        ids: string[],
        workspaceId: string,
        actor: PublicUser
    ): Promise<number> {
        const assetIds = ids.map((id) => AssetId.create(id));

        const removed = await this.uow.run(async () => {
            const found = await this.assets.findManyByIds(
                assetIds,
                workspaceId
            );
            for (const asset of found) {
                asset.markDeleted();
                await this.assets.delete(asset);
                await this.outbox.append(
                    attachActor(asset.pullEvents(), actor)
                );
            }
            return found;
        });

        await Promise.all(removed.map((asset) => this.reclaim(asset)));
        return removed.length;
    }

    private async reclaim(asset: Asset): Promise<void> {
        try {
            const provider = this.registry.get(asset.storageProvider);
            // The original plus every generated derivative (thumb/preview).
            await Promise.all(
                asset.storageKeys.map((key) => provider.remove(key))
            );
        } catch {
            // Best-effort: a failed blob delete leaves an orphan for GC, never
            // an error to the caller (the row is already gone).
        }
    }
}

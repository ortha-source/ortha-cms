import { Inject, Injectable } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import type { PublicUser } from '@ortha-cms/identity-server';
import { AssetId } from '../../domain/value-objects/asset-id';
import {
    ASSET_REPOSITORY,
    type AssetRepository
} from '../../domain/asset.repository';
import {
    STORAGE_REGISTRY,
    type StorageRegistry
} from '../../domain/storage-provider';
import { reclaimManyAssetBlobs } from '../reclaim-asset-blobs';

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

        // Bounded fan-out: 100 ids is 300+ blobs, which is a lot of concurrent
        // provider calls to open in one tick for work nobody is waiting on.
        await reclaimManyAssetBlobs(this.registry, removed);
        return removed.length;
    }
}

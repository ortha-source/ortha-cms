import { Inject, Injectable } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@orthacms/database';
import type { PublicUser } from '@orthacms/identity-server';
import { Asset, type AssetVariants } from '../../domain/asset';
import { AssetId } from '../../domain/value-objects/asset-id';
import { FileName } from '../../domain/value-objects/file-name';
import { StorageKey } from '../../domain/value-objects/storage-key';
import { AssetNotFoundError } from '../../domain/errors/asset-not-found.error';
import {
    ASSET_REPOSITORY,
    type AssetRepository
} from '../../domain/asset.repository';
import {
    STORAGE_REGISTRY,
    STORAGE_RESOLVER,
    type StorageRegistry,
    type StorageResolver
} from '../../domain/storage-provider';

/** Inserts " copy" before the extension (or appends it when there is none). */
function duplicateName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot > 0
        ? `${name.slice(0, dot)} copy${name.slice(dot)}`
        : `${name} copy`;
}

/**
 * Duplicates an asset — copies the bytes to a fresh key (via the resolver) and
 * inserts a new row in the same folder, carrying over kind/mime/tags/alt/dims.
 * Returns the new asset id.
 */
@Injectable()
export class DuplicateAssetUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(STORAGE_REGISTRY) private readonly registry: StorageRegistry,
        @Inject(STORAGE_RESOLVER) private readonly resolve: StorageResolver,
        @Inject(ASSET_REPOSITORY) private readonly assets: AssetRepository
    ) {}

    /** Runs the duplicate. Throws when the source asset is absent. */
    async execute(
        assetId: string,
        workspaceId: string,
        actor: PublicUser
    ): Promise<string> {
        const source = await this.assets.findById(
            AssetId.create(assetId),
            workspaceId
        );
        if (!source) {
            throw new AssetNotFoundError(assetId);
        }

        // Built as a `FileName` **before** anything touches storage: `" copy"`
        // can push a 255-char name over the limit, and the value object is the
        // only thing that says so. Left until the transaction, the over-long
        // name reached the provider first and blew up as an unmapped
        // `ENAMETOOLONG` — a 500 for what is a 400.
        const copyName = FileName.create(duplicateName(source.name.value));
        const newId = AssetId.generate();
        const providerName = this.resolve(
            {
                workspaceId,
                folderId: source.folderId?.value ?? null,
                fileName: copyName.value,
                contentType: source.mimeType,
                kind: source.kind.value,
                size: source.size
            },
            this.registry
        );
        const provider = this.registry.get(providerName);
        const sourceProvider = this.registry.get(source.storageProvider);

        // Track every copied blob so a rolled-back duplicate reclaims all of
        // them, not just the original.
        const written: string[] = [];
        try {
            const sourceStream = await sourceProvider.get(
                source.storageKey.value
            );
            const stored = await provider.put({
                workspaceId,
                assetId: newId.value,
                fileName: copyName.value,
                contentType: source.mimeType,
                body: sourceStream
            });
            written.push(stored.storageKey);

            // Copy each derivative to the new asset, keeping the same variant
            // names + dimensions so the copy renders without re-processing.
            const variants: AssetVariants = {};
            for (const [name, variant] of Object.entries(source.variants)) {
                const put = await provider.put({
                    workspaceId,
                    assetId: newId.value,
                    fileName: `${name}.webp`,
                    contentType: 'image/webp',
                    body: await sourceProvider.get(variant.key),
                    isVariant: true
                });
                written.push(put.storageKey);
                variants[name] = {
                    key: put.storageKey,
                    width: variant.width,
                    height: variant.height,
                    size: put.size
                };
            }

            return await this.uow.run(async () => {
                const copy = Asset.create({
                    id: newId,
                    workspaceId,
                    folderId: source.folderId,
                    name: copyName,
                    storageKey: StorageKey.create(stored.storageKey),
                    storageProvider: providerName,
                    kind: source.kind,
                    mimeType: source.mimeType,
                    size: stored.size,
                    checksum: stored.checksum,
                    uploadedBy: actor.id,
                    media: source.media,
                    variants
                });
                if (source.tags.length > 0) copy.retag(source.tags);
                if (source.alt) copy.setAlt(source.alt);
                await this.assets.save(copy);
                await this.outbox.append(attachActor(copy.pullEvents(), actor));
                return copy.id.value;
            });
        } catch (error) {
            await Promise.all(
                written.map((key) =>
                    provider.remove(key).catch(() => undefined)
                )
            );
            throw error;
        }
    }
}

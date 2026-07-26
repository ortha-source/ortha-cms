import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PassThrough, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type {
    PutObject,
    StorageProvider,
    StoredObject
} from '@ortha-cms/media-server';

/** Local filesystem provider settings. */
export interface LocalStorageConfig {
    /** Directory blobs live under (absolute or project-relative). */
    rootDir: string;
    /** Base path the browser hits to stream a blob (reserved for direct URLs). */
    publicBasePath: string;
}

/** Reduces a file name to a safe key segment (no separators or exotic chars). */
function sanitize(name: string): string {
    return name.replace(/[^\w.-]+/g, '_');
}

/**
 * The default {@link StorageProvider}: streams blobs to a directory on disk,
 * keyed `<workspaceId>/<assetId>/<filename>` so they stay workspace-partitioned
 * and collision-free. Computes size + sha256 as it writes. Bound at the
 * composition root; the media core depends only on the `StorageProvider` port.
 */
export function createLocalStorageProvider(
    config: LocalStorageConfig
): StorageProvider {
    const keyFor = (
        workspaceId: string,
        assetId: string,
        fileName: string,
        isVariant: boolean
    ) =>
        isVariant
            ? // Derivatives live in a reserved `variants/` sub-namespace, so
              // they can never collide with the original blob's key.
              `${workspaceId}/${assetId}/variants/${sanitize(fileName)}`
            : `${workspaceId}/${assetId}/${sanitize(fileName)}`;
    const absolute = (storageKey: string) => join(config.rootDir, storageKey);

    return {
        async put(object: PutObject): Promise<StoredObject> {
            const storageKey = keyFor(
                object.workspaceId,
                object.assetId,
                object.fileName,
                object.isVariant ?? false
            );
            const target = absolute(storageKey);
            await mkdir(dirname(target), { recursive: true });

            const hash = createHash('sha256');
            let size = 0;
            const meter = new PassThrough();
            meter.on('data', (chunk: Buffer) => {
                size += chunk.length;
                hash.update(chunk);
            });

            await pipeline(object.body, meter, createWriteStream(target));
            return { storageKey, size, checksum: hash.digest('hex') };
        },

        async get(storageKey: string): Promise<Readable> {
            return createReadStream(absolute(storageKey));
        },

        async remove(storageKey: string): Promise<void> {
            await rm(absolute(storageKey), { force: true });
        },

        async url(storageKey: string): Promise<string> {
            // The default download path streams through the app's own route;
            // this direct URL is reserved for a future static-serving mode.
            return `${config.publicBasePath}/blob/${encodeURIComponent(storageKey)}`;
        }
    };
}

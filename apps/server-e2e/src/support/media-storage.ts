import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type {
    PutObject,
    StorageProvider,
    StoredObject
} from '@ortha-cms/media-server';

/** Reads a stream fully into a Buffer (the test provider buffers in memory). */
async function drain(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * The store backing the most recently built provider.
 *
 * `buildTestPlugins` constructs the provider, so a spec has no reference to the
 * `Map` it closes over — which left "delete removed the bytes" unassertable, and
 * left the bytes themselves outliving the `media_asset` rows `resetDb`
 * truncates. Jest isolates module registries per spec file, so this is per-file,
 * exactly like the app it belongs to.
 */
let latestStore: Map<string, Buffer> | undefined;

/** The keys currently held in memory — the assertion surface for delete. */
export function blobStoreKeys(): string[] {
    return [...(latestStore?.keys() ?? [])];
}

/**
 * Drop every stored blob. Called by `resetDb`, so a blob cannot outlive the row
 * that named it and satisfy a download the database says was deleted.
 */
export function resetBlobStore(): void {
    latestStore?.clear();
}

/**
 * An in-memory {@link StorageProvider} for the e2e harness — a `Map<key, bytes>`
 * so upload/download/delete round-trip without touching the disk or a real
 * object store. Registered under the name `memory` (the media config's
 * `defaultProvider` in the test config). One instance per booted app, so blobs
 * are isolated per spec file.
 */
export function createInMemoryStorageProvider(): StorageProvider {
    const store = new Map<string, Buffer>();
    latestStore = store;
    return {
        async put(object: PutObject): Promise<StoredObject> {
            const buffer = await drain(object.body);
            const storageKey = `${object.workspaceId}/${object.assetId}/${object.fileName}`;
            store.set(storageKey, buffer);
            return {
                storageKey,
                size: buffer.length,
                checksum: createHash('sha256').update(buffer).digest('hex')
            };
        },
        async get(storageKey: string): Promise<Readable> {
            const buffer = store.get(storageKey);
            if (!buffer) {
                throw new Error(`No stored object for key: ${storageKey}`);
            }
            return Readable.from(buffer);
        },
        async remove(storageKey: string): Promise<void> {
            store.delete(storageKey);
        },
        async url(storageKey: string): Promise<string> {
            return `memory://${storageKey}`;
        }
    };
}

import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type {
    PutObject,
    StorageProvider,
    StoredObject
} from '@orthacms/media-server';

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
 * object store. Identifies itself as `memory`, which is what every asset row a
 * test writes records. One instance per booted app, so blobs are isolated per
 * spec file.
 */
export function createInMemoryStorageProvider(): StorageProvider {
    const store = new Map<string, Buffer>();
    latestStore = store;
    return {
        id: 'memory',
        capabilities: {
            directUrl: false,
            contentTypeMetadata: false,
            streamingPut: false
        },

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
        }
    };
}

/** Where the signing provider below pretends its bucket lives. */
export const SIGNED_URL_HOST = 'https://signed.test';

/**
 * The in-memory provider, wrapped so it can mint a "signed" URL.
 *
 * Direct serve is a decision the *route* makes — whether to redirect, and with
 * what disposition — and that decision is what these suites are about. A real
 * signature would prove nothing extra here and would need a bucket; instead the
 * URL simply carries back the options the route asked to pin, so a suite can
 * assert that an uploaded `.html` is signed as an attachment and a PNG inline.
 */
export function createSigningStorageProvider(): StorageProvider {
    const inner = createInMemoryStorageProvider();
    return {
        ...inner,
        capabilities: { ...inner.capabilities, directUrl: true },
        async directUrl(storageKey, options) {
            const query = new URLSearchParams({
                disposition: options.disposition,
                type: options.contentType,
                name: options.fileName,
                ttl: String(options.expiresInSeconds)
            });
            return `${SIGNED_URL_HOST}/${storageKey}?${query.toString()}`;
        }
    };
}

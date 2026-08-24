import { Readable } from 'node:stream';
import type { ContainerClient } from '@azure/storage-blob';

/** One blob, as the fake holds it. */
interface FakeBlob {
    body: Buffer;
    contentType?: string;
}

/** The error shape Azure uses for a blob that is not there. */
function blobNotFound(): Error {
    return Object.assign(new Error('BlobNotFound'), {
        statusCode: 404,
        details: { errorCode: 'BlobNotFound' }
    });
}

/** Drains an upload stream into one buffer. */
async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as Readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * A stand-in `ContainerClient` covering the four calls this adapter makes.
 *
 * Azure's client is a class tree, so — unlike the S3 adapter, where a real
 * client with a stubbed `send` keeps the SDK's own middleware in play — the
 * seam here is the container client itself, which the provider already accepts
 * for managed-identity deployments. That means these tests drive the same
 * injection point a real caller uses, rather than a private hook.
 *
 * It proves this adapter's logic and nothing about Azure: **Azurite** and one
 * real storage account are the acceptance step, and are named in `AGENTS.md`.
 */
export class FakeContainerClient {
    readonly blobs = new Map<string, FakeBlob>();
    readonly containerName = 'media';
    /** Flip to make `getProperties` fail, as a missing container would. */
    exists = true;
    /** Make the next upload fail, to exercise the cleanup path. */
    failNextUpload = false;
    /** Blob names `deleteIfExists` was called for, in order. */
    readonly deleted: string[] = [];

    getBlockBlobClient(blobName: string) {
        // Arrow properties, so `this` stays the fake without aliasing it.
        return {
            url: `https://account.blob.core.windows.net/${this.containerName}/${blobName}`,
            uploadStream: async (
                stream: NodeJS.ReadableStream,
                _bufferSize?: number,
                _concurrency?: number,
                options?: { blobHTTPHeaders?: { blobContentType?: string } }
            ) => {
                // Drained even when the upload is set to fail: a real client
                // reads the stream before it errors, and not reading it would
                // leave the provider's meter unfed and its `size` at zero.
                const body = await collect(stream);
                if (this.failNextUpload) {
                    this.failNextUpload = false;
                    throw Object.assign(new Error('upload failed'), {
                        statusCode: 500
                    });
                }
                this.blobs.set(blobName, {
                    body,
                    contentType: options?.blobHTTPHeaders?.blobContentType
                });
                return {};
            },
            download: async () => {
                const blob = this.blobs.get(blobName);
                if (!blob) throw blobNotFound();
                return { readableStreamBody: Readable.from(blob.body) };
            },
            deleteIfExists: async () => {
                this.deleted.push(blobName);
                return { succeeded: this.blobs.delete(blobName) };
            }
        };
    }

    async getProperties() {
        if (!this.exists) throw blobNotFound();
        return {};
    }

    /** Blob names currently held, sorted. */
    keys(): string[] {
        return [...this.blobs.keys()].sort();
    }

    /** Presents as the real thing to a provider that only uses the above. */
    asContainerClient(): ContainerClient {
        return this as unknown as ContainerClient;
    }
}

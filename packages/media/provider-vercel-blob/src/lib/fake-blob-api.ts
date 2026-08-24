import { Readable } from 'node:stream';
import { BlobNotFoundError } from '@vercel/blob';
import type { VercelBlobApi } from './vercel-blob-storage-provider';

/** One blob, as the fake holds it. */
interface FakeBlob {
    body: Buffer;
    contentType?: string;
}

/** Drains an upload body into one buffer. */
async function collect(body: unknown): Promise<Buffer> {
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body);
    const chunks: Buffer[] = [];
    for await (const chunk of body as Readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * A stand-in for the three `@vercel/blob` functions this adapter calls, plus a
 * `fetch` that serves what they stored.
 *
 * The SDK exports free functions rather than a client, so the seam is the small
 * `VercelBlobApi` interface the provider already accepts — the same one a
 * caller could substitute to route through their own transport.
 *
 * It proves this adapter's logic and nothing about Vercel Blob. A real store is
 * the acceptance step, and `AGENTS.md` says so.
 */
export class FakeBlobApi {
    readonly blobs = new Map<string, FakeBlob>();
    /** Base the fake's public URLs hang off. */
    readonly host = 'https://fake.public.blob.vercel-storage.com';
    /** Make the next `put` fail, to exercise the cleanup path. */
    failNextPut = false;
    /** Pathnames `del` was called for, in order. */
    readonly deleted: string[] = [];
    /** Raised by `head` when set — anything that is not "missing". */
    headError: Error | undefined;

    readonly api: VercelBlobApi = {
        put: (async (
            pathname: string,
            body: unknown,
            options?: { contentType?: string }
        ) => {
            const bytes = await collect(body);
            if (this.failNextPut) {
                this.failNextPut = false;
                throw new Error('put failed');
            }
            this.blobs.set(pathname, {
                body: bytes,
                contentType: options?.contentType
            });
            return {
                url: `${this.host}/${pathname}`,
                pathname,
                contentType: options?.contentType
            };
        }) as unknown as VercelBlobApi['put'],

        head: (async (pathname: string) => {
            if (this.headError) throw this.headError;
            const blob = this.blobs.get(pathname);
            if (!blob) {
                throw new BlobNotFoundError();
            }
            return {
                url: `${this.host}/${pathname}`,
                pathname,
                size: blob.body.byteLength,
                contentType: blob.contentType
            };
        }) as unknown as VercelBlobApi['head'],

        del: (async (pathname: string | string[]) => {
            for (const one of Array.isArray(pathname) ? pathname : [pathname]) {
                this.deleted.push(one);
                this.blobs.delete(one);
            }
        }) as unknown as VercelBlobApi['del']
    };

    /** Serves the fake's blobs, so `get` can be exercised end to end. */
    fetch = (input: string | URL): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        const pathname = url.slice(this.host.length + 1);
        const blob = this.blobs.get(pathname);
        if (!blob) {
            return Promise.resolve(new Response(null, { status: 404 }));
        }
        return Promise.resolve(
            new Response(new Uint8Array(blob.body), { status: 200 })
        );
    };

    /** Pathnames currently held, sorted. */
    keys(): string[] {
        return [...this.blobs.keys()].sort();
    }
}

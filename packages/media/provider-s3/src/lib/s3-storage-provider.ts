import type { Readable } from 'node:stream';
import type { StorageProvider, StoredObject } from '@orthacms/media-server';

/** AWS S3 provider settings. */
export interface S3StorageConfig {
    bucket: string;
    region: string;
}

/** Raised by every method until the AWS adapter is implemented. */
class S3NotImplementedError extends Error {
    constructor() {
        super(
            '@orthacms/media-provider-s3 is a stub — the S3 adapter is not implemented yet.'
        );
        this.name = 'S3NotImplementedError';
    }
}

/**
 * Placeholder S3 {@link StorageProvider}. It proves the seam end-to-end — the
 * composition root can construct it and hand it to `MediaServerPlugin` — without
 * an AWS dependency. Every method throws until the real adapter (streaming
 * put/get, signed `directUrl`) lands. The signature matches
 * `createLocalStorageProvider`, so switching is one line in `plugins.ts`.
 *
 * Its `capabilities` say what this *stub* can do, not what S3 can: declaring
 * `directUrl: true` here would make the plugin's eager check pass and the
 * download route offer a redirect nothing can mint.
 */
export function createS3StorageProvider(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: S3StorageConfig
): StorageProvider {
    // Implementations omit their params (the interface allows a narrower
    // signature) — there is nothing to act on until the real adapter lands.
    return {
        id: 's3',
        capabilities: {
            directUrl: false,
            contentTypeMetadata: false,
            streamingPut: false
        },
        put(): Promise<StoredObject> {
            throw new S3NotImplementedError();
        },
        get(): Promise<Readable> {
            throw new S3NotImplementedError();
        },
        remove(): Promise<void> {
            throw new S3NotImplementedError();
        },
        verify(): Promise<void> {
            // Fails the boot rather than the first upload — the whole point of
            // the hook, and the honest answer for a stub.
            throw new S3NotImplementedError();
        }
    };
}

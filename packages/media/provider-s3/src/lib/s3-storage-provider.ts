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
            '@orthacms/media-provider-s3 is a stub — the AWS S3 adapter is not implemented yet.'
        );
        this.name = 'S3NotImplementedError';
    }
}

/**
 * Placeholder S3 {@link StorageProvider}. It proves the routing seam
 * end-to-end — the composition root can register it under a name and a resolver
 * can route to it — without an AWS dependency. Every method throws until the
 * real adapter (put/get via the AWS SDK, signed `url`) lands. The signature
 * matches `createLocalStorageProvider`, so switching is a config change.
 */
export function createS3StorageProvider(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: S3StorageConfig
): StorageProvider {
    // Implementations omit their params (the interface allows a narrower
    // signature) — there is nothing to act on until the AWS adapter lands.
    return {
        put(): Promise<StoredObject> {
            throw new S3NotImplementedError();
        },
        get(): Promise<Readable> {
            throw new S3NotImplementedError();
        },
        remove(): Promise<void> {
            throw new S3NotImplementedError();
        },
        url(): Promise<string> {
            throw new S3NotImplementedError();
        }
    };
}

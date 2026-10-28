// orthacms:if media-local
import type { LocalStorageConfig } from '@orthacms/media-provider-local';
import { localStorageFromEnv } from '@orthacms/config';

/**
 * Where uploads are written (`MEDIA_LOCAL_ROOT`). Point it at a persistent
 * volume in production: a container's own disk is wiped on every deploy.
 */
export function mediaStorage(): LocalStorageConfig {
    return localStorageFromEnv();
}
// orthacms:end
// orthacms:if media-vercel-blob
import type { VercelBlobStorageConfig } from '@orthacms/media-provider-vercel-blob';
import { vercelBlobStorageFromEnv } from '@orthacms/config';

/**
 * Vercel Blob. On Vercel the SDK reads `BLOB_READ_WRITE_TOKEN` itself, so the
 * variable is only for running the app elsewhere.
 */
export function mediaStorage(): VercelBlobStorageConfig {
    return vercelBlobStorageFromEnv();
}
// orthacms:end
// orthacms:if media-gcs
import type { GcsStorageConfig } from '@orthacms/media-provider-gcs';
import { gcsStorageFromEnv } from '@orthacms/config';

/**
 * Google Cloud Storage. With no key file the client uses Application Default
 * Credentials, which is what a GKE or Cloud Run deployment wants.
 */
export function mediaStorage(): GcsStorageConfig {
    return gcsStorageFromEnv();
}
// orthacms:end
// orthacms:if media-azure
import type { AzureStorageConfig } from '@orthacms/media-provider-azure';
import { azureStorageFromEnv } from '@orthacms/config';

/** Azure Blob Storage, by connection string. */
export function mediaStorage(): AzureStorageConfig {
    return azureStorageFromEnv();
}
// orthacms:end
// orthacms:if media-s3
import type { S3StorageConfig } from '@orthacms/media-provider-s3';
import { s3StorageFromEnv } from '@orthacms/config';

/**
 * Any S3-compatible bucket. Leave the keys unset on a host with an instance
 * role or IRSA: absent means the SDK's own provider chain, and blanks would
 * shadow it with credentials that cannot sign.
 */
export function mediaStorage(): S3StorageConfig {
    return s3StorageFromEnv();
}
// orthacms:end

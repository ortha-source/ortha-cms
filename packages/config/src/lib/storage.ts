import {
    defined,
    readEnum,
    readEnv,
    readFlag,
    requireEnv
} from '@orthacms/utils-server';

/** `@orthacms/media-provider-local`'s settings. */
export interface LocalStorageSettings {
    rootDir: string;
}

/** Where local uploads go (`MEDIA_LOCAL_ROOT`). */
export function localStorageFromEnv(): LocalStorageSettings {
    return { rootDir: readEnv('MEDIA_LOCAL_ROOT') ?? './.storage/media' };
}

/** `@orthacms/media-provider-s3`'s settings. */
export interface S3StorageSettings {
    bucket: string;
    region: string;
    endpoint?: string;
    forcePathStyle: boolean;
    credentials?: { accessKeyId: string; secretAccessKey: string };
}

/**
 * The S3-compatible bucket. Credentials are passed only when both keys are
 * set: absent means the SDK's own chain (an instance role, IRSA), and blanks
 * would shadow it with keys that cannot sign.
 */
export function s3StorageFromEnv(): S3StorageSettings {
    const accessKeyId = readEnv('MEDIA_S3_ACCESS_KEY_ID');
    const secretAccessKey = readEnv('MEDIA_S3_SECRET_ACCESS_KEY');
    return defined({
        bucket: requireEnv('MEDIA_S3_BUCKET'),
        region: readEnv('MEDIA_S3_REGION') ?? 'auto',
        endpoint: readEnv('MEDIA_S3_ENDPOINT'),
        forcePathStyle: readFlag('MEDIA_S3_FORCE_PATH_STYLE', false),
        credentials:
            accessKeyId && secretAccessKey
                ? { accessKeyId, secretAccessKey }
                : undefined
    });
}

/** `@orthacms/media-provider-gcs`'s settings. */
export interface GcsStorageSettings {
    bucket: string;
    projectId?: string;
    keyFilename?: string;
    signWithIam: boolean;
}

/**
 * The Cloud Storage bucket. With no key file the client uses Application
 * Default Credentials, which is what GKE and Cloud Run want.
 */
export function gcsStorageFromEnv(): GcsStorageSettings {
    return defined({
        bucket: requireEnv('MEDIA_GCS_BUCKET'),
        projectId: readEnv('MEDIA_GCS_PROJECT_ID'),
        keyFilename: readEnv('MEDIA_GCS_KEY_FILE'),
        signWithIam: readFlag('MEDIA_GCS_SIGN_WITH_IAM', false)
    });
}

/** `@orthacms/media-provider-azure`'s settings. */
export interface AzureStorageSettings {
    container: string;
    connectionString: string;
}

/** The Azure blob container. */
export function azureStorageFromEnv(): AzureStorageSettings {
    return {
        container: requireEnv('MEDIA_AZURE_CONTAINER'),
        connectionString: requireEnv('MEDIA_AZURE_CONNECTION_STRING')
    };
}

/** `@orthacms/media-provider-vercel-blob`'s settings. */
export interface VercelBlobStorageSettings {
    token?: string;
}

/** The Vercel Blob token, which the SDK reads itself on Vercel. */
export function vercelBlobStorageFromEnv(): VercelBlobStorageSettings {
    return defined({ token: readEnv('BLOB_READ_WRITE_TOKEN') });
}

/**
 * How a download reaches the browser (`MEDIA_DIRECT_SERVE`). `signed-url` on a
 * backend that cannot sign is a boot error from the media plugin, on purpose.
 */
export function directServeFromEnv(): 'off' | 'signed-url' {
    return readEnum('MEDIA_DIRECT_SERVE', ['off', 'signed-url'], 'off');
}

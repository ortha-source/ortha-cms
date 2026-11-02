/** Media — the storage backend, plus how downloads and uploads are bounded. */
import type { MediaPluginConfig } from '@orthacms/media-server';
// orthacms:if media-local
import type { LocalStorageConfig } from '@orthacms/media-provider-local';
// orthacms:end
// orthacms:if media-s3
import type { S3StorageConfig } from '@orthacms/media-provider-s3';
// orthacms:end
// orthacms:if media-azure
import type { AzureStorageConfig } from '@orthacms/media-provider-azure';
// orthacms:end
// orthacms:if media-gcs
import type { GcsStorageConfig } from '@orthacms/media-provider-gcs';
// orthacms:end
// orthacms:if media-vercel-blob
import type { VercelBlobStorageConfig } from '@orthacms/media-provider-vercel-blob';
// orthacms:end
import { directServeFromEnv } from '@orthacms/config';

import { mediaStorage } from './media-storage';

/**
 * Media settings, plus whatever the storage backend `src/plugins.ts`
 * constructs needs. The two move together: the type below is the one exported
 * by the adapter that file imports.
 */
export interface AppMediaConfig extends MediaPluginConfig {
    // orthacms:if media-local
    storage: LocalStorageConfig;
    // orthacms:end
    // orthacms:if media-s3
    storage: S3StorageConfig;
    // orthacms:end
    // orthacms:if media-azure
    storage: AzureStorageConfig;
    // orthacms:end
    // orthacms:if media-gcs
    storage: GcsStorageConfig;
    // orthacms:end
    // orthacms:if media-vercel-blob
    storage: VercelBlobStorageConfig;
    // orthacms:end
}

/** Media — the storage backend, plus how downloads and uploads are bounded. */
export function mediaConfig(): AppMediaConfig {
    return {
        storage: mediaStorage(),
        // Redirect an already-authorized download straight to the storage
        // backend instead of streaming it through the app. Off unless asked
        // for, and only possible on a backend that can sign a URL — the plugin
        // refuses the combination at boot rather than proxying while the
        // operator believes otherwise.
        directServe: directServeFromEnv(),
        // How long a signed download URL stays valid, and the upload cap.
        directServeTtlSeconds: 300,
        maxUploadBytes: 50 * 1024 * 1024
    };
}

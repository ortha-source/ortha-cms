import {
    createMemoryStorageProvider,
    type MemoryStorageProvider
} from '@orthacms/media-provider-memory';

/**
 * The provider backing the most recently booted app.
 *
 * `buildTestPlugins` constructs it, so a spec has no reference to the instance
 * it closes over — which left "delete removed the bytes" unassertable, and left
 * the bytes themselves outliving the `media_asset` rows `resetDb` truncates.
 * Jest isolates module registries per spec file, so this is per-file, exactly
 * like the app it belongs to.
 */
let latest: MemoryStorageProvider | undefined;

/** The keys currently held in memory — the assertion surface for delete. */
export function blobStoreKeys(): string[] {
    return latest?.keys() ?? [];
}

/**
 * Drop every stored blob. Called by `resetDb`, so a blob cannot outlive the row
 * that named it and satisfy a download the database says was deleted.
 */
export function resetBlobStore(): void {
    latest?.clear();
}

/**
 * The harness's storage backend: `@orthacms/media-provider-memory`, a shipped
 * package rather than the inline `Map` this module used to be.
 *
 * That inline version was a second implementation of the port that no rule held
 * to the contract, and it had already drifted from it — a missing key rejected
 * with a bare `Error`, so the route that maps `ObjectNotFoundError` to a 404 was
 * never exercised by any e2e run. The package is checked against the same
 * `describeStorageProvider` suite as every other provider, so the harness now
 * agrees with the port by construction.
 */
export function createInMemoryStorageProvider(): MemoryStorageProvider {
    latest = createMemoryStorageProvider();
    return latest;
}

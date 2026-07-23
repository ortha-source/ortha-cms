import type { Readable } from 'node:stream';
import type { MediaKindValue } from './value-objects/media-kind';

/** A stored blob's provider-assigned coordinates plus verified metadata. */
export interface StoredObject {
    /** Opaque, provider-owned key persisted on the asset row; never parsed here. */
    storageKey: string;
    /** Bytes actually written. */
    size: number;
    /** sha256 hex of the bytes — integrity / future dedup. */
    checksum: string;
}

/** Inputs a provider needs to place one object. The core mints the `assetId`. */
export interface PutObject {
    workspaceId: string;
    assetId: string;
    fileName: string;
    contentType: string;
    /** The upload body, a stream so large files never buffer fully in memory. */
    body: Readable;
}

/**
 * The storage boundary. Implementations live in separate packages
 * (`@ortha-cms/media-provider-local`, `@ortha-cms/media-provider-s3`) and are
 * registered at the composition root. The media core depends only on this
 * interface — never on a concrete backend.
 */
export interface StorageProvider {
    /** Writes one object and returns its key + verified size/checksum. */
    put(object: PutObject): Promise<StoredObject>;
    /** Opens a read stream for download. Rejects if the key is gone. */
    get(storageKey: string): Promise<Readable>;
    /** Removes a stored object. Idempotent — a missing key is a no-op. */
    remove(storageKey: string): Promise<void>;
    /**
     * A direct URL a browser could fetch (e.g. a signed S3 URL). The default
     * download path streams through the app's own route, so this is reserved
     * for future direct-serving optimizations.
     */
    url(storageKey: string): Promise<string>;
}

/** What the core knows about a pending upload — the inputs a resolver sees. */
export interface UploadContext {
    workspaceId: string;
    /** The destination folder id, or `null` for the workspace root. */
    folderId: string | null;
    fileName: string;
    contentType: string;
    kind: MediaKindValue;
    /** Bytes (may be `-1` if unknown before streaming). */
    size: number;
}

/** The named providers available to route between. */
export interface StorageRegistry {
    /** Resolves a provider by name; throws if the name isn't registered. */
    get(name: string): StorageProvider;
    /** Whether a provider is registered under `name`. */
    has(name: string): boolean;
    /** Every registered provider name. */
    names(): string[];
}

/** DI token the composition root binds to the {@link StorageRegistry}. */
export const STORAGE_REGISTRY = Symbol('STORAGE_REGISTRY');

/**
 * The optional custom handler that picks WHICH registered provider handles a
 * given upload. Full custom code — call providers however you want; return a
 * provider NAME present in the registry. If the host supplies none, the core
 * defaults every upload to `config.defaultProvider`.
 */
export type StorageResolver = (
    ctx: UploadContext,
    providers: StorageRegistry
) => string;

/** DI token the composition root binds to the {@link StorageResolver}. */
export const STORAGE_RESOLVER = Symbol('STORAGE_RESOLVER');

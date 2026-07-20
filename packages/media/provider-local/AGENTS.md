# @ortha-cms/media-provider-local

The **default** storage provider for the Media Library — a filesystem
`StorageProvider` that streams blobs to a directory on disk. Depends only on
`@ortha-cms/media-server` (for the port **type**, erased at runtime) and node
built-ins; it imports no framework.

## What it exports

- `createLocalStorageProvider(config): StorageProvider` — a factory the host
  binds at the composition root. `config` is `{ rootDir, publicBasePath }`.

## How it stores

- Keys are `<workspaceId>/<assetId>/<sanitized-filename>` under `rootDir`, so
  blobs stay workspace-partitioned and collision-free.
- `put` streams the body through a metering `PassThrough` (size + sha256) into a
  write stream — large files never buffer fully in memory.
- `get` opens a read stream; `remove` is idempotent (`rm … { force: true }`).

## Wiring

The host constructs it and passes it into `MediaServerPlugin`:

```typescript
MediaServerPlugin({
    providers: { local: createLocalStorageProvider(config.plugins.media.local) },
    config: config.plugins.media
});
```

`rootDir` defaults to a git-ignored `./.storage/media`; point `MEDIA_LOCAL_ROOT`
at a persistent volume for a real deployment (a fresh container's disk is wiped).

## Commands

- `npx nx typecheck @ortha-cms/media-provider-local` / `npx nx lint @ortha-cms/media-provider-local`

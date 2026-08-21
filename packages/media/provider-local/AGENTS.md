# @orthacms/media-provider-local

The **default** storage provider for the Media Library — a filesystem
`StorageProvider` that streams blobs to a directory on disk. Depends only on
`@orthacms/media-server` (for the port **type**, erased at runtime) and node
built-ins; it imports no framework.

## What it exports

- `createLocalStorageProvider(config): StorageProvider` — a factory the host
  binds at the composition root. `config` is `{ rootDir, publicBasePath }`.

## How it stores

- Keys are `<workspaceId>/<assetId>/<sanitized-filename>` under `rootDir`, so
  blobs stay workspace-partitioned and collision-free. Derivatives go under a
  reserved `variants/` sub-namespace, so one can never overwrite an original
  that happens to be named `thumb.webp`.
- `put` streams the body through a metering `PassThrough` (size + sha256) into a
  write stream — large files never buffer fully in memory.
- `get` opens the descriptor, then streams from it; `remove` is idempotent
  (`rm … { force: true }`) and prunes the directories the removed blob leaves
  empty.

### The four invariants, and why they are not obvious

1. **`put` is all-or-nothing.** The port requires it, and the reason is
   structural: the key exists only inside `put`'s *return* value, so a rejected
   write has handed nobody the name of what it created and the core's reclaim
   loop can never see it. Bytes go to a `.<hex>.part` file beside the target and
   are moved into place with one `rename`; any failure unlinks the temporary and
   prunes the directories the attempt created. Don't "simplify" this back to a
   direct `createWriteStream(target)` — `pipeline` destroys both streams on
   error but unlinks nothing, which is how a failed upload used to leave 1.3 MB
   of unreachable garbage on disk.
2. **Every key is checked against the root.** `rootDir` is resolved **once at
   construction** (the default is *relative*, so resolving per call would
   re-home the whole store the moment anything called `chdir`), and every key is
   `resolve`d and required to land inside it. `put`'s keys are contained by
   construction because the ids are sanitized too — the check is there for
   `get`/`remove`, whose keys come back from `media_asset.storage_key` and are
   only as trustworthy as everything that can write that column. Use `resolve`,
   never `join`: `join(root, '/etc/passwd')` quietly rebases an absolute key
   under the root and hides it from a prefix check.
3. **`sanitize` produces a leaf name, never a path token.** `.` and `..` survive
   the character class (both are in the keep-set) but are *not* names: `join`
   normalises `W/A/..` to `W`, so the write lands on the workspace directory and
   creates a **file** where every other asset in that workspace needs a
   directory. They are prefixed with `_`; `...` is merely odd and is left alone.
   Segments are also bounded to 255 characters — truncation rather than
   rejection, because the key is opaque and provider-owned, so the truncated key
   is what `put` returns and what the caller persists.
4. **`get` rejects for a missing key**, as the port says. `createReadStream`
   cannot honour that — it opens lazily, so a missing blob resolved and the
   `ENOENT` arrived once the response was already a streaming `200` that could
   no longer become a `404`. The descriptor is opened here instead, and
   `autoClose: true` is load-bearing (it defaults to *false* for a `FileHandle`
   stream, which would leak a descriptor per download).

### Known limits, recorded deliberately

- Containment is **textual**, not `realpath`-based, so a symlink planted inside
  `rootDir` is still a write-through primitive. That assumes `rootDir` is a
  volume no untrusted process can write to — fine for a dedicated volume, not
  for a shared one.
- `contentType` is accepted and **dropped**: a filesystem has no place to put
  it. An S3 adapter that sets `ContentType` on the object would make the two
  backends asymmetric; decide there whether object metadata is authoritative.
- `url()` is dead code. **No route serves the path it builds** — downloads go
  through `GET /api/media/assets/:id/raw`, which resolves the key from the asset
  row *after* checking workspace membership. If you implement the static-serving
  mode, it must not be an `express.static` over `rootDir`: that serves every
  blob to anyone holding a key, and keys are handed out in API responses.

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

- `npx nx test @orthacms/media-provider-local` — the unit suite. It runs against
  a **real temporary directory**, not a mocked `fs`: every claim worth making
  here is about bytes, modes, and what survives a failure, and a mock can only
  confirm which calls were made. Assert on the disk.
- `npx nx typecheck @orthacms/media-provider-local` / `npx nx lint @orthacms/media-provider-local`
- The cross-package half lives in `apps/server-e2e/src/server/media/media-local-storage.spec.ts`,
  which boots the app with `createTestApp({ localMediaRoot })` so the media
  routes run on this provider instead of the harness's in-memory `Map`.

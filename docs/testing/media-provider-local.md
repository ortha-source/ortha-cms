# @ortha-cms/media-provider-local — Test Artifact

> **Unit:** `packages/media/provider-local` · **Package:** `@ortha-cms/media-provider-local` · **Kind:** adapter (storage provider)
> **Source of truth:** `packages/media/provider-local/AGENTS.md`
> **Findings verified:** 2026-08-11 — 5 confirmed · 0 deleted · 2 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** one factory, `createLocalStorageProvider(config)`, returning a
`StorageProvider` whose four methods (`put` / `get` / `remove` / `url`) read and
write blobs under a directory on disk. It owns the **key shape**
(`<workspaceId>/<assetId>[/variants]/<sanitized-filename>`), the filename
sanitizer, the size + sha256 metering, and the direct-URL string.

**Does NOT own:** anything about assets, folders, workspaces, permissions,
transactions, MIME types, size caps, or derivative generation — all of that is
`media-server`'s. It imports **no framework** and depends on `@ortha-cms/media-server`
only for the port *type* (erased at runtime) plus node built-ins. It is
constructed at the composition root (`apps/server/src/plugins.ts:88`), never by
`media-server` itself.

**It is the only provider the shipped host registers**, which is the single most
important fact about the pair: `apps/server/src/plugins.ts:86-90` passes
`{ local: createLocalStorageProvider(...) }` and no `s3`, so every e2e run,
every CI job and every dev session exercises this adapter and never the other one.

- **Entry points**
  - `createLocalStorageProvider(config: LocalStorageConfig): StorageProvider` —
    `packages/media/provider-local/src/lib/local-storage-provider.ts:32`
  - `LocalStorageConfig = { rootDir, publicBasePath }` — `.../local-storage-provider.ts:14`
  - internal, untested and unexported: `sanitize(name)` — `:22`; `keyFor(...)` — `:35`;
    `absolute(key)` — `:46`.

- **Runtime prerequisites**
  - `rootDir` must be writable by the server process. It defaults to a
    git-ignored `./.storage/media`; `MEDIA_LOCAL_ROOT` points it elsewhere.
  - Nothing else — no Postgres, no env, no network. The adapter can be exercised
    in isolation from a node REPL.

- **How to exercise it manually**
  ```bash
  docker compose up -d && npx nx run server:db:migrate && npm run dev
  # every upload lands under $MEDIA_LOCAL_ROOT (default ./.storage/media)
  curl -b j -X POST localhost:3000/api/media/assets \
    -H "X-Workspace-Id: $WS" -H 'Origin: http://localhost:4200' \
    -F 'file=@logo.png;type=image/png'
  find ./.storage/media -type f
  ```
  In isolation:
  ```bash
  node --input-type=module -e "
    const { createLocalStorageProvider } = await import('@ortha-cms/media-provider-local');
    const p = createLocalStorageProvider({ rootDir: '/tmp/blobs', publicBasePath: '/api/media' });
    const { Readable } = await import('node:stream');
    console.log(await p.put({ workspaceId: 'w', assetId: 'a', fileName: 'x y.png',
      contentType: 'image/png', body: Readable.from(Buffer.from('hi')) }));
  "
  ```

- **Dependencies that must be healthy:** the filesystem (space, inodes,
  permissions) and the `StorageProvider` contract in
  `packages/media/server/src/lib/domain/storage-provider.ts:37-50`.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `put` streams a body to `<rootDir>/<ws>/<asset>/<name>` | `packages/media/provider-local/src/lib/local-storage-provider.ts:49-69` | ⚠️ PARTIAL (indirect) |
| F2 | `put` meters byte count and sha256 while writing | `.../local-storage-provider.ts:59-68` | ⚠️ PARTIAL (indirect) |
| F3 | Variant keys land in a reserved `variants/` namespace | `.../local-storage-provider.ts:42-45` | ⚠️ PARTIAL (indirect) |
| F4 | Filename sanitization (`[^\w.-]+` → `_`) | `.../local-storage-provider.ts:22-24` | ❌ NONE |
| F5 | Parent directories created on demand | `.../local-storage-provider.ts:57` | ⚠️ PARTIAL (indirect) |
| F6 | `get` opens a read stream for a key | `.../local-storage-provider.ts:71-73` | ⚠️ PARTIAL (indirect) |
| F7 | `remove` is idempotent (`rm … { force: true }`) | `.../local-storage-provider.ts:75-77` | ❌ NONE |
| F8 | `url` builds `<publicBasePath>/blob/<encoded key>` | `.../local-storage-provider.ts:79-83` | ❌ NONE |

Every ⚠️ above is **indirect**: the behaviour is exercised only as a side-effect of
`apps/server-e2e/src/server/media/*.spec.ts` running against the registered
provider. There is **no spec that names this package**, and no unit test file
exists anywhere under `packages/media/provider-local/`.

## 3. Manual Test Plan

### F1 — `put` writes the blob at the expected key

**Preconditions:** a writable `rootDir`; the server running, or a REPL as above.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload `logo.png` to workspace `W`, receiving asset id `A` | `201` |
| 2 | `find $MEDIA_LOCAL_ROOT -type f` | exactly `<root>/W/A/logo.png` |
| 3 | Read the returned `StoredObject` (via the DB row) | `storage_key = "W/A/logo.png"`, `size` = the real byte count, `checksum` = `sha256sum logo.png` |
| 4 | `sha256sum <root>/W/A/logo.png` | equals `media_asset.checksum` |

**Keyboard-only / screen reader:** Not Applicable — no UI.

### F2 — Size and checksum metering

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload a 0-byte file | `size: 0`; checksum is sha256 of the empty string (`e3b0c442…`) |
| 2 | Upload a 10 MB file | `size` matches `stat -c%s` exactly |
| 3 | Compare `media_asset.size` with the multipart `file.size` | identical — the provider's number is the one persisted (`upload-asset.use-case.ts:158` uses `original.size`, not `command.size`) |

### F3 — Variant namespace

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload a 2000×1500 JPEG | derivatives generated |
| 2 | `find <root>/W/A` | `<root>/W/A/photo.jpg`, `<root>/W/A/variants/thumb.webp`, `<root>/W/A/variants/preview.webp` |
| 3 | Upload a file literally named `thumb.webp`, then let derivatives run on it | the original sits at `A/thumb.webp`, derivatives at `A/variants/thumb.webp` — no collision |

### F4 — Filename sanitization

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload `my photo (final).PNG` | key segment `my_photo_final_.PNG`; `media_asset.name` keeps the original |
| 2 | Upload `логотип.png` | key segment `_.png` — every non-`[A-Za-z0-9_.-]` run collapses to one `_` |
| 3 | Upload `商標.png` into the same asset | a *different* asset id, so no collision; but the on-disk name is also `_.png` |
| 4 | Upload `a<b>c.png` | key segment `a_b_c.png` |
| 5 | Upload `..` (see EC-04) | see `🐞 BUG-media-provider-local-02` |

### F5 — Directory creation

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Point `rootDir` at a path that does not exist and upload | `mkdir … { recursive: true }` creates the whole chain; the upload succeeds |
| 2 | `chmod 500` the root, then upload | `put` rejects `EACCES`; the use case's `catch` reclaims nothing (nothing was written) and rethrows → `500` |

### F6 — `get`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/media/assets/A/raw` | `200` and the exact bytes |
| 2 | Delete the file on disk, keep the row, then `GET …/raw` | `createReadStream` is lazy, so `get` resolves; the **stream** then errors `ENOENT` mid-response → see `🐞 BUG-media-provider-local-03` |

### F7 — `remove`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Delete an asset | its file and its `variants/*.webp` are gone |
| 2 | Delete it again (replay the bulk-delete body) | `{ deleted: 0 }`; `rm … { force: true }` would not have thrown either way |
| 3 | Call `remove` on a key whose file is already absent | resolves, no error — the port's "Idempotent — a missing key is a no-op" holds |
| 4 | Note what is **not** removed | the now-empty `<ws>/<assetId>/` directory is left behind — see `🐞 BUG-media-provider-local-04` |

### F8 — `url`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `provider.url('W/A/logo.png')` | `"/api/media/blob/W%2FA%2Flogo.png"` with the default `publicBasePath` |
| 2 | `curl localhost:3000/api/media/blob/W%2FA%2Flogo.png` | `404` — **no route serves this path** (`grep -rn "'blob'" packages apps` finds only this file) |
| 3 | Confirm nothing calls it | `AssetView.url` is built by `to-asset-view.ts:128`, not by the provider — `url()` is dead code today |

## 4. Edge Cases & Negative Paths

### Key construction and traversal

- **EC-01 — `fileName` containing `../../etc/passwd`.** `❌ NONE`
  Blocked upstream: `FileName.create` rejects `/` and `\`
  (`packages/media/server/src/lib/domain/value-objects/file-name.ts:20-22`) → `400`
  before the provider is reached. Even if it were reached, `sanitize` maps `/` to
  `_`. **Checked and cleared.**
- **EC-02 — `fileName` = `....//....//etc/passwd`.** `❌ NONE` Same: rejected on `/`.
- **EC-03 — `fileName` with a NUL byte.** `❌ NONE` `\0` is not `\w`, so `sanitize`
  replaces it. Safe.
- **EC-04 — `fileName` = `..` (two dots, no separator).** `❌ NONE`
  `FileName` accepts it; `sanitize('..') === '..'` because `.` is in the keep-set.
  The key becomes `W/A/..`, and `join(rootDir, 'W/A/..')` normalises to
  `<root>/W`. `mkdir(dirname(target))` creates `<root>/W/A`, then
  `createWriteStream('<root>/W')` fails `EISDIR`. → `🐞 BUG-media-provider-local-02`.
- **EC-05 — `fileName` = `.` or `...`.** `❌ NONE` `.` normalises the key to
  `<root>/W/A` (a directory, `EISDIR`); `...` is an ordinary, if odd, filename.
- **EC-06 — Adversarial `workspaceId` / `assetId`.** `❌ NONE`
  Neither is sanitized (`keyFor` interpolates both raw, `:44-45`). Both are minted
  server-side — `AssetId.generate()` and `@CurrentWorkspace()` — so they are uuids
  today. This is an **unchecked trust assumption**, not a live bug; the port's own
  doc calls the key "opaque, provider-owned", which cuts the other way.
  → `🐞 BUG-media-provider-local-01` (Low, defence in depth).
- **EC-07 — `get`/`remove` with a key read back from the database.** `❌ NONE`
  `absolute(storageKey)` applies `join` with no containment check
  (`:46, 72, 76`). Any process that can write `media_asset.storage_key` (a bad
  migration, a compromised admin script, a future provider that mints structured
  keys) can make the server read or delete an arbitrary file. Same finding.
- **EC-08 — `rootDir` is a relative path and the process `chdir`s.** `❌ NONE`
  `join('./.storage/media', key)` resolves against the *current* cwd at call time,
  so a cwd change between two calls splits the store in two. The default is
  relative. Worth pinning to `resolve()` once at construction.
- **EC-09 — `rootDir` is a symlink to another volume.** `❌ NONE` Works; `join`
  does not resolve symlinks, and neither `get` nor `remove` cares.
- **EC-10 — A key path component is itself a symlink planted on disk.** `❌ NONE`
  `createWriteStream` follows it, so a writable `rootDir` shared with another
  process is a write-through primitive. Out of scope for a trusted volume; note it
  for a multi-tenant host.

### Streaming, size and failure

- **EC-11 — Source stream errors mid-write.** `❌ NONE`
  `pipeline` rejects and destroys both streams, but the **partial file stays on
  disk** at `target`. `UploadAssetUseCase` never learned the key (see
  `🐞 BUG-media-server-04`), so nothing reclaims it.
- **EC-12 — Disk full (`ENOSPC`).** `❌ NONE` Same shape as EC-11: a truncated file
  remains, `put` rejects, the route returns `500`.
- **EC-13 — Read-only filesystem / `EACCES`.** `❌ NONE` `mkdir` or the write stream
  rejects; the error surfaces as a `500` with a node error message. No mapping to a
  `503`/`507`.
- **EC-14 — Zero-byte body.** `❌ NONE` `size: 0`, `checksum` = sha256 of empty. The
  `'data'` handler never fires. Correct.
- **EC-15 — A 5 GB body (cap raised).** `❌ NONE` Streams fine at the provider layer —
  the memory bound is `media-server`'s multer buffering, not this adapter's.
- **EC-16 — Two concurrent `put`s with the same key.** `❌ NONE`
  Impossible through the API (the `assetId` segment differs per upload) but not
  prevented here: two `createWriteStream` calls on one path interleave and produce
  a corrupt file with a *plausible* size/checksum from whichever meter finished. A
  `wx` flag would make the collision explicit.
- **EC-17 — The metering `'data'` listener vs the `pipeline` pipe.** `❌ NONE`
  Attaching `'data'` puts the `PassThrough` in flowing mode; `pipeline` attaches
  the destination synchronously in the same tick, so no chunk is lost. **Checked
  and cleared** by reading `:59-67`.
- **EC-18 — `get` on a missing file.** `❌ NONE` `createReadStream` is lazy, so the
  promise resolves and the failure arrives as an `'error'` on the stream after
  headers are already sent. → `🐞 BUG-media-provider-local-03`.
- **EC-19 — `remove` on a *directory* key.** `❌ NONE`
  `rm(path, { force: true })` without `recursive` rejects `ERR_FS_EISDIR` on a
  non-empty directory. Only reachable via EC-04's malformed key.
- **EC-20 — Empty directories accumulate.** `❌ NONE`
  Nothing ever removes `<ws>/<assetId>/` or `<ws>/`, so a workspace that uploads
  and deletes a million files leaves a million empty directories (and inodes).
  → `🐞 BUG-media-provider-local-04`.

### Contract conformance (the divergence axis)

- **EC-21 — Do all four methods return rejected promises rather than throwing synchronously?** `❌ NONE`
  Here: **yes** — all four are `async`, so every failure is a rejection.
  `provider-s3`: **no** — see `🐞 BUG-media-provider-s3-01`. This is the sharpest
  divergence between the two adapters and the reason a caller written against
  `local` breaks against `s3`.
- **EC-22 — Is `remove` idempotent, as the port requires?** `❌ NONE`
  Here: yes (`{ force: true }`). `provider-s3`: no — it throws unconditionally.
- **EC-23 — What shape does `url()` return?** `❌ NONE`
  Here: `"<publicBasePath>/blob/<encodeURIComponent(key)>"` — a relative path with
  the key's `/` percent-encoded to `%2F`, aimed at a route that does not exist.
  `provider-s3`: throws. Two adapters, three behaviours (path / throw / the
  documented "signed URL" that neither implements).
- **EC-24 — Does `put` honour `contentType`?** `❌ NONE`
  Here: **it is ignored entirely** — the filesystem has no content type, so the
  round-trip is `mime_type` in the DB only. An S3 implementation would set
  `ContentType` on the object, so the same asset would carry metadata on one
  backend and not the other.
- **EC-25 — Does `put` honour `isVariant`?** `❌ NONE` Here: yes (`:41-45`).
  `provider-s3`: unreachable.

### 4A. Accessibility & Section 508 Conformance

This adapter renders no UI and produces no content a user perceives, so most of
WCAG 2.1 AA is **Not Applicable**. The one provision that does reach it is
Section 508 **504.2.1 (preservation of accessibility information)**: a storage
adapter must not drop metadata that accessible content depends on.

**Baseline:** ❌ — no a11y suite; none is applicable to a filesystem adapter.

#### ♿ A11Y-media-provider-local-01 — Nothing accessibility-bearing is stored beside the blob, so a round-trip through storage cannot preserve it
**WCAG:** 1.1.1 Non-text Content (A) (indirect) · **508:** 504.2.1 · **Verdict: Not Applicable → Supports by construction**
**Location:** `packages/media/provider-local/src/lib/local-storage-provider.ts:49-69`
`put` writes **only the bytes**. Alt text, dimensions, kind and MIME live on
`media_asset` (`packages/media/server/src/lib/infrastructure/schema/media-asset.ts:62`),
never in the object store. So a blob move between providers loses nothing
accessibility-relevant, because there was nothing there to lose — 504.2.1 is
satisfied trivially rather than deliberately.
**The divergence worth recording:** an S3 implementation that stored
`ContentType`/`Metadata` on the object (which is the natural way to write one)
would make the two adapters asymmetric — the local one would keep no
`contentType` at all while S3 kept one, and `PutObject.contentType` is already
passed to both (`domain/storage-provider.ts:19`) and silently dropped here. If
S3 is ever implemented, decide explicitly whether object metadata is authoritative
or decorative, because a "restore from the bucket" path would otherwise recover
different information depending on which adapter wrote it.
**Remediation:** none required today. When the S3 adapter lands, either write no
object metadata (matching local) or backfill the same fields on local via a
sidecar, and state which is the source of truth.

#### ♿ A11Y-media-provider-local-02 — The unreachable `url()` path would serve blobs with no authorization, bypassing every media guard
**WCAG:** n/a · **508:** n/a (security, recorded here because it sits in the same dead code path as the 504.2.1 question) · **Verdict: Not Applicable**
**Location:** `packages/media/provider-local/src/lib/local-storage-provider.ts:79-83`
`url()` promises `<publicBasePath>/blob/<key>` — a "future static-serving mode".
No such route exists, so today it is inert. Cross-referenced to
`🐞 BUG-media-provider-local-05` rather than double-filed; flagged here so that
whoever implements static serving does not do it as a bare `express.static` on
`rootDir`, which would undo `media-server`'s membership-derived scoping wholesale.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 `put` | `apps/server-e2e/src/server/media/media-assets.spec.ts:78` | that an upload produces a persisted **row**; the file on disk is never inspected | ⚠️ PARTIAL — the adapter is exercised, never asserted |
| F1/F6 round-trip | `media-assets.spec.ts:130` | `GET …/raw` returns the uploaded bytes — the strongest indirect evidence `put`+`get` agree | ⚠️ PARTIAL — no key-shape or checksum assertion |
| F2 metering | — | — | ❌ NONE — `size`/`checksum` are asserted nowhere |
| F3 variants namespace | `media-assets.spec.ts:230`, `:275` | derivatives exist and are served; the reserved `variants/` prefix is never checked | ⚠️ PARTIAL |
| F4 sanitization | — | — | ❌ NONE — every e2e uploads `logo.png` / `a.png` / `x.png`; no name ever needs sanitizing |
| F5 mkdir | — | — | ⚠️ PARTIAL (implicit — the suite would fail outright otherwise) |
| F7 `remove` | `media-assets.spec.ts:180`, `media-folders.spec.ts:112` | that the **rows** are gone after a delete/cascade; the disk is never checked | ⚠️ PARTIAL |
| F8 `url` | — | — | ❌ NONE — nothing in the repo calls it |
| a11y | — | — | ❌ NONE (Not Applicable) |

There is **no spec file, unit test, or fixture anywhere that imports
`@ortha-cms/media-provider-local`** other than the composition root. Its entire
verification is "the media e2e suites pass, and they could not if `put`/`get` were
broken".

**Coverage tally:** `8 features · 0 ✅ · 5 ⚠️ · 3 ❌`

## 6. 🐞 Potential Bugs

### 🐞 BUG-media-provider-local-01 — `get`/`remove` join a database-sourced key onto `rootDir` with no containment check · Severity: Medium · 🔒

**Location:** `packages/media/provider-local/src/lib/local-storage-provider.ts:46, 71-77`
**Category:** path traversal (defence in depth)

**What the code does:**
```typescript
const absolute = (storageKey: string) => join(config.rootDir, storageKey);
…
async get(storageKey: string): Promise<Readable> {
    return createReadStream(absolute(storageKey));
},
async remove(storageKey: string): Promise<void> {
    await rm(absolute(storageKey), { force: true });
}
```
`storageKey` arrives from `media_asset.storage_key` / `media_asset.variants[*].key`
(`download-asset.query.ts:50-62, 69-79`, `domain/asset.ts:208-215`). `join` normalises
`..` segments, so a key of `../../../../etc/passwd` resolves outside `rootDir` and
is happily streamed or deleted.

**Why it is wrong:** the sanitizer that makes keys safe runs **only in `put`**
(`:22-24`), and only on `fileName` — not on `workspaceId`/`assetId`, and not at
all on the read/delete side. The port describes the key as "opaque,
provider-owned; never parsed here" (`domain/storage-provider.ts:6`), which is a
statement about the *core*, not a licence for the provider to trust whatever it is
handed back. Every real object store validates its own key on read.

**Repro (requires DB write access, i.e. this is not remotely exploitable today):**
1. `UPDATE media_asset SET storage_key = '../../../../etc/hostname' WHERE id = '<A>';`
2. `GET /api/media/assets/<A>/raw` → the file's contents are streamed to any
   member of the owning workspace.
3. `DELETE /api/media/assets` with `{"ids":["<A>"]}` → `rm` deletes the target.
→ Observed: arbitrary file read and arbitrary file delete as the server user.
→ Expected: a key that resolves outside `rootDir` is refused.

**Blast radius:** not reachable from the HTTP API as the code stands (keys are
minted by `put` from server-generated uuids), so this is a **latent** bug — but it
turns any future key-minting change, any bad migration, or any SQL-injection
elsewhere into arbitrary file read/delete. `assetId` and `workspaceId` are also
interpolated unsanitized at `:44-45`, so the same hole exists on the write side
for any caller that supplies a non-uuid.

**Suggested fix:** resolve the target and assert it is inside `resolve(rootDir)`
before every `createReadStream` / `rm` / `createWriteStream`; sanitize
`workspaceId` and `assetId` in `keyFor` the way `fileName` already is.

---

### 🐞 BUG-media-provider-local-02 — A file named `..` produces a key that escapes its own asset directory · Severity: Low · 🔒

**Location:** `packages/media/provider-local/src/lib/local-storage-provider.ts:22-24, 35-46`, with `packages/media/server/src/lib/domain/value-objects/file-name.ts:15-25`
**Category:** path traversal / correctness

**What the code does:**
```typescript
function sanitize(name: string): string {
    return name.replace(/[^\w.-]+/g, '_');
}
```
`.` and `-` are deliberately preserved, so `sanitize('..') === '..'`. `FileName`
upstream rejects only `/` and `\`, and `'..'.trim()` is non-empty and under 255
chars, so it passes. The resulting key is `<ws>/<assetId>/..`, and
`join(rootDir, that)` normalises to `<rootDir>/<ws>`.

**Why it is wrong:** `FileName`'s own JSDoc says "path separators are rejected so a
name can't smuggle traversal into a storage key" — but traversal does not require
a separator once the *provider* concatenates path segments. The two halves of the
defence each assume the other covers dot segments; neither does.

**Repro:**
1. `curl -b j -X POST localhost:3000/api/media/assets -H "X-Workspace-Id: $WS" \
    -H 'Origin: http://localhost:4200' -F 'file=@logo.png;filename=..;type=image/png'`
→ Observed: `mkdir` creates `<root>/<ws>/<assetId>`, then
`createWriteStream('<root>/<ws>')` fails `EISDIR` and the route returns a `500`
with a node error message. A `500` from a user-supplied filename is the bug even
in its benign form.
→ Expected: `400` (an invalid file name) or a key that stays inside the asset
directory.

**Blast radius:** today, a self-inflicted 500 and a stray empty `<assetId>`
directory — the escape lands one level up on a directory, so nothing is
overwritten. It becomes a real overwrite primitive under any key shape where the
name is not the last segment (e.g. if a future provider appended an extension, or
if `isVariant` ordering changed).

**Suggested fix:** reject `.`-only names in `FileName.create` **and** make
`sanitize` collapse leading dot-runs, so neither layer is the sole defence.

---

### 🐞 BUG-media-provider-local-03 — A missing blob surfaces as a mid-response stream error, not a 404 · Severity: Low

**Location:** `packages/media/provider-local/src/lib/local-storage-provider.ts:71-73`, consumed at `packages/media/server/src/lib/infrastructure/queries/download-asset.query.ts:85-88` and `.../http/controllers/download-asset.controller.ts:61-67`
**Category:** ux-state / correctness

**What the code does:** `get` returns `createReadStream(path)` without touching the
filesystem — `createReadStream` opens lazily, so the promise resolves for a path
that does not exist. `DownloadAssetController` then constructs a `StreamableFile`
with `type`, `disposition` and `length` headers already computed from the row, and
Nest begins the response. The `ENOENT` arrives on the stream afterwards.

**Why it is wrong:** the port states "Rejects if the key is gone"
(`domain/storage-provider.ts:40-41`). It does not. The observable result is a `200`
with a `Content-Length` the body never satisfies — a truncated response rather
than an error the client can act on. This is exactly the state left behind by the
orphan-row half of `🐞 BUG-media-server-04` and by any manual blob cleanup.

**Repro:**
1. Upload an asset, then `rm` its file from `$MEDIA_LOCAL_ROOT` (simulating a lost
   volume or a half-finished GC).
2. `curl -i localhost:3000/api/media/assets/<id>/raw`
→ Observed: `200 OK`, `Content-Length: <n>`, then a connection reset / zero-byte
body; the server logs an unhandled stream error.
→ Expected: `404`, or at minimum a `500` before headers are flushed.

**Blast radius:** broken thumbnails that look like a network fault, and an error
that never reaches the client. Also makes `🐞 BUG-media-server-04`'s orphan state
harder to diagnose.

**Suggested fix:** `await stat(path)` (or `open()` and wrap the fd) in `get`, so a
missing key rejects before the controller writes headers; map the rejection to a
`404` in `download-asset.controller.ts`.

---

### 🐞 BUG-media-provider-local-04 — Deleted assets leave their directories behind forever · Severity: Low

**Location:** `packages/media/provider-local/src/lib/local-storage-provider.ts:75-77`
**Category:** perf / resource leak

**What the code does:** `remove` deletes the **file** at the key and nothing else.
Since every asset owns a directory (`<ws>/<assetId>/`, plus `variants/` for
images), deleting an asset removes 1–3 files and leaves 1–2 empty directories.

**Why it is wrong:** the key shape is the provider's own invention
(`AGENTS.md`: "Keys are `<workspaceId>/<assetId>/<sanitized-filename>`"), so the
directory is the provider's to clean up; no other layer knows the key has
structure — the core is explicitly told the key is opaque.

**Repro:** upload and delete 1 000 assets, then `find $MEDIA_LOCAL_ROOT -type d | wc -l`.
→ Observed: ≥2 000 empty directories, one inode each, never reclaimed.
→ Expected: the asset directory disappears with its last file.

**Blast radius:** inode exhaustion on a busy library long before disk space runs
out; `find`/backup times grow without bound. No correctness impact.

**Suggested fix:** after removing the file, attempt `rmdir` on its parent (and the
grandparent) ignoring `ENOTEMPTY`; or key variants as `…/<assetId>.variants.thumb.webp`
so an asset owns files, not a tree.

---

### 🐞 BUG-media-provider-local-05 — `url()` returns a path no route serves, and the shape it promises would bypass authorization · Severity: Low

**Location:** `packages/media/provider-local/src/lib/local-storage-provider.ts:79-83`
**Category:** correctness (dead contract)

**What the code does:**
```typescript
async url(storageKey: string): Promise<string> {
    return `${config.publicBasePath}/blob/${encodeURIComponent(storageKey)}`;
}
```
`grep -rn "/blob/" packages apps` matches only this line. No controller,
middleware, or static handler answers `…/blob/…`, so the string is a 404 by
construction. `encodeURIComponent` also encodes `/` as `%2F`, which most static
handlers reject outright.

**Why it is wrong:** the port documents `url` as "A direct URL a browser could
fetch (e.g. a signed S3 URL)" (`domain/storage-provider.ts:44-49`). A method that
returns an unfetchable string satisfies the type and violates the contract, and
because nothing calls it the mismatch is invisible. The sibling adapter's `url`
*throws*, so the two "implementations" of one port disagree about even whether the
operation is possible — see `🐞 BUG-media-provider-s3-03`.

**Repro:** `curl -i "localhost:3000$(node -e "…provider.url('W/A/logo.png')…")"`
→ Observed: `404`. → Expected: fetchable bytes, or a documented `throw`.

**Blast radius:** none today (dead code). The risk is directional: implementing
`/blob/:key` as static file serving would hand out **unauthenticated** blob URLs,
undoing the membership-derived scoping `download-asset.controller.ts` was built to
provide.

**Suggested fix:** until static serving exists, make `url` throw the same
`NotImplemented` shape the S3 stub uses, so the two adapters agree; when it is
implemented, put it behind the same membership check as `/raw`.

---

**Tally:** 5 🐞 — 0 Critical, 1 Medium (🔒), 4 Low (one 🔒).
**♿ tally:** 2 — 0 Supports · 0 Partially Supports · 0 Does Not Support · 2 Not Applicable.

**Checked and cleared:** the `'data'`-listener-plus-`pipeline` metering (no lost
chunks — both attach in the same tick); the reserved `variants/` namespace
genuinely prevents a user file named `thumb.webp` from colliding with a derivative;
`rm … { force: true }` genuinely makes `remove` idempotent for a missing file, as
the port requires; `FileName` upstream genuinely blocks `/` and `\` traversal; and
all four methods are `async`, so every failure is a rejection rather than a
synchronous throw (unlike the S3 sibling).

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | package unit (`*.spec.ts` beside the source, no Nest) | `packages/media/provider-local/src/lib/local-storage-provider.spec.ts` | against a `mkdtemp` root: key shape for normal / variant blobs; sanitization of spaces, parentheses, unicode, `<>`; `size`+`sha256` for 0-byte and multi-chunk bodies; `remove` idempotent; `get` on a missing key | F2 ❌, F4 ❌, F7 ❌ |
| 2 | package unit | same file, containment cases | `get('../../etc/passwd')` and `remove('../../x')` are refused; `put` with `fileName: '..'`, `'.'`, `'a/b'` is refused | 🐞 BUG-media-provider-local-01, 🐞 BUG-media-provider-local-02 |
| 3 | package unit | same file, contract-conformance table | a **shared** conformance suite parameterised over every registered provider: all four methods reject (never throw synchronously); `remove` of a missing key resolves; `get` of a missing key rejects; `url` either returns a fetchable string or throws a documented error | EC-21…EC-25, 🐞 BUG-media-provider-s3-01 |
| 4 | `apps/server-e2e` testcontainer + supertest | `src/server/media/media-storage-layout.spec.ts` | after an image upload, the local root contains exactly `<ws>/<assetId>/<name>` + `<ws>/<assetId>/variants/{thumb,preview}.webp`; after a delete, no file remains under `<ws>/<assetId>/` | F1 ⚠️, F3 ⚠️, F7 ⚠️ |
| 5 | `apps/server-e2e` | extend `media-assets.spec.ts` | upload with `filename` = `my photo (final).PNG` and with a CJK name; assert `media_asset.name` keeps the original while the file on disk is the sanitized form | F4 ❌ |
| 6 | `apps/server-e2e` | `src/server/media/media-missing-blob.spec.ts` | delete the file under the local root, keep the row, then `GET …/raw` → a `404`/`500` **before** headers, not a truncated `200` | 🐞 BUG-media-provider-local-03 |
| 7 | package unit | same file, failure injection | a body stream that errors mid-write leaves **no** partial file at the target | 🐞 BUG-media-server-04, EC-11 |

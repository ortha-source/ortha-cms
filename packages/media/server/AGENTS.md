# @ortha-cms/media-server

The **media** bounded context — folders and assets for the Media Library, and
the provider-agnostic storage seam. It owns its schema (`media_folder`,
`media_asset`) and ships its own migrations. Bytes never live in the database:
each asset row carries a `storage_key` + `storage_provider` pointer, and the
actual blob is held by a `StorageProvider` implementation registered at the
composition root.

> **Layered per ADR-0003 (tactical DDD inside plugins).** New DB-backed context,
> born in the layered shape — reference: `packages/workspaces/server`.

## Layered layout

```
domain/          # framework-free core — the one hard rule below
  asset.ts / folder.ts             # aggregate roots (+ pullEvents)
  value-objects/                   # AssetId, FolderId, FileName, MediaKind, StorageKey
  storage-provider.ts              # StorageProvider PORT + StorageRegistry + StorageResolver + symbols
  asset.repository.ts / folder.repository.ts  # repo PORTs + symbols
  events/media-events.ts           # media.* domain-event factory + kinds
  errors/                          # transport-agnostic domain errors
application/     # orchestration — one use case per state change
  use-cases/                       # upload / update / delete assets; create / rename / delete folders
  dto/                             # class-validator DTOs (shape checks only)
infrastructure/  # adapters — the only layer that knows Drizzle/pg
  schema/  persistence/  queries/  storage-registry.ts
http/            # thin controllers (one per use case) + to-http error mapper
```

## The one hard rule

**`domain/` imports NOTHING from `@nestjs/*`, `drizzle-orm`, `class-validator`,
or `infrastructure/`.** Only `@ortha-cms/database`'s framework-free
`createDomainEvent`/`DomainEvent` and node built-ins. Self-enforce it (the
layer-boundary lint isn't wired yet).

## The storage seam (the whole point)

- **`StorageProvider`** (`domain/storage-provider.ts`) is a NestJS-free port:
  `put` / `get` / `remove` / `url`. Implementations ship as **separate
  packages** (`@ortha-cms/media-provider-local`, `-s3`) and are constructed at
  the host's composition root (`apps/server/src/plugins.ts`) — this package
  never imports a concrete backend.
- **`StorageRegistry`** holds the named providers; **`StorageResolver`** is an
  optional host-supplied handler `(ctx, registry) => name` that picks a provider
  per upload. Omit it and every upload uses `config.defaultProvider`.
- **Route at write, record at read.** The resolver runs only on upload; the
  chosen provider name is persisted on `media_asset.storage_provider`. Downloads
  and deletes route by that stored name — never re-run the resolver — so
  changing the handler never strands existing blobs.

## Use cases + unit-of-work + outbox

Each state change runs inside `UnitOfWork.run` over the repo ports +
`OutboxWriter`, so the row and its `media.*` event commit atomically. Upload
streams to the provider **before** the transaction (it needs a `storage_key`);
an orphan blob left by a rolled-back commit is reclaimed in a `catch`. Delete
removes the row in-transaction and reclaims the blob **post-commit**.

## HTTP surface (`/api/media`)

Every route carries `WorkspaceGuard` (X-Workspace-Id → `@CurrentWorkspace()`)
and a permission-by-constant (`PERMISSIONS.MEDIA_*`); state-changing routes add
`OriginGuard`. Upload uses `FileInterceptor('file')`; download streams via
`StreamableFile`. **Folder delete cascades** — see below.

**`GET /media/assets/:id/raw` is the one exception** — it carries no
`WorkspaceGuard`. Its URL is fetched by the browser itself (`<img src>` for the
library's thumbnails and detail drawer, download links), and those requests send
cookies but **cannot** send a custom `X-Workspace-Id` header, so the guard 400'd
every preview. The scope is **derived, not dropped**: `DownloadAssetQuery.locate`
reads the asset's owning workspace, the controller requires the caller to be a
member of *that* workspace (via workspaces-server's exported
`MembershipCheckQuery`), and only then does `open` touch storage. A non-member
gets the same 404 as a missing asset, so asset ids can't be probed. Any new route
whose URL the browser loads directly needs this treatment, not the header guard.

- `GET /media/folders` · `POST /media/folders` · `PATCH|DELETE /media/folders/:id`
- `GET /media/assets` (`?folderId=&search=&kind=&sort=&page=&pageSize=`) ·
  `POST /media/assets` (multipart) · `GET /media/assets/:id/raw` ·
  `PATCH /media/assets/:id` · `DELETE /media/assets` (bulk `{ ids }`)

## Folder delete cascades

Deleting a folder removes **the whole subtree**: every descendant folder and
every asset in any of them, in one transaction, with the blobs (originals +
derivatives) reclaimed post-commit. It used to `409` on a non-empty folder,
which made a populated tree undeletable without emptying it by hand, level by
level — the guard belongs in the UI's confirmation, which names what will go,
not in a server the user can't argue with. `FolderNotEmptyError` is gone.

`findDescendantsForUpdate` walks `parent_id` with a recursive CTE (workspace
filter in **both** branches — a cascade that escaped its tenant would be the
worst possible bug here, so an e2e pins it), then re-reads the rows `FOR UPDATE`
and returns them **deepest-first**, so no parent is removed before its children
and a concurrent upload/move/create-subfolder serializes against the delete
instead of orphaning itself. (`FOR UPDATE` can't be attached to a recursive
CTE's own SELECT — Postgres rejects it — hence the two statements.) It then
**re-walks and loops** until the subtree stops changing: the CTE takes no locks,
so a subfolder created under a *descendant* between the two statements would
otherwise survive its own parent's deletion. Once every known id is locked, a
re-walk either agrees or reveals the new child — and further inserts under it
now block on us — so it converges (bounded by `SUBTREE_WALK_ROUNDS`).
`reclaimAssetBlobs` is shared with the bulk asset delete so neither path can
forget the derivatives.

## Binds content's media-asset resolver

`MediaModule.forRoot` binds content-server's **`MEDIA_ASSET_RESOLVER`** port
(`infrastructure/queries/media-asset-resolver.query.ts` — a batched,
workspace-scoped lookup of `media_asset`), so a content record's `field.media`
values can be checked for existence + the field's `accept` restriction on save,
and resolved for display in the editor + revision preview. The resolved ref
carries the **derivative** routes too (`thumbUrl` / `previewUrl`, the same
`?variant=` URLs the library's own tiles use), so a record's media costs the
editor a thumbnail rather than a full-size original; an asset with no derivative
(non-image, SVG, tiny) omits them and the admin falls back to `url`. Same open-host
inversion as i18n binding content's `CONTENT_ENTRY_EXTENSION`: content declares
the port, media binds it (hence the `@ortha-cms/content-server` dependency; no
cycle — content doesn't depend on media). Both modules are global, so content's
`EntryWriterService` resolves the binding regardless of registration order.

## Register with the host

After `WorkspacesPlugin` (routes use `WorkspaceGuard`) and `IdentityPlugin`
(`PermissionsGuard`). The provider(s) + optional resolver are passed in:

```typescript
MediaServerPlugin({
    providers: { local: createLocalStorageProvider(config.plugins.media.local) },
    config: config.plugins.media
});
```

## Migrations

Owns its schema, ships its migrations:
`npx nx run @ortha-cms/media-server:db:generate --name=<change>` then
`npx nx run server:db:migrate`.

## Image derivatives

On upload, raster images are buffered and run through the `ImageProcessor` port
(`domain/image-processor.ts`; Sharp adapter in `infrastructure/image/`): it reads
the source dimensions (persisted to `width`/`height`) and generates WebP
derivatives — **`thumb` (≤320px)** and **`preview` (≤1280px)**, never upscaled —
each stored as its own blob under the same provider via
`PutObject.isVariant` (a reserved `variants/` key namespace, so a derivative can
never overwrite the original). The keys + dims live in the `media_asset.variants`
jsonb column. Generation is best-effort: a source the processor can't decode
(SVG, corrupt bytes) yields no derivatives and never fails the upload. Downloads
serve a derivative via `GET /media/assets/:id/raw?variant=thumb|preview`, falling
back to the original when absent — matched with `Object.hasOwn`, since `variants`
is a plain JSON object and a bare index would take `?variant=toString` for a
stored derivative and hand the provider an `undefined` key. Duplicate copies the derivative blobs too;
delete reclaims them (`Asset.storageKeys`).

## Not yet (follow-ups)

**Video duration probing**, the real S3 adapter, and a `media.asset.deleted`
outbox subscriber for blob GC. (The e2e suites listed here before now exist:
`apps/server-e2e/src/server/media/media-assets.spec.ts` covers derivatives +
variant serving, and the admin side has `media-library.spec.ts` +
`content/media-fields.spec.ts`.)

## Commands

- `npx nx typecheck @ortha-cms/media-server` / `npx nx lint @ortha-cms/media-server`

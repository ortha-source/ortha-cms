# @ortha-cms/media-admin — Test Artifact

> **Unit:** `packages/media/admin` · **Package:** `@ortha-cms/media-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/media/admin/AGENTS.md`
> **Findings verified:** 2026-08-11 — 10 confirmed · 0 deleted · 4 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** the **Media Library** page at `/workspaces/:id/media` (folders sidebar,
asset grid, toolbar, selection bar, detail drawer, upload banner, and the
new-folder / rename / move / upload / delete-confirm dialogs); the entry editor's
**Media tab** and the `field.media` control; the **media picker** dialog reused by
both; the three media **Insights** widgets; and the two **WYSIWYG media sources**
(`Media Library…` and `Upload files…`) that fill `wysiwyg-admin`'s
`WYSIWYG_MEDIA_SLOT`.

**Does NOT own:** the API (`@ortha-cms/media-server`), the rich-text editor
(`@ortha-cms/wysiwyg-admin` — the dependency runs media → wysiwyg, never back),
the entry form itself (`@ortha-cms/content-admin` owns the slots this fills), or
any authorization (`useHasPermission` hides affordances; the server guard is the
boundary — `.cursor/BUGBOT.md`).

- **Entry points**
  - Route: `/workspaces/:id/media` → `MediaLibraryPage`
    (`packages/media/admin/src/lib/pages/MediaLibraryPage/index.tsx:173`), wired by
    `packages/media/admin/src/lib/utils/mediaPlugin/index.tsx`.
  - Slots **filled**: content-admin's `ENTRY_FIELD_CONTROL_SLOT`
    (`MediaFieldControl`), its entry-tab slot (`EntryMediaTab`), insights'
    `INSIGHTS_WIDGET_SLOT` (`MediaStorageWidget`, `MediaUploadsWidget`,
    `MediaAltTextWidget`), and wysiwyg's `WYSIWYG_MEDIA_SLOT`
    (`WysiwygLibrarySource`, `WysiwygUploadSource`).
  - Data layer: `httpMediaGateway`
    (`packages/media/admin/src/lib/infrastructure/httpMediaGateway/index.ts:34`)
    behind the `MediaGateway` port; `useMediaLibrary`
    (`packages/media/admin/src/lib/hooks/useMediaLibrary/index.ts:44`);
    `useUploadQueue` (`.../hooks/useUploadQueue/index.ts:43`); `useMediaInsights`.

- **Runtime prerequisites**
  - A running API (`npm run dev`) with migrations applied, or the `admin-e2e`
    `page.route` mock layer.
  - A signed-in user, an open workspace, and the `media:*` matrix: `media:read`
    gates the queries (`useMediaLibrary(canRead)`), `media:create` the upload and
    new-folder controls, `media:update` rename/move, `media:delete` the delete
    controls.
  - For the Media tab: a content type declaring at least one `field.media`.
  - For the WYSIWYG sources: `wysiwyg-admin` registered, and `MediaPlugin()`
    registered **after** it so the slot exists to fill.

- **How to exercise it manually**
  ```bash
  docker compose up -d && npx nx run server:db:migrate && npm run dev
  ```
  - Library: `http://localhost:4200/workspaces/<id>/media`
  - Media tab: open any record with a media field → the **Media** tab
  - WYSIWYG: open a `richtext` field → **Insert ▸ Media ▸ Media Library…**
  - Insights: `http://localhost:4200/workspaces/<id>/insights`

- **Dependencies that must be healthy:** `@ortha-cms/design-system` (Dialog,
  Drawer, DropdownMenu, ConfirmDialog, Progress, toast), `@ortha-cms/utils-admin`
  (`apiClient`, `ApiError`, `toApiError`), `@ortha-cms/workspaces-admin`
  (`useCurrentWorkspace` — the query keys are workspace-scoped),
  `@ortha-cms/identity-admin` (`useHasPermission`), `@ortha-cms/content-admin`,
  `@ortha-cms/insights-admin`, `@ortha-cms/wysiwyg-admin`.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Media Library page renders folders + assets for the open workspace | `packages/media/admin/src/lib/pages/MediaLibraryPage/index.tsx:173` | ✅ E2E |
| F2 | Folder sidebar tree (depth-first, name-sorted, indented) | `packages/media/admin/src/lib/utils/folderTree/index.ts:266`, `.../components/MediaFoldersNav/index.tsx` | ⚠️ PARTIAL |
| F3 | Navigate into a folder / breadcrumbs back out | `.../hooks/useMediaLibrary/index.ts:105,178` | ⚠️ PARTIAL |
| F4 | Create a folder | `.../components/NewFolderDialog/index.tsx` → `useMediaLibrary:239` | ✅ E2E |
| F5 | Rename a folder or an asset | `.../components/RenameDialog/index.tsx` → `useMediaLibrary:245,253` | ❌ NONE |
| F6 | Delete a folder, with a confirmation naming what goes with it | `MediaLibraryPage:284,304` + `ConfirmDialog` | ✅ E2E |
| F7 | Upload files (dialog, drag-and-drop, file input) | `.../components/UploadDialog/index.tsx:150,185` | ✅ E2E |
| F8 | Per-file upload progress, retry, cancel; batch summary | `.../hooks/useUploadQueue/index.ts:43`, `.../components/MediaUploadBanner/` | ❌ NONE |
| F9 | Asset grid: tiles, thumbnails, kind badge, selection checkbox | `.../components/MediaGrid/MediaAssetCard/index.tsx` | ✅ E2E |
| F10 | Asset detail drawer (metadata, alt, tags, download, copy link) | `.../components/AssetDetailDrawer/index.tsx` | ❌ NONE |
| F11 | Client-side search over name + tags | `useMediaLibrary:129-141` | ❌ NONE |
| F12 | Client-side kind filter and sort (6 orders) | `useMediaLibrary:143-159` | ❌ NONE |
| F13 | Multi-select + bulk bar (download / duplicate / move / delete) | `.../components/MediaSelectionBar/index.tsx` | ❌ NONE |
| F14 | Move assets to another folder | `.../components/MoveAssetsDialog/index.tsx` → gateway `moveAssets:434` | ❌ NONE |
| F15 | Duplicate assets | gateway `duplicateAssets:447` | ❌ NONE |
| F16 | Download one asset / a selection (synthetic `<a download>`) | `MediaLibraryPage:208` | ❌ NONE |
| F17 | Truncation notice when a folder holds more than one page | `MediaLibraryPage:202-204, 455-465` | ❌ NONE |
| F18 | Load-error state distinct from the empty state | `MediaLibraryPage:331-345` | ⚠️ PARTIAL |
| F19 | Empty state, filtered vs genuinely empty | `.../components/MediaEmptyState/index.tsx` | ✅ E2E |
| F20 | Permission gating of every control | `MediaLibraryPage:176-180` | ✅ E2E |
| F21 | Entry editor **Media tab** — one card per media field | `.../components/EntryMediaTab/index.tsx` | ✅ E2E |
| F22 | `MediaFieldControl` — pick, stage-an-upload, reorder, remove | `.../components/MediaFieldControl/index.tsx` | ✅ E2E |
| F23 | Staged uploads sent only when the record is saved | `.../hooks/usePendingMediaUploads/index.ts` | ✅ E2E |
| F24 | Dangling media reference renders as "unavailable", not as a raw id | `.../components/MediaFieldControl/MediaFieldItem/index.tsx:28,133` | ✅ E2E |
| F25 | Media picker dialog — folder walk, kind restriction, search | `.../components/MediaPickerDialog/index.tsx:167` | ✅ E2E |
| F26 | WYSIWYG source: **Media Library…** | `.../components/WysiwygLibrarySource/index.tsx` | ✅ E2E |
| F27 | WYSIWYG source: **Upload files…** | `.../components/WysiwygUploadSource/index.tsx` | ⚠️ PARTIAL |
| F28 | Insights: storage / uploads / alt-coverage widgets | `.../components/MediaStorageWidget/`, `MediaUploadsWidget/`, `MediaAltTextWidget/` | ⚠️ PARTIAL |

## 3. Manual Test Plan

All blocks: signed in, a workspace open, `media:*` held unless stated otherwise.
Quoted strings are the real `defineMessages` defaults.

### F1 — The library renders

**Preconditions:** a workspace with 2 folders and 3 root assets.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Navigate to `/workspaces/<id>/media` | the sticky `MediaTopBar` with the breadcrumb "All media"; a folders sidebar; a grid |
| 2 | Count the tiles | 2 folder cards then 3 asset cards |
| 3 | Switch workspace and return | the grid refetches — the query key is workspace-scoped (`mediaKeys.assets(workspaceId, folderId)`) |

**Keyboard-only path:** Tab reaches the sidebar's folder buttons, then the
toolbar's search box, kind filter, sort, **New folder**, **Upload**, then each
tile's open button, its selection checkbox, and its ⋯ menu.
**Screen-reader expectation:** the page has one `<h1>` from the shared header; the
selection count is announced from the `sr-only aria-live="polite"` paragraph at
`MediaLibraryPage:406`.

### F2 — Folder tree

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Create `Brand`, then `Logos` inside it | the sidebar shows `Logos` indented one level under `Brand` |
| 2 | Create `Archive` | `Archive` sorts before `Brand` (name ascending, `folderTree:272`) |
| 3 | Collapse the sidebar on a narrow viewport | the nav moves into the `Drawer` (`MediaLibraryPage:500`) |

### F3 — Navigation

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click `Brand` | the breadcrumb becomes `All media / Brand`; the grid shows `Brand`'s children and assets |
| 2 | Select two assets, then click `Logos` | the selection is dropped (`navigateTo` → `clearSelection`) |
| 3 | Click `All media` in the breadcrumb | back at the root |
| 4 | Reload the page while inside `Brand` | **you land at the root** — the open folder is component state, not a URL param (see EC-24) |

### F4 — Create a folder

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press **New folder** | a dialog with a labelled name input |
| 2 | Type `Campaign` and submit | the dialog closes, a success toast fires, the sidebar and grid refetch |
| 3 | Submit an empty name | the server returns `400`; the toast shows the API message |
| 4 | Create it while inside `Brand` | the new folder is a child of `Brand` (`createFolder` defaults `parentId` to `currentFolderId`) |

### F5 — Rename

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | ⋯ on a folder → **Rename**, type `Brand assets`, submit | the tree updates; a toast fires |
| 2 | ⋯ on an asset → **Rename**, type `hero.png`, submit | the tile's filename updates |
| 3 | Rename an asset to `a/b.png` | the server `400`s; the toast shows "File name … is invalid" |

### F6 — Delete a folder

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | ⋯ on a folder holding 2 subfolders and 5 assets → **Delete** | a `ConfirmDialog` naming the folder **and** what goes with it |
| 2 | Confirm | the folder and its whole subtree disappear; a toast fires |
| 3 | Delete an empty folder | the confirmation says the folder is empty (pinned by `media-library.spec.ts:82`) |
| 4 | Cancel | nothing is deleted; focus returns to the ⋯ trigger |

### F7 — Upload

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press **Upload** | the upload dialog opens with a drop zone and a **file input** (`UploadDialog:185`) |
| 2 | Choose two files via the input | both appear as staged rows with name + size |
| 3 | Drag two files onto the drop zone | same (`UploadDialog:150`) |
| 4 | Confirm | the dialog closes; the `MediaUploadBanner` appears; on completion the grid refetches once |
| 5 | Upload while inside `Brand` | the files land in `Brand` — the folder is captured **per file at enqueue** (`useUploadQueue:147`), so navigating away mid-upload does not redirect them |

### F8 — Upload progress, retry, cancel

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload five large files | at most `UPLOAD_CONCURRENCY` are `Uploading`; the rest are `Pending` |
| 2 | Read the banner headline | "Uploading 3 of 5 · 47%", in a `role="status"` region (`MediaUploadBanner:89`) |
| 3 | Press **Cancel** on an in-flight row | the row becomes `Cancelled`; the request aborts |
| 4 | Kill the API and upload | the row becomes `Failed` with the server message, or "Upload failed" |
| 5 | Press **Retry** on the failed row | it re-queues and runs |
| 6 | Press **Dismiss** | settled rows clear; in-flight rows stay |
| 7 | Navigate away mid-upload | every in-flight request aborts (`useUploadQueue:209-214`) |

### F9 — The grid

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Inspect an image tile | a thumbnail (the `?variant=thumb` URL), the filename, a kind badge |
| 2 | Inspect a document tile | a kind glyph instead of a thumbnail |
| 3 | Click the thumbnail or filename | the detail drawer opens |
| 4 | Click the checkbox | the tile is selected; the selection bar appears |

### F10 — Detail drawer

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open an image's drawer | a preview, then rows: kind, MIME, size, dimensions, uploader, created, folder |
| 2 | Edit **Alt text** and save | a `PATCH`; the drawer and grid refresh |
| 3 | Edit **Tags** | same |
| 4 | Press **Copy link** | the raw URL is on the clipboard; a toast confirms |
| 5 | Press **Download** | the browser downloads the file under its original name |
| 6 | Delete the open asset from the grid | the drawer closes on its own once the refetch removes the row |

### F11 — Search

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Type `logo` | tiles narrow to names **or tags** containing `logo`, case-insensitively |
| 2 | Type a term matching nothing | the filtered empty state, offering **Clear filters** |
| 3 | In a folder holding 250 assets, search for a file uploaded first | **no result** — search runs client-side over the loaded page only (see `🐞 BUG-media-admin-01`) |

### F12 — Filter and sort

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Kind → **Images** | only image tiles |
| 2 | Sort → **Name A–Z / Z–A / Oldest / Largest / Smallest / Newest** | each reorders the tiles |
| 3 | Combine search + kind + sort | all three compose |
| 4 | Note the scope | every one of them applies to the loaded page only, never to the folder (same bug) |

### F13 — Selection and bulk actions

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Select 3 assets | the bar shows the count; the `sr-only` live region announces it |
| 2 | **Download** | three downloads; one toast "3 files" |
| 3 | **Duplicate** | three copies named `… copy.ext`; a toast |
| 4 | **Move** → pick a folder | all three move; the counts shift |
| 5 | **Delete** → confirm | all three go; the selection clears |
| 6 | **Clear** | the bar disappears |

### F14 — Move

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open **Move** | a destination list rendered from the same flattened tree as the sidebar |
| 2 | Pick **All media** | the assets move to the root (`folderId: null`) |
| 3 | Pick the folder they are already in | the server no-ops (`Asset.moveTo` is idempotent) |

### F15–F16 — Duplicate and download

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | ⋯ → **Duplicate** on one asset | one copy; a toast |
| 2 | ⋯ → **Download** | a synthetic `<a download>` click (`MediaLibraryPage:208-217`) |
| 3 | Download 20 selected assets | 20 rapid link clicks — most browsers block after the first few (see EC-19) |

### F17 — Truncation notice

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Put 250 assets in one folder and open it | a `role="status"` line: "Showing 100 of 250" (`MediaLibraryPage:455-465`) |
| 2 | Look for a pager | **there is none** |
| 3 | Search for one of the 150 unloaded assets | "no results", with the truncation line still above it |

### F18 — Error vs empty

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Stop the API and reload | the error state with a `role="alert"` message and a **Retry** button — *not* the empty state (`MediaLibraryPage:331-345`) |
| 2 | Press **Retry** | both queries refetch |
| 3 | Fail only the assets query, leaving folders fine | the whole page shows the error (`isError` ORs both) — the sidebar is lost too |

### F19–F20 — Empty state and permissions

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open an empty folder | "nothing here yet", with **Upload** if `media:create` |
| 2 | As a `viewer` | the page renders read-only: no Upload, no New folder, no ⋯ write actions; pinned by `media-library.spec.ts:101` |
| 3 | Without `media:read` | a no-access state; the queries never fire (`useMediaLibrary(canRead)`) |

### F21–F24 — The Media tab and field control

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open a record with media fields → **Media** | one card per field, each with its own empty state |
| 2 | **Choose from library** | the picker opens, restricted to the field's `accept` kinds |
| 3 | Pick an asset and save | the field stores the asset id; the card shows name + thumbnail |
| 4 | Stage an upload and **do not save** | nothing is uploaded (`media-fields.spec.ts:153`) |
| 5 | Stage an upload and save | the file uploads, then the record saves with the new id |
| 6 | On a `multiple` field, add three and reorder | the order persists |
| 7 | Delete a referenced asset in another tab, then reload the record | the item renders as **unavailable** with a hint, in destructive styling — not a raw uuid (`MediaFieldItem:133`) |
| 8 | As a user without `media:read` | library picking is disabled (`media-fields.spec.ts:337`) |

### F25 — The picker

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open it from a field accepting images only | only image tiles are selectable |
| 2 | Walk into a folder and back via the breadcrumb | the grid follows (`media-fields.spec.ts:115`) |
| 3 | Search inside the picker | filters the loaded page |
| 4 | Confirm the workspace scope | every request carries the ambient `X-Workspace-Id`; there is no workspace switcher inside the picker, so an asset from another workspace is unreachable by construction |

### F26–F27 — WYSIWYG sources

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | In a rich-text field: **Insert ▸ Media** | entries **Media Library…**, **Upload files…**, and the built-in **From a URL** |
| 2 | Pick a library image | it is inserted as an `<img>` carrying the asset's own `alt` (`wysiwyg-fields.spec.ts:608`) |
| 3 | Upload from inside the body | the file lands in the library **and** in the text |
| 4 | Abandon the record without saving after an upload | the asset stays in the library — an intentional one-way effect (`WysiwygUploadSource:57`) |
| 5 | Pick a video | a `<video controls>` node |

### F28 — Insights widgets

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open Insights | **Storage**, **Uploads**, **Alt text coverage** in the _Localisation & media_ band |
| 2 | Storage | count **and** bytes per kind |
| 3 | Alt coverage | a meter; an image with a blank alt counts as **not** covered |
| 4 | Empty workspace | each card shows its own empty state, not a spinner |
| 5 | Stop the API | each card shows its own error state independently |

## 4. Edge Cases & Negative Paths

### Paging, filtering and state

- **EC-01 — A folder with more than `ASSETS_PAGE_SIZE` (100) assets.** `❌ NONE`
  Trigger: upload 250 files into one folder.
  Expected: a pager, or infinite scroll.
  Suspected: one fixed request `pageSize: 100`
  (`infrastructure/httpMediaGateway/index.ts:21, 55`), the `total` in the
  response **discarded** (`:361` maps `data.items` only), and a truncation notice
  with no way to reach the rest → `🐞 BUG-media-admin-01`.
- **EC-02 — Search for an asset outside the loaded page.** `❌ NONE` Same bug; the
  notice does not say the filters are page-scoped.
- **EC-03 — Sort by "Oldest" in a truncated folder.** `❌ NONE` Sorts the newest 100
  ascending — i.e. it shows the *newest* assets in oldest-first order, which reads
  as the opposite of what was asked. Same bug.
- **EC-04 — Delete the last asset in a folder.** `❌ NONE` The grid shows the empty
  state; no pager to clamp (there is none), so the classic
  `.cursor/BUGBOT.md` "stale page after mutation" does not apply here.
- **EC-05 — Filters survive a refetch.** `❌ NONE` `search`/`kindFilter`/`sort` are
  component state, untouched by `invalidate()`. Correct.
- **EC-06 — Selection survives a delete of some selected rows.** `❌ NONE`
  `deleteAssets` removes the ids from the selection eagerly
  (`useMediaLibrary:272-276`). But it does so **before** the mutation resolves, so
  a failed delete leaves the rows on screen and un-selected. Minor.
- **EC-07 — Selection survives a folder change.** `❌ NONE` Cleared by `navigateTo`.
  Correct.
- **EC-08 — `selectedAssets` after a refetch drops rows.** `❌ NONE`
  `selectedIds` may name ids no longer in `assets`; `selectedAssets` filters, so the
  bar's count (`selectedIds.length`) and the acted-on set can disagree by one after
  a concurrent delete. Low.

### Uploads

- **EC-09 — Cancel an in-flight upload the server has already committed.** `❌ NONE`
  `cancel` only calls `controller.abort()` (`useUploadQueue:181-184`). If the body
  was fully received, `UploadAssetUseCase` commits and the blob lands; the client
  shows **Cancelled** and never refetches (`successRef` is not set), so the asset is
  invisible until a manual reload → `🐞 BUG-media-admin-04`.
- **EC-10 — Upload a file larger than the server cap.** `❌ NONE`
  `413`; `ApiError.message` is "File exceeds the maximum upload size." and appears
  on the row. Correct — but nothing checks the size **before** sending, so the user
  waits for a full 200 MB transfer to be told no.
- **EC-11 — A proxy strips `Content-Length` so `event.total` is absent.** `❌ NONE`
  `onUploadProgress` returns early (`httpMediaGateway:413`), so the row sits at 0%
  and the batch percent under-reports until completion. Documented in the comment;
  the UI shows a stalled-looking bar rather than an indeterminate one.
- **EC-12 — Upload 200 files at once.** `❌ NONE` Concurrency-limited by `pump`, but
  every `File` is retained in `filesRef` until dismissed, and each row re-renders
  the whole list on every progress patch (`patch` maps the array). Perf only.
- **EC-13 — Retry a **cancelled** row after the library unmounted and remounted.** `❌ NONE`
  `filesRef` is per-hook-instance, so a remount loses every `File`; the rows are
  gone with it. Consistent.
- **EC-14 — Two batches overlapping.** `❌ NONE`
  `successRef` is a single flag for "the current batch produced a success"; a second
  `enqueue` while the first is draining shares it, so `onUploaded` fires once for
  both. Acceptable (it only drives an invalidate) but not what the JSDoc says
  ("once per settled batch").
- **EC-15 — Drag a **folder** onto the drop zone.** `❌ NONE`
  `event.dataTransfer.files` is empty for a directory in most browsers, so nothing
  is staged and nothing is said.
- **EC-16 — Drop files while lacking `media:create`.** `❌ NONE`
  `MediaFieldControl:389,403` guards with `canStage`; the library's `UploadDialog`
  is only reachable from a gated button. Correct.
- **EC-17 — `dismissSettled` mutates a ref inside a state updater.** `❌ NONE`
  `useUploadQueue:196-205` deletes from `filesRef` inside the `setItems` callback.
  Under StrictMode the updater runs twice; the delete is idempotent so there is no
  visible bug, but it is a side effect in a place React reserves the right to
  re-run. Low, worth noting.

### Mutations and partiality

- **EC-18 — Move 50 assets, one of which was deleted by someone else.** `❌ NONE`
  `moveAssets` fires 50 independent `PATCH`es via `Promise.all`
  (`httpMediaGateway:437-441`). The first rejection surfaces; the other 49 still
  ran. The user sees an error toast over a **partially applied** move →
  `🐞 BUG-media-admin-02`.
- **EC-19 — Bulk download 20 assets.** `❌ NONE`
  20 synthetic `<a download>` clicks in a tight loop
  (`MediaLibraryPage:208-217, 435`). Chrome and Firefox both throttle or block
  after the first few, so the toast claims "20 files" while 3 arrive →
  `🐞 BUG-media-admin-05`.
- **EC-20 — Duplicate 50 assets.** `❌ NONE` Same `Promise.all` shape as EC-18; 50
  concurrent byte-copies server-side.
- **EC-21 — Any mutation invalidates `mediaKeys.all(workspaceId)`.** `❌ NONE`
  `useMediaLibrary:81-83` — a rename refetches the folder tree **and** the asset
  page. `.cursor/BUGBOT.md` calls this out ("Over-invalidation … broad
  invalidation causes refetch storms and flicker"). Defensible here (counts live on
  the folders query) but never narrowed.
- **EC-22 — Delete an asset referenced by a published entry.** `❌ NONE`
  Nothing warns. The server deletes it; the entry's media field then renders as
  **unavailable** on next open (`MediaFieldItem:133`), and the public API's media
  resolve drops it. So the reference is *handled*, but the destructive action is
  taken without telling the user anything is pointing at it →
  `🐞 BUG-media-admin-03`.
- **EC-23 — A folder whose `parentId` names a folder not in the list.** `❌ NONE`
  `flattenFolderTree` only emits folders reachable from the root sentinel
  (`utils/folderTree/index.ts:266-278`), so an orphan is **silently invisible** in
  both the sidebar and the move dialog, while its assets are still counted. No
  cycle guard either — a cyclic response would recurse until the stack blows. Not
  reachable via the API today (there is no move-folder route), so Low.

### Routing, tenancy and errors

- **EC-24 — Deep-link to a folder.** `❌ NONE`
  `currentFolderId` is `useState` (`useMediaLibrary:49`), never a URL param — so a
  folder cannot be linked, bookmarked, or restored after a reload, and browser Back
  leaves the library entirely rather than going up a level. Every sibling admin
  plugin puts list state in the URL (i18n's `?locale=`, content's records params).
  → `🐞 BUG-media-admin-06`.
- **EC-25 — Selecting an asset from another workspace.** `❌ NONE`
  Not expressible: every request carries the ambient `X-Workspace-Id` and the
  picker has no workspace control. Checked and cleared.
- **EC-26 — Switch workspace with the library open.** `❌ NONE`
  Query keys are workspace-scoped, so the data refetches — but `currentFolderId`
  is **not** reset, so the page asks the new workspace for a folder id that belongs
  to the old one. `GET /assets?folderId=<foreign uuid>` returns an empty page
  (server-side workspace filter), so the user sees an empty folder with a
  breadcrumb naming a folder they cannot see. Medium-low; folded into
  `🐞 BUG-media-admin-06`.
- **EC-27 — The folders query fails but assets succeed.** `❌ NONE`
  `isError` ORs both (`useMediaLibrary:294`), so the whole page goes to the error
  state. Conservative and arguably right; noted so nobody "fixes" it into a
  half-rendered page.
- **EC-28 — A mutation fails.** `❌ NONE`
  `onError` toasts and re-invalidates (`useMediaLibrary:86-96`) — the correct
  "resync from the server" shape.
- **EC-29 — `ApiError` with an empty message.** `❌ NONE`
  Falls back to "Something went wrong. Please try again." Correct.

### 4A. Accessibility & Section 508 Conformance

**Baseline:** there is **no `apps/admin-e2e/src/media/a11y.spec.ts`** and no media
keyboard suite. What exists is a single inline axe scan of the library's default
state (`apps/admin-e2e/src/media/media-library.spec.ts:115-125`) and one of the
entry Media tab with the picker open (`apps/admin-e2e/src/content/media-fields.spec.ts:355`).
Neither scans a dialog, the drawer, the upload banner mid-flight, or the selection
bar; and axe cannot see keyboard order, focus return, or announcement timing at
all. So: **automated a11y coverage for this unit is one snapshot, and conformance
is unproven.**

This unit is materially better than the repo average — named icon buttons, a
`role="alert"` error state, a `role="status"` truncation line, an `sr-only`
`aria-live` selection count, labelled progress bars, and `ConfirmDialog` for
destructive actions. The findings below are the gaps that remain.

#### ♿ A11Y-media-admin-01 — Alt text is never prompted at upload; it is a later, optional edit in a drawer
**WCAG:** 1.1.1 Non-text Content (A) · **508:** 504.3 (prompts), 504.2 · **Verdict: Partially Supports**
**Location:** `packages/media/admin/src/lib/components/UploadDialog/index.tsx` (staged rows carry name + size only), alt lives at `.../components/AssetDetailDrawer/index.tsx`
**Repro:** upload three images → each lands with `alt: null`. Nothing in the upload
dialog, the banner, or the grid asks for a description; the only route to alt is
⋯ → open the drawer → find the Alt field → save, per asset.
**Keyboard-only / SR experience:** an author who never opens the drawer produces a
library of undescribed images, and neither the tile nor the grid signals the gap —
the only feedback is the **Insights** alt-coverage card, which is an audit after the
fact rather than a prompt during authoring. Compare `wysiwyg-admin`, which *does*
prompt: an un-alt'd image in a body shows a warning-tinted "Add alt text" chip
(`♿ A11Y-wysiwyg-admin-03`). The library has no equivalent.
**Remediation:** add an optional alt field to each staged row in `UploadDialog`
(sent as part of the upload once `UploadAssetDto` accepts it — see
`♿ A11Y-media-server-03`), and tint the tile of an image with no alt, mirroring the
editor's chip.

#### ♿ A11Y-media-admin-02 — Alt text is per asset, so the same image cannot be described differently in two contexts
**WCAG:** 1.1.1 Non-text Content (A) · **508:** 504.2 · **Verdict: Partially Supports**
**Location:** `packages/media/admin/src/lib/components/MediaThumbnail/index.tsx:53` (`alt={asset.alt ?? ''}`), `.../components/MediaFieldControl/index.tsx`
A `field.media` value is a bare uuid, so a record referencing an asset has nowhere
to record what that image means *here*. The library's single `alt` is what every
consumer gets. The rich-text editor escapes this by storing alt on the node, which
is the right model — and is exactly why the divergence matters: an image inserted
in a body can be described per usage, the same image in a media field cannot.
**Keyboard-only / SR experience:** a logo used as a decorative flourish on one page
and as the sole content of a hero on another is announced identically in both.
**Remediation:** allow a media field value to be `{ id, alt? }` and let the field
control offer a per-usage override, falling back to the asset's alt. Depends on
`♿ A11Y-media-server-01`.

#### ♿ A11Y-media-admin-03 — No captions/subtitles can be attached to a video asset, and the preview offers no track
**WCAG:** 1.2.2 Captions (Prerecorded) (A), 1.2.3 Audio Description (A) · **508:** 503.4, 504.2 · **Verdict: Does Not Support**
**Location:** `packages/media/admin/src/lib/components/AssetDetailDrawer/index.tsx` (metadata rows: kind, MIME, size, dimensions, uploader, created, folder, alt, tags — no captions), schema at `packages/media/server/src/lib/infrastructure/schema/media-asset.ts:40-75`
There is no UI to attach a caption file because there is no field to attach it to
(`♿ A11Y-media-server-02`). A `.vtt` uploaded to the library is an unrelated
`document` asset. The drawer's own video preview and the editor's inserted
`<video controls>` therefore both play uncaptioned, with no author-facing path to
change that.
**Keyboard-only / SR experience:** deaf and hard-of-hearing users get audio-only
information from every video the CMS publishes. 503.4 additionally requires user
control over captions where they exist — moot while none can.
**Remediation:** blocked on the schema. Once `media_asset` can hold a caption
reference, add a "Captions" row to the drawer with an upload/pick control
restricted to `text/vtt`, and surface it on `AssetView` so the editor can emit
`<track>`.

#### ♿ A11Y-media-admin-04 — Drag-and-drop has a keyboard equivalent in the dialog, but the field control's drop zone does not announce itself
**WCAG:** 2.1.1 Keyboard (A), 4.1.2 Name, Role, Value (A) · **508:** 502.3 · **Verdict: Partially Supports**
**Location:** `packages/media/admin/src/lib/components/UploadDialog/index.tsx:150,185` (drop zone **and** `<input type="file">` — good), `packages/media/admin/src/lib/components/MediaFieldControl/index.tsx:389-409`
The library's `UploadDialog` pairs the drop zone with a real file input, so
drag-and-drop is not the only route — **2.1.1 is met there**. The `MediaFieldControl`
adds a second drop target on the field card itself (`onDragOver`/`onDrop`), and that
one is a plain `<div>` with drag handlers: it has no role, no name, and no
indication to a screen-reader user that dropping is possible. The card's own
"Upload" button is the keyboard equivalent, so nothing is unreachable, but the
affordance is announced to sighted mouse users only.
**Remediation:** give the field's drop zone an `aria-label` describing the
drop-or-press affordance, and keep the button as the programmatic path.

#### ♿ A11Y-media-admin-05 — Focus is not moved after a destructive action or a drawer close
**WCAG:** 2.4.3 Focus Order (A) · **508:** 502.2 · **Verdict: Partially Supports**
**Location:** `packages/media/admin/src/lib/pages/MediaLibraryPage/index.tsx:284-303` (`confirmDelete`), `.../components/AssetDetailDrawer/index.tsx`
Design-system `ConfirmDialog` and `Drawer` are Radix-backed, so focus **is**
restored to the trigger on close — which is the common case and is correct. The gap
is the one where the trigger no longer exists: deleting the asset whose ⋯ menu
opened the dialog removes that tile, so focus restoration targets a detached node
and lands on `<body>`. A keyboard user is then at the top of the document with no
indication of what happened.
**Repro:** Tab to a tile's ⋯ → Delete → Confirm → press Tab.
→ Observed: focus starts from the document root.
→ Expected: focus moves to the grid, or to the following tile.
**Remediation:** after a delete resolves, move focus explicitly to the grid
container (or the next tile) rather than relying on restoration.

#### ♿ A11Y-media-admin-06 — The upload banner announces the batch headline but not per-file failure
**WCAG:** 4.1.3 Status Messages (AA), 3.3.1 Error Identification (A) · **508:** 502.2 · **Verdict: Partially Supports**
**Location:** `packages/media/admin/src/lib/components/MediaUploadBanner/index.tsx:89` (`role="status"` on the headline only — deliberately, per the comment at `:40-42`), `.../MediaUploadRow/index.tsx:85,118`
Scoping the live region to the headline is the right call (a polite region over the
whole list would read all N rows on every progress tick). The consequence is that a
**single file failing** in an otherwise-successful batch changes only that row —
which is outside the live region — so it is never announced. The headline's counts
do include `failed`, so the number moves, but nothing says which file or why.
**Repro:** upload five files with one oversized; the row shows "File exceeds the
maximum upload size." visually and silently.
**Remediation:** announce transitions to `Failed`/`Cancelled` through a separate
polite region carrying "{name}: {error}", leaving the progress ticks out of it.

#### ♿ A11Y-media-admin-07 — Colour contrast in both themes is unverified for the media-specific tokens
**WCAG:** 1.4.3 Contrast (Minimum) (AA), 1.4.11 Non-text Contrast (AA) · **508:** E205.4 · **Verdict: Unverified**
**Location:** `packages/media/admin/src/lib/utils/assetGradient/index.ts`, `.../components/MediaKindBadge/index.tsx`, `.../components/MediaThumbnail/index.tsx:49` (`bg-black/5` overlay)
`assetGradient` generates a per-asset colour used behind the kind glyph on tiles
with no thumbnail; the glyph's contrast against a *generated* background is not
something the design system's tokens can guarantee, and the single axe scan
(`media-library.spec.ts:124`) runs against a seeded fixture that may not exercise
the range. The `bg-black/5` overlay on thumbnails also darkens whatever the image
is, which affects any text composited over it.
**I did not verify the computed ratios** — this is flagged as **Unverified** and is
the reason §7 proposes a dedicated a11y suite scanning both themes with a fixture
covering every kind.

#### ♿ A11Y-media-admin-08 — Reduced motion and forced colours are not addressed in this unit
**WCAG:** 2.3.3 (AAA, advisory), 1.4.1 Use of Colour (A) · **508:** 503.2 · **Verdict: Unverified**
**Location:** `packages/media/admin/src/lib/components/MediaUploadBanner/`, `.../MediaGrid/`
No `motion-reduce:` utility appears anywhere in `packages/media/admin`
(`grep -rn "motion-reduce" packages/media/admin` → no matches), unlike
`i18n/admin`'s overlay which does carry one. The progress bar's animation and the
drawer transitions come from the design system, so they may already respect it —
unverified here. Kind is conveyed by badge **text** as well as glyph colour, so
1.4.1 looks satisfied for the grid.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 library renders | `apps/admin-e2e/src/media/media-library.spec.ts:21` | folders and assets from the mocked API appear | ✅ E2E |
| F2 folder tree | `media-library.spec.ts:21` | folders listed | ⚠️ PARTIAL — nesting/indentation/ordering unasserted |
| F3 navigation | `apps/admin-e2e/src/content/media-fields.spec.ts:115` | folder walk **inside the picker** only | ⚠️ PARTIAL — the library's own breadcrumb is untested |
| F4 create folder | `media-library.spec.ts:53` | dialog → folder appears | ✅ E2E |
| F5 rename | — | — | ❌ NONE |
| F6 folder delete | `media-library.spec.ts:62`, `:82` | the confirmation warns that contents go too; an empty folder says so | ✅ E2E |
| F7 upload | `media-library.spec.ts:34` | a file uploads and shows in the grid | ⚠️ PARTIAL — the drop-zone path and the file-input path are not distinguished |
| F8 progress/retry/cancel | — | — | ❌ NONE |
| F9 grid | `media-library.spec.ts:21` | tiles render | ⚠️ PARTIAL — badge/thumbnail/checkbox unasserted |
| F10 detail drawer | — | — | ❌ NONE |
| F11 search | — | — | ❌ NONE |
| F12 filter/sort | — | — | ❌ NONE |
| F13 bulk bar | — | — | ❌ NONE |
| F14 move | — | — | ❌ NONE |
| F15 duplicate | — | — | ❌ NONE |
| F16 download | — | — | ❌ NONE |
| F17 truncation | — | — | ❌ NONE |
| F18 error vs empty | `apps/admin-e2e/src/content/media-fields.spec.ts:286` | "says the library failed to load, not that it is empty" — **for the picker** | ⚠️ PARTIAL — the library page's own error state is untested |
| F19 empty state | `media-library.spec.ts:82` | empty folder copy | ✅ E2E |
| F20 permissions | `media-library.spec.ts:101`; `media-fields.spec.ts:309`, `:337` | no-access without `media:read`; no upload without `media:create`; picking disabled without `media:read` | ✅ E2E |
| F21 Media tab | `media-fields.spec.ts:60` | a card per field with its empty state | ✅ E2E |
| F22 field control | `media-fields.spec.ts:79`, `:173` | pick + save the id; append and reorder a multiple field | ✅ E2E |
| F23 staged uploads | `media-fields.spec.ts:131`, `:153` | staged and sent only on save; dropped without ever uploading | ✅ E2E |
| F24 dangling ref | `media-fields.spec.ts:205`, `:240`, `:263` | names not ids; waits for the ref; falls back when the read resolves nothing | ✅ E2E |
| F25 picker | `media-fields.spec.ts:103`, `:115` | `accept` restriction; folder walk | ✅ E2E |
| F26 library source | `apps/admin-e2e/src/content/wysiwyg-fields.spec.ts:424`, `:608` | an asset picked from the library is placed; its alt carries into the body | ✅ E2E |
| F27 upload source | `wysiwyg-fields.spec.ts:354` | the contributed sources are offered beside the URL entry | ⚠️ PARTIAL — the upload path itself is not driven |
| F28 insights | `apps/admin-e2e/src/insights/insights.spec.ts` | the cards render | ⚠️ PARTIAL — per-widget empty/error states unasserted |
| **a11y** | `media-library.spec.ts:115-125`, `media-fields.spec.ts:355` | axe, no violations, on the library's default state and on the Media tab with the picker open | ⚠️ PARTIAL — **no dedicated `a11y.spec.ts`, no keyboard suite**; dialogs, drawer, banner and selection bar are never scanned |

**Coverage tally:** `28 features · 12 ✅ · 8 ⚠️ · 8 ❌`

## 6. 🐞 Potential Bugs

### 🐞 BUG-media-admin-01 — The library loads one fixed page of 100 assets and filters, sorts and searches only within it, so anything beyond is unreachable · Severity: Medium

**Location:** `packages/media/admin/src/lib/infrastructure/httpMediaGateway/index.ts:20-21, 51-61`; `packages/media/admin/src/lib/hooks/useMediaLibrary/index.ts:63-69, 129-161`
**Category:** correctness / ux-state

**What the code does:**
```typescript
/** Assets fetched per folder page — one large page (client-side filter/sort). */
const ASSETS_PAGE_SIZE = 100;
…
const { data } = await apiClient.get<AssetListResponse>('/media/assets', {
    params: { folderId: folderParam(folderId), pageSize: ASSETS_PAGE_SIZE }
});
return data.items.map(toMediaAsset);
```
`data.total`, `data.page` and `data.pageSize` are discarded. `useMediaLibrary` then
applies `search`, `kindFilter` and `sort` to that array in memory
(`:129-161`) — the server's own `?search=`, `?kind=`, `?sort=`, `?page=` are never
sent. `100` is also exactly the server's `MAX_PAGE_SIZE`
(`packages/media/server/src/lib/http/controllers/list-assets.controller.ts:14`), so
the page cannot simply be enlarged.

**Why it is wrong:** the server implements paging, searching, filtering and six
sort orders (`list-assets.query.ts:44-117`) and the admin uses none of them. The
consequences compound:
- a folder with 250 assets shows 100, with **no pager anywhere on the page**;
- **search reports "no results" for a file that exists**, because it only ever
  looked at the loaded page — and the filtered empty state offers "Clear filters",
  which will not help;
- **sort lies**: "Oldest" sorts the *newest 100* ascending, so the oldest asset in
  the folder is not shown even though the control claims to have found it.

The page does surface the shortfall — `isTruncated` renders "Showing {shown} of
{total}" in a `role="status"` line (`MediaLibraryPage:202-204, 455-465`), which is
honest, and — together with the fact that the data is only invisible, never lost or
exposed — is why this is **Medium rather than High**. But the notice's own wording
is `'Showing the first {shown} of {total} items. Search or filter to narrow the
list.'` (`MediaLibraryPage:59`), which points the user at the two controls that are
themselves page-scoped, and there is no control that reaches the rest.

**Repro:**
1. Upload 250 files into one folder (any names).
2. Open the folder → "Showing 100 of 250".
3. Note the first file you uploaded, then type its exact name into the search box.
→ Observed: the filtered empty state, "no results", with the truncation line still
above it.
→ Expected: the asset, found by a server-side search over the whole folder.
4. Choose sort **Oldest**.
→ Observed: the 100 newest, oldest-first. → Expected: the oldest in the folder.

**Blast radius:** every workspace whose library outgrows 100 assets in any one
folder — which is the normal end state for a CMS media library. Assets become
unreachable through the UI while remaining perfectly reachable through the API, so
the data is not lost, only invisible.

**Suggested fix:** push `search`, `kind`, `sort` and `page` into the query params
(they already exist server-side), key the TanStack query on them, and render the
design-system `Pagination` under the grid — or switch to an infinite-scroll page
list. Keep the truncation notice as a fallback.

---

### 🐞 BUG-media-admin-02 — Bulk move and bulk duplicate fan out N independent requests with `Promise.all`, so a partial failure leaves a partly-applied operation and reports one error · Severity: Medium

**Location:** `packages/media/admin/src/lib/infrastructure/httpMediaGateway/index.ts:130-151`
**Category:** correctness / partiality

**What the code does:**
```typescript
async moveAssets({ ids, folderId }: MoveAssetsInput): Promise<void> {
    const target = folderId === ROOT_FOLDER_ID ? null : folderId;
    try {
        await Promise.all(
            ids.map((id) => apiClient.patch(`/media/assets/${id}`, { folderId: target }))
        );
    } catch (error) {
        throw toApiError(error);
    }
},
async duplicateAssets(ids: string[]): Promise<void> {
    try {
        await Promise.all(ids.map((id) => apiClient.post(`/media/assets/${id}/duplicate`)));
    } …
```
`Promise.all` rejects on the **first** failure while the remaining requests
continue in the background; `toApiError` then reports that one.

**Why it is wrong:** the sibling operation, delete, is a genuine bulk endpoint
(`DELETE /media/assets` with `{ ids }`, one transaction, `{ deleted: n }` back) —
so the plugin already knows the right shape and does not use it for the other two.
The user sees a single error toast over a selection where an arbitrary subset has
moved. `onError` then calls `invalidate()`, so the grid resyncs and the partial
state becomes the new truth silently.

**Repro:**
1. Select 20 assets; in another tab, delete one of them.
2. Press **Move** → pick a folder.
→ Observed: an error toast ("Asset … not found"), and 19 of the 20 have moved.
→ Expected: either all-or-nothing, or a report naming what succeeded and what did
not.
Also observable with a network blip: with 50 selected, one timeout produces one
toast and 49 silent successes.

**Blast radius:** any bulk move or duplicate over a flaky connection or a
concurrently-edited library. No data is destroyed, but the user's mental model of
what happened is wrong.

**Suggested fix:** add bulk `PATCH`/duplicate endpoints server-side (mirroring
`DELETE /media/assets`), or at minimum use `Promise.allSettled` and toast a summary
("Moved 19 of 20; 1 failed") so the partiality is stated.

---

### 🐞 BUG-media-admin-03 — Deleting an asset that a content entry references is never warned about · Severity: Medium

**Location:** `packages/media/admin/src/lib/pages/MediaLibraryPage/index.tsx:284-303` (`confirmDelete`), `.../hooks/useMediaLibrary/index.ts:267-279`
**Category:** data-loss (referential) / ux-state

**What the code does:** the delete confirmation is built from the media domain
alone — for a folder it names the folder and the counts it will take with it; for
assets it names the count. Nothing queries whether any content entry's
`field.media` points at the ids. `deleteAssets` then fires the bulk delete and
eagerly drops the ids from the selection.

**Why it is wrong:** the reference is real and the plugin already knows what a
broken one looks like — `MediaFieldItem` renders a **`missing`** ref as an explicit
"unavailable" warning in destructive styling (`MediaFieldItem/index.tsx:28-34,
133-137`), and the e2e pins the fallback behaviour
(`apps/admin-e2e/src/content/media-fields.spec.ts:263`). So the system is designed
to *survive* dangling references but does nothing to *prevent* one being created,
even though creating one is a single click from a page that has no idea a record
depends on it. The folder-delete confirmation sets the precedent by naming what
will go — it just stops at the media boundary.

**Repro:**
1. Attach `hero.png` to a published article's `coverImage`.
2. Media Library → ⋯ on `hero.png` → **Delete** → confirm.
→ Observed: the confirmation says only "Delete 1 file"; the asset goes; the
article's Media tab now shows an "unavailable" card, and the public API's media
expansion drops the field.
→ Expected: the confirmation names the entries that reference it (or at least warns
that N records do), the way the folder confirmation names its contents.

**Blast radius:** a published page loses its image with no warning at the moment of
deletion and no signal afterwards except opening the record. Anyone with
`media:delete` can do it.

**Suggested fix:** add a server-side "what references this asset?" read (content
already has `MEDIA_ASSET_RESOLVER` and could invert it), and have the confirmation
render the count and the first few record titles — matching the folder
confirmation's existing shape. Blocking is not required; naming is.

---

### 🐞 BUG-media-admin-04 — Cancelling an in-flight upload aborts only the client, so a committed asset is left invisible until a manual reload · Severity: Medium

**Location:** `packages/media/admin/src/lib/hooks/useUploadQueue/index.ts:178-193, 107-133`
**Category:** ux-state / correctness

**What the code does:**
```typescript
const cancel = useCallback((id: string) => {
    const controller = abortsRef.current.get(id);
    if (controller) {
        // The abort rejects the request; `runOne`'s catch marks it.
        controller.abort();
        return;
    }
    …
```
and in `runOne`'s `catch`:
```typescript
if (controller.signal.aborted) {
    patch(id, { status: UPLOAD_STATUS.Cancelled });
    return;
}
```
The `Cancelled` branch returns **before** `successRef.current = true`, so the batch
never triggers `onUploaded()` → no `invalidate()` → no refetch.

**Why it is wrong:** `POST /api/media/assets` is not cancellable. multer buffers
the whole body first; once the last byte is received, `UploadAssetUseCase` writes
the blob and commits the row regardless of whether the client is still listening.
So a cancel pressed in the window between "upload finished sending" and "response
received" produces an asset that exists on the server, is charged to the
workspace's storage, and is **absent from the grid** — the queue row says
`Cancelled`, and nothing refetches.

**Repro:**
1. Throttle the network to a slow profile and upload a 20 MB file.
2. Press **Cancel** just as the progress bar reaches 100%.
→ Observed: the row reads `Cancelled`; the grid is unchanged; `SELECT * FROM
media_asset` shows the row, and the blob is on disk. Reloading the page reveals it.
→ Expected: either the asset is not created, or the UI reconciles (refetch, and
show it as uploaded rather than cancelled).

**Blast radius:** silent storage growth and user confusion; the Insights storage
figure diverges from what the library shows. Worse for large files, which is
exactly when people cancel.

**Suggested fix:** always `invalidate()` when a batch settles, regardless of
outcome, so a cancelled-but-committed asset appears; and/or reconcile by re-listing
the folder after a cancel. A truly cancellable upload would need a server-side
compensating delete keyed on a client-supplied idempotency id.

---

### 🐞 BUG-media-admin-05 — Bulk download fires N synthetic link clicks in a tight loop and reports success for all of them · Severity: Low

**Location:** `packages/media/admin/src/lib/pages/MediaLibraryPage/index.tsx:206-215, 423-428`
**Category:** ux-state

**What the code does:**
```typescript
const downloadAsset = (asset: MediaAsset) => {
    const link = document.createElement('a');
    link.href = asset.url;
    link.download = asset.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
};
…
onDownload={() => {
    store.selectedAssets.forEach(downloadAsset);
    toast.success(intl.formatMessage(messages.tDownload, { name: `${selectedIds.length} files` }));
}}
```
Every selected asset gets an immediate programmatic click, then one unconditional
success toast.

**Why it is wrong:** browsers rate-limit or block multiple automatic downloads from
one user gesture — Chrome prompts once and then suppresses, Firefox and Safari
throttle. So the toast asserts "20 files" while the user receives a handful. The
`download` attribute is also **ignored for cross-origin responses**; it works here
only because `asset.url` is the same-origin `/api/media/assets/:id/raw`, which is a
constraint nothing records (and which a future signed-URL provider would break —
see `♿ A11Y-media-provider-s3-02`).

**Repro:** select 20 assets → **Download**.
→ Observed: a "Downloading 20 files" toast; typically 1–5 files arrive, possibly a
browser permission prompt.
→ Expected: a server-side zip, or a sequential download with real progress, or a
toast that does not claim more than happened.

**Blast radius:** cosmetic but misleading; users believe they have a backup they do
not have.

**Suggested fix:** for a multi-selection, either request a server-built archive or
drive the downloads sequentially with a short delay and report the real count.

---

### 🐞 BUG-media-admin-06 — The open folder is component state, so it cannot be linked, survives no reload, and is not reset when the workspace changes · Severity: Low

**Location:** `packages/media/admin/src/lib/hooks/useMediaLibrary/index.ts:49`
**Category:** ux-state

**What the code does:** `const [currentFolderId, setCurrentFolderId] = useState(ROOT_FOLDER_ID);`
— no `useSearchParams`, no route segment. The asset query key includes it
(`mediaKeys.assets(workspaceId, currentFolderId)`), so the data follows the state,
but the URL never does.

**Why it is wrong:** every sibling admin plugin puts list state in the URL —
`i18n-admin`'s `LocaleSwitcher` owns `?locale=` through `listParamKeys` precisely so
"the records list is scoped to the active locale server-side" and survives a
reload; content-admin's records table does the same for page/sort/filter. The media
library is the outlier, with three consequences:
1. a folder cannot be shared, bookmarked, or reopened after a refresh;
2. browser **Back** leaves the library entirely rather than going up a folder;
3. switching workspace keeps `currentFolderId` pointing at the previous
   workspace's folder id, so the grid asks for a folder the new workspace does not
   own. The server filters by workspace and returns an empty page, so the user sees
   an **empty folder with a breadcrumb naming a folder that is not theirs**
   (`currentFolder` resolves to `null` once the new folders load, so the breadcrumb
   degrades to "All media" only after the folders query settles — a visible flicker
   of a foreign name in between).

**Repro:**
1. Navigate into `Brand`, copy the URL, open it in a new tab → the root.
2. Navigate into `Brand`, press Back → you leave the Media Library.
3. Navigate into `Brand`, switch workspace via the shell → an empty grid.
→ Expected: `?folder=<id>` in the URL, reset on workspace change.

**Blast radius:** everyday friction; no data risk.

**Suggested fix:** move `currentFolderId` into a search param and clear it in an
effect keyed on `workspaceId`.

---

**Tally:** 6 🐞 — 0 Critical, 0 High, 4 Medium, 2 Low.
**♿ tally:** 8 — 0 Supports · 5 Partially Supports · 1 Does Not Support · 0 Not Applicable · 2 Unverified.

**Checked and cleared:** the error state is genuinely distinct from the empty state
and carries `role="alert"` + a retry (`MediaLibraryPage:331-345`) — the
`.cursor/BUGBOT.md` "error masquerading as empty" pattern does **not** apply here,
and the picker has the same treatment (`media-fields.spec.ts:286`); the truncation
shortfall **is** surfaced rather than hidden; the upload folder is captured per file
at enqueue time so navigation cannot misroute in-flight files; in-flight requests
are aborted on unmount; a dangling media reference renders as an explicit
"unavailable" card rather than a raw uuid; every destructive action goes through
`ConfirmDialog`; icon-only controls carry `aria-label`s; permission gating mirrors
the server matrix and the queries are disabled without `media:read`; and selecting
an asset from another workspace is not expressible from the picker.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + `page.route` mock | **`src/media/a11y.spec.ts`** (new) | axe over: the library default state in **both themes**, the upload dialog, the new-folder dialog, the rename dialog, the move dialog, the delete confirmation, the detail drawer, the selection bar, and the upload banner mid-flight; a fixture covering every `MediaKind` so `assetGradient` backgrounds are scanned | ♿ A11Y-media-admin-07, ♿ A11Y-media-admin-08, the ⚠️ a11y row |
| 2 | `apps/admin-e2e` | **`src/media/keyboard.spec.ts`** (new) | a keyboard-only pass: reach the sidebar, toolbar, each tile's open/select/⋯; open and dismiss every dialog with Escape; assert focus **after** a delete lands on the grid, not `<body>`; assert the drawer restores focus to its trigger | ♿ A11Y-media-admin-05 |
| 3 | `apps/admin-e2e` | extend `src/media/media-library.spec.ts` | mock a folder with `total: 250`; assert the truncation line, then assert that typing a name present in the seed but outside the returned page finds it — **failing until paging is server-side** | 🐞 BUG-media-admin-01, F11 ❌, F12 ❌, F17 ❌ |
| 4 | `apps/admin-e2e` | `src/media/media-uploads.spec.ts` (new) | per-file progress, a failing file among successes (row shows the server message, batch continues), Retry re-queues, Cancel aborts, Dismiss clears settled rows only; assert the failure is announced in a live region | F8 ❌, ♿ A11Y-media-admin-06 |
| 5 | `apps/admin-e2e` | extend `src/media/media-library.spec.ts` | select 3 → move/duplicate/delete; assert the requests issued and that a mocked partial failure produces a summary, not a single-error toast | 🐞 BUG-media-admin-02, F13 ❌, F14 ❌, F15 ❌ |
| 6 | `apps/admin-e2e` | `src/media/media-detail.spec.ts` (new) | the drawer's metadata rows; editing alt and tags issues one `PATCH` each; copy-link; the drawer closes when its asset is deleted | F10 ❌ |
| 7 | `apps/admin-e2e` | extend `src/media/media-library.spec.ts` | the library page's **own** error state (not just the picker's): a failing `/media/assets` shows `role="alert"` + Retry, and Retry refetches | F18 ⚠️ |
| 8 | `apps/admin-e2e` | `src/media/media-routing.spec.ts` (new) | navigating into a folder puts it in the URL; a reload restores it; Back goes up a level; switching workspace resets to the root | 🐞 BUG-media-admin-06 |
| 9 | `apps/admin-e2e` | extend `src/content/wysiwyg-fields.spec.ts` | drive **Upload files…** end to end: the file reaches the library **and** the body; abandoning the record leaves the asset in the library | F27 ⚠️ |
| 10 | `apps/admin-e2e` | extend `src/media/media-library.spec.ts` | deleting an asset referenced by an entry shows a confirmation naming the referencing records | 🐞 BUG-media-admin-03 |
| 11 | `apps/admin-e2e` | `src/insights/media-widgets.spec.ts` (new) | each media widget's loading / empty / error state independently; the alt meter's value is available as text, not colour alone | F28 ⚠️, 1.4.1 |

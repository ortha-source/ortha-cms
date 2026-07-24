# @ortha-cms/media-admin

The **Media Library feature plugin** for the Ortha CMS admin UI. It mounts
**inside a workspace** at `/workspaces/:id/media` and ships the asset-management
experience: a folders sidebar beside a searchable/filterable/sortable asset
browser (grid **and** list views), an asset detail drawer, and the
create-folder / upload / rename / move / duplicate / delete flows — now **wired
to `@ortha-cms/media-server`** over `apiClient`.

## Data layer (wired to the API)

The page consumes one hook, **`hooks/useMediaLibrary`**, which is the store the
components read. Its internals use TanStack Query over the gateway; its returned
shape is unchanged from the original mock so no component had to change:

- **`infrastructure/mediaGateway`** — the port (interface) the plugin talks to.
  `uploadFile` is deliberately **singular** and takes `{ onProgress, signal }`;
  batching, concurrency, and retries belong to `useUploadQueue`, not the seam.
- **`infrastructure/httpMediaGateway`** — the **only** place `apiClient` is used;
  maps responses through the ACL and normalizes failures to `ApiError`. Translates
  the admin's `ROOT_FOLDER_ID` sentinel to/from the wire's `null` folder.
- **`infrastructure/mediaMapper`** — wire types (`AssetResponse` / `FolderResponse`)
  + `toMediaAsset` / `toMediaFolder`.
- **`infrastructure/mediaKeys`** — the per-workspace query-key factory; mutations
  invalidate `mediaKeys.all(workspaceId)`.

Folders (with per-folder + root asset counts) and the **open folder's** assets
are fetched; search/kind/sort are applied client-side over that page (a large
`pageSize`) — true server-side pagination is a follow-up. Mutations post to the
API and invalidate the cache; `apiClient` attaches `X-Workspace-Id` automatically
inside the workspace shell.

## Permissions

`MediaLibraryPage` gates on the real matrix via `useHasPermission`: `media:read`
gates the queries (`enabled`) and renders a no-access state when absent;
`media:create` / `media:update` / `media:delete` gate the write controls (mirror
of the server's RBAC, which is the real enforcer).

## What it does

- **Header** — a sticky **`MediaTopBar`** (the shared design-system
  `TopBar`/`TopBarIcon`: the teal `Image` tile matching the plugin's workspace-nav
  entry, plus a breadcrumb Media Library › ancestor folders › open folder). It
  spans **both** panes at the top of the page, the same page-context header every
  other admin page carries. Unlike the Content Library's bar it is **not**
  route-derived — folder navigation here is component state, not a URL segment —
  so crumbs come from the store and dispatch `onNavigate`; they render as
  `BreadcrumbLink`s over real `<button>`s, since a control that changes view
  without changing location is a button. It **replaced** the old in-page
  `MediaBreadcrumbs` (deleted), which would otherwise duplicate the path.
- **Browse** — a left **`MediaFoldersNav`** (folder tree headed by "All media",
  a New-folder action, a storage meter). The main pane shows a title/count, the
  **`MediaToolbar`**, and the content.
- **Flush layout, no island.** Both panes render directly on the page background
  (no muted board, no bordered/rounded/shadowed card), mirroring the Content
  Library's `ContentPane`; a hairline `lg:border-r` divides the sidebar from the
  browser and each pane scrolls independently. The page sizes itself with
  `flex-1` against the workspace shell's `min-h-svh` column rather than its own
  `svh` calc — one viewport measurement in the chain, so no phantom scrollbar at
  non-100% zoom. Component-level cards (asset tiles, the table, the selection
  bar) stay bordered; only the page chrome is flat.
- **One view — the grid.** **`MediaGrid`** (tiles; images render their real
  preview via `asset.url`, other kinds a gradient + glyph). The `grid`/`list`
  toggle and the `MediaTable` list view were **removed**; there is no `MEDIA_VIEW`
  constant and the store holds no `view` state. Select-all went with the table
  (it lived in that table's header) — selection is per-tile plus the selection
  bar's Clear.
- **Find** — a search box (name + tags), a **type filter**, and a **sort** select.
- **Select + bulk-act** — checkboxes + a header select-all feed a
  **`MediaSelectionBar`** (Download / Duplicate / Move / Delete / Clear).
- **Per-asset actions** — the shared **`AssetActionsMenu`** (Download, Copy link,
  Duplicate, Rename, Move, Delete), routed through one dispatcher. It carries
  **no "Open" item**: in the drawer that re-opened the drawer already on screen,
  and on the tile it tripled up with the thumbnail and the filename, which are
  both already buttons dispatching `'open'`. The `'open'` action kind remains —
  only the menu entry is gone.
- **Detail drawer** — **`AssetDetailDrawer`** (preview, actions, metadata, alt, tags).
- **Dialogs** — **`NewFolderDialog`**, **`UploadDialog`**, **`RenameDialog`**,
  **`MoveAssetsDialog`**, and `ConfirmDialog`.
- **Upload — stage, preview, then watch it go.** `UploadDialog` takes multiple
  files (drag-and-drop *and* a `multiple` picker, accumulating across drops) and
  stages them as **`StagedFileRow`**s: images get a real thumbnail from a local
  `URL.createObjectURL` (revoked on unmount — a staged 200 MB video would
  otherwise leak for the tab's life), other kinds a MIME-derived glyph. Confirm
  closes the dialog and hands the `File`s to **`hooks/useUploadQueue`**, which
  uploads at most `UPLOAD_CONCURRENCY` (3) at a time, **one request per file**,
  and drives the **`MediaUploadBanner`** above the browser: a size-weighted
  overall bar plus a `MediaUploadRow` per file (live %, retry on failure, cancel
  in flight via `AbortController`). One file per request is the point — the old
  `Promise.all` lost a whole batch to a single rejection. The queue keeps `File`s
  and its runner bookkeeping in **refs**, not state, so a progress tick
  re-renders only the small `UploadItem` rows. Because the dialog closes on
  submit, **there is no upload success toast** — it would claim a result that
  hasn't happened; the banner is the status surface, and the query cache is
  invalidated once per settled batch.
- Every other action fires a **toast**; failures surface a toast + resync.

## The content editor's Media tab

Beyond the library page, this plugin contributes the **Media tab** of the
content entry editor via content-admin's **`ENTRY_TAB_SLOT`** (hence the
`@ortha-cms/content-admin` dependency; the tab appears only when the open type
has a `media` field — `appliesTo` checks `CONTENT_FIELD_TYPE.Media`). Pieces:

- **`EntryMediaTab`** — the slot `Component`. Reads the schema's media fields and
  renders one **`MediaFieldControl`** each, bound to the editor's shared form via
  the slot's form bridge (`ctx.form.values` / `setValue` / `errorFor` / `touch`),
  with the field's label / required mark / localized globe / Changed badge /
  error. Media values live in the entry values bag; the tab is only their surface.
- **`MediaFieldControl`** — single or ordered-multiple asset display (thumbnails
  resolved from `ctx.mediaRefs` or a just-picked/uploaded asset; a `missing` ref
  renders "Unavailable asset"), with **Select from library**, **Upload**, remove,
  and reorder. It writes an asset id (single) or id array (multiple).
- **`MediaPickerDialog`** — a modal over `useMediaLibrary` (browse + search),
  candidates narrowed to the field's `accept` (the server enforces it on save).
- **Upload** reuses `mediaGateway.uploadFile` (now returning the created asset),
  so the file lands in the **library** too and its id is set on the field; the
  media caches are invalidated so it appears immediately. `acceptsAsset`
  (`utils/mediaAccept`) mirrors the server's restriction for the picker filter +
  a post-upload guard.

## Lives strictly inside a workspace

This plugin contributes **no top-level route and no top-toolbar nav item**. It
adds an `Image` rail button (`order: 20`) and a `media/*` route to the workspace
shell — plus the content editor's **Media tab** (`ENTRY_TAB_SLOT`, above) — so it
only renders under `/workspaces/:id/media` and inside the content entry editor.

## Conventions

Follows the workspaces-admin / content-admin conventions: `type` over `interface`;
JSDoc on exports; **one component per file** with `<name>/index.ts(x)` folders
(pages in `src/lib/pages/`, components in `src/lib/components/`, the data layer in
`src/lib/infrastructure/`); no magic string literals (route segment, enums,
permissions, root-folder id in `src/lib/constants/`); co-located `react-intl`
messages namespaced `media.<area>.<key>`; UI from `@ortha-cms/design-system` only.

## Not yet (follow-ups)

Server-side pagination for large folders; an admin-e2e suite (axe + keyboard +
upload via `setInputFiles`); real thumbnail derivatives; alt/tag editing in the
drawer (read-only today).

## Commands

- `npm exec nx typecheck @ortha-cms/media-admin`
- `npm exec nx lint @ortha-cms/media-admin`

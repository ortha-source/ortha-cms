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

- **Browse** — a left **`MediaFoldersNav`** (folder tree headed by "All media",
  a New-folder action, a storage meter). The main pane shows **`MediaBreadcrumbs`**,
  a title/count, the **`MediaToolbar`**, and the content.
- **Two views** — a `grid`/`list` toggle switches **`MediaGrid`** (tiles; images
  render their real preview via `asset.url`, other kinds a gradient + glyph) and
  **`MediaTable`** (rows with type/size/dimensions/modified columns).
- **Find** — a search box (name + tags), a **type filter**, and a **sort** select.
- **Select + bulk-act** — checkboxes + a header select-all feed a
  **`MediaSelectionBar`** (Download / Duplicate / Move / Delete / Clear).
- **Per-asset actions** — the shared **`AssetActionsMenu`** (Open, Download, Copy
  link, Duplicate, Rename, Move, Delete), routed through one dispatcher.
- **Detail drawer** — **`AssetDetailDrawer`** (preview, actions, metadata, alt, tags).
- **Dialogs** — **`NewFolderDialog`**, **`UploadDialog`** (drag-and-drop + picker,
  emits real `File`s), **`RenameDialog`**, **`MoveAssetsDialog`**, and `ConfirmDialog`.
- Each action fires a **toast**; failures surface a toast + resync.

## Lives strictly inside a workspace

This plugin contributes **no top-level route and no top-toolbar nav item**. It
adds an `Image` rail button (`order: 20`) and a `media/*` route to the workspace
shell — so it only ever renders under `/workspaces/:id/media`.

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

# @ortha-cms/media-admin

The **Media Library feature plugin** for the Ortha CMS admin UI. It mounts
**inside a workspace** at `/workspaces/:id/media` and ships a full **design
mockup** of the asset-management experience: a folders sidebar beside a
searchable/filterable/sortable asset browser (grid **and** list views), an asset
detail drawer, and the create-folder / upload / rename / move / delete flows.

> **This is a UI mockup — there is no media server yet.** All data comes from an
> in-memory, mock-seeded store (`hooks/useMediaLibrary` + `utils/mockMedia`), and
> every action mutates local React state (lost on reload). The store's shape
> mirrors what a real per-hook `apiClient` + TanStack Query data layer would
> expose, so the components can be rewired to `@ortha-cms/media-server` (once it
> exists) without changing the UI. Permission flags in `MediaLibraryPage` are
> placeholders (all enabled) until that server defines the `media:*` matrix and
> real `useHasPermission` gates replace them (the `MEDIA_*` permission constants
> already exist in `constants/`).

## What it does

- **Browse** — a left **`MediaFoldersNav`** (folder tree headed by "All media",
  a New-folder action, a mock storage meter). The main pane shows
  **`MediaBreadcrumbs`**, a title/count, the **`MediaToolbar`**, and the content.
- **Two views** — a `grid`/`list` toggle in the toolbar switches between
  **`MediaGrid`** (folder tiles + gradient-thumbnail asset tiles) and
  **`MediaTable`** (folder rows + asset rows with type/size/dimensions/modified
  columns). The choice lives in the store; assets carry a self-contained
  deterministic **gradient thumbnail** (`utils/assetGradient`) so the mockup
  needs no image files or network.
- **Find** — a search box (name + tags), a **type filter**
  (image/video/audio/document/archive), and a **sort** select (newest/oldest,
  name A–Z/Z–A, largest/smallest), all controlled from the store.
- **Select + bulk-act** — per-tile/row checkboxes and a header select-all feed a
  **`MediaSelectionBar`** (Download / Duplicate / Move / Delete / Clear).
- **Per-asset actions** — the shared **`AssetActionsMenu`** (Open, Download, Copy
  link, Duplicate, Rename, Move, Delete) on every tile, row, and the drawer,
  routed through one `(kind, asset)` dispatcher (`utils/assetHandlers`).
- **Detail drawer** — **`AssetDetailDrawer`** (right `Drawer`) with a large
  preview, primary actions, a metadata list, alt text, and tags.
- **Dialogs** — **`NewFolderDialog`**, **`UploadDialog`** (drag-and-drop zone +
  file picker that stages files before committing), **`RenameDialog`** (assets &
  folders), **`MoveAssetsDialog`** (indented destination picker via
  `utils/folderTree`), and the design-system **`ConfirmDialog`** for deletes.
- Each action fires a **toast**. A visually-hidden `aria-live` region announces
  the selection count.

## Layout

`MediaLibraryPage` owns a two-pane board mirroring the Content Library: a muted
canvas (`h-[calc(100svh-3rem)]`) holding the **`MediaFoldersNav`** (inline from
`lg` up; below it a "Folders" button opens the same nav in a left `Drawer`)
beside the work-area island (a rounded, bordered, scrolling card). It also hosts
the detail drawer and every dialog, and builds the asset-action dispatcher +
toasts.

## Package

- Name: `@ortha-cms/media-admin`
- Import: `import { MediaPlugin } from '@ortha-cms/media-admin'`
- Grouped package (`packages/media/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.
- Register it in `createAdmin({ plugins })` **after** `WorkspacesPlugin()` — it
  contributes only to the workspace shell's slots
  (`WORKSPACE_SIDEBAR_SLOT` + `WORKSPACE_ROUTE_SLOT`), so it depends on
  `@ortha-cms/workspaces-admin`.

## Lives strictly inside a workspace

This plugin contributes **no top-level route and no top-toolbar nav item**. It
adds an `Image` rail button (`order: 20`) and a `media/*` route to the workspace
shell — so it only ever renders under `/workspaces/:id/media`.

## Conventions

Follows the workspaces-admin / content-admin conventions: `type` over
`interface`; JSDoc on exports; **one component per file** with
`<name>/index.ts(x)` folders (pages in `src/lib/pages/`, presentational
components in `src/lib/components/` — a component used by only one other
component nests inside it, e.g. `MediaGrid/MediaAssetCard/`,
`MediaTable/MediaAssetRow/`, `AssetDetailDrawer/MetaRow/`); no magic string
literals (route segment, view/kind/sort enums, permissions, and the root-folder
id are named constants in `src/lib/constants/`); co-located `react-intl` messages
namespaced `media.<area>.<key>`; UI from `@ortha-cms/design-system` only.

## Commands

- `npm exec nx typecheck @ortha-cms/media-admin`
- `npm exec nx lint @ortha-cms/media-admin`

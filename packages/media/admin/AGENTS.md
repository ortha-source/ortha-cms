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
- **Deleting a folder takes its contents with it**, so the confirmation says so:
  `utils/folderContents` counts the subtree from the already-loaded tree
  (`folders` + `folderCounts` — no extra request, as fresh as the last folders
  read) and the prompt reads "Delete “X” and everything inside?" over "…also
  deletes 3 assets and 1 subfolder". An empty folder gets the plain wording
  instead — reciting an inventory of nothing is just noise. The per-folder ⋯
  trigger is named after its folder ("Actions for Images"), so a grid of folders
  isn't a row of identical "Folder actions" buttons.
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
  invalidated once per settled batch. The **dialog** is shared with the content
  editor's media field (below); the queue and banner are the library's own, since
  a field defers its uploads to the record's save.
- Every other action fires a **toast**; failures surface a toast + resync.

## The content editor's Media tab

Beyond the library page, this plugin contributes the **Media tab** of the
content entry editor via content-admin's **`ENTRY_TAB_SLOT`** (hence the
`@ortha-cms/content-admin` dependency; the tab appears only when the open type
has a `media` field — `appliesTo` checks `CONTENT_FIELD_TYPE.Media`). Pieces:

- **`EntryMediaTab`** — the slot `Component`. Reads the schema's media fields and
  renders one **`MediaFieldSection`** each, bound to the editor's shared form via
  the slot's form bridge (`ctx.form.values` / `setValue` / `errorFor` / `touch` /
  `isFieldDirty`). Media values live in the entry values bag; the tab is only
  their surface.
- **`MediaFieldSection`** — one field as a **titled card**, deliberately the same
  shape as the Relations tab's `RelationFieldSection` so the two contributed tabs
  read as one editor: header (heading + required mark, the localized globe in a
  `Tooltip`, the **shared** `ChangedBadge` imported from `@ortha-cms/content-admin`
  — not a look-alike that would drift — and an error alert icon) over a one-line
  description of what the field holds, then the control; an error tints the card
  border. The field is named as a **group** (`aria-labelledby` → its `<h3>`), not
  by a `<label for>` pointing at a button: a media field is a *composite* control
  (pick / upload / remove / reorder), and a label would **replace** the trigger's
  own accessible name — the a11y tree read "Cover image, button" instead of
  "Select from library". As a group it reads "Cover image, group" and then each
  action by its own name, which is also what makes the e2e locators legible.
- **`MediaFieldControl`** — the control itself. Attached assets render as
  **`MediaFieldItem`** tiles in a panel that is also a **drop zone** (highlight
  held by a drag-depth counter, since nested tiles fire `dragleave` as the
  pointer crosses them). Empty, the panel is a dashed `Empty` state that says so
  and invites the drop. Below sit **Select from library** / **Add from library** /
  **Replace**, **Upload**, and a muted meta line (attached count + the `accept`
  hint — the hint was a `Badge` beside the buttons, which read like an action). It
  writes an asset id (single) or id array (multiple).
- **`MediaFieldItem`** — one attached asset: the **thumb derivative** (or the
  deterministic `assetGradient` behind its kind glyph) over the name and whatever
  type / size / dimensions are known (`types/mediaFieldDisplay` is the merge of a server
  `MediaRef` and a locally-picked `MediaAsset` — a ref carries no size), with
  hover/focus-revealed controls: open in a new tab (the **original**), remove,
  and — multiple only — nudge up/down beside a position badge. A `missing` ref is
  an explicit warning tile carrying the dead id, so it can be found and removed.
  An id whose ref hasn't arrived yet renders a **`resolving` placeholder**, not a
  guessed `/raw` URL: guessing meant every edit-mode open fetched full-size
  originals for the window before `useEntryMedia` landed — to draw a 180px tile —
  and printed a uuid where the file name goes. Waiting is keyed on
  `EntryTabContext.mediaRefsPending`, so it ends: once the read **settles**
  without a ref (it failed, or no media server binding is present) the tile falls
  back to the original rather than waiting forever. Both halves are pinned by
  admin-e2e.

**Uploading is gated on `media:create`, picking on `media:read`** — not decoration:
uploads are deferred into the save, so an ungranted upload 403s *inside the write*
and takes the user's unrelated edits down with it. Without `media:create` the
Upload button and the drop zone are gone; without `media:read` the picker trigger
is disabled and the card says why.
- **`MediaPickerDialog`** — a wide modal over `useMediaLibrary`, **permission-
  aware** (the trigger is disabled without `media:read`, and the field says why)
  and with its own **error** state: a failed library read offers a retry instead
  of the empty state, because "nothing here" for a read that never landed sends
  the user hunting for assets that exist. Search, a type
  filter (listing only the kinds the field's `accept` allows, hidden when that
  leaves one), a sort, **breadcrumbs** over the folder chips — descending used to
  be one-way, with no path back up — and a grid of **`MediaPickerTile`**s
  (thumbnail + name + size/dimensions, `aria-pressed`, an "Attached" mark on what
  the field already holds). Skeleton tiles while loading, an `Empty` (with Clear
  filters) when nothing matches. Candidates are narrowed to the field's `accept`
  (the server enforces it on save); closing resets the selection **and** the
  filters, so a stale search can't hide the library on the next open.
- **Upload — the library's dialog, but nothing moves until Save.** Picking a file
  opens the same **`UploadDialog`** the library toolbar opens (stage → preview →
  confirm; dropping files on the field panel opens it *pre-staged*, so a drop is
  reviewed rather than sent blind), narrowed by new optional props: `multiple` /
  `accept` / `description` / `hint` / `confirmLabel` / `initialFiles`. (A single
  field stages exactly one file; `initialFiles` defaults to a module-level
  constant — an inline `[]` would re-seed the staging on every render.)
  Confirming **stages** the files; the bytes go up when the record is saved or
  published. See *Deferred uploads* below.
    `acceptsFile` (`utils/mediaAccept`, over the local `kindFromMime`) checks a
  staged file against the field's `accept` at the moment it's chosen, so a
  rejected file never reaches the value; the server re-checks the real asset on
  save, which is the enforcing pass.

## Deferred uploads — a record and its new assets are one commit

**`hooks/usePendingMediaUploads`** is the plugin's contribution to content-admin's
**`ENTRY_PRESAVE_SLOT`**, and it is what makes "choose a file" and "save the
record" a single write. An upload is a write: uploading the moment a file is
picked fills the Media Library with assets for a record the user then abandons.

- A staged file gets a **placeholder uuid**, and that is what the form value
  holds. A real uuid on purpose — the shared kernel validates a media value as a
  uuid (or uuid[]), so a staged file satisfies client validation, the Changed
  badge, and the publish gate exactly like an attached asset. The `File` itself
  lives in the hook's map (`types/pendingUpload`), keyed by that placeholder.
- The hook is mounted by **`ContentEntryView`**, not by the tab: editor tabs are
  routes, so the Media panel unmounts the moment the user switches tab. Its
  `handle` reaches the panel back down through `EntryTabContext.presave[id]`
  (opaque; a tab reads only its own key, the same contract as
  `EntrySlotContext.params`), and `MediaFieldControl` renders the staged files as
  dashed "Uploads on save" tiles previewing off a local object URL.
- **`commit`** runs inside the save, before the write and under the busy cover:
  it uploads every staged file the values still reference (`UPLOAD_CONCURRENCY`
  at a time, one request each) and returns the values with the placeholders
  swapped for real asset ids. A failed file **aborts the save** with a toast
  naming it — nothing is written, so the form keeps its placeholders. The files
  that *did* upload remember their asset id (`PendingUpload.uploadedId`), so a
  retry attaches them instead of uploading twice.
- **`settle`** runs after the write succeeded: object URLs revoked, staging
  dropped (the re-seeded form now holds the saved record's real ids).
- Uploads land in `ROOT_FOLDER_ID`; the media caches are invalidated as soon as
  anything uploads, even if the write behind it then fails.
- Removing, replacing, or re-picking releases the staged file in one place
  (`setIds`) — the preview blob is revoked and the save stops uploading a file
  nothing references.
- **Picking an existing library asset is not deferred** — it is already uploaded;
  attaching its id is an ordinary form edit that rides Save like any other.

## The library behind a rich-text image block

**`hooks/useWysiwygAssetPicker`** fills content-admin's **`ASSET_PICKER_SLOT`**,
which is how an image block in a `wysiwyg` field gets a URL from the library
rather than only from a pasted link. The editor's port is a **promise** and the
library's picker is a **dialog**, so the hook adapts one to the other: `pick()`
opens `MediaPickerDialog` (narrowed to `MEDIA_KIND.Image`) and parks the resolver
until the author confirms or dismisses. A second `pick()` while one is open
answers the first with a dismissal rather than stranding it.

**It browses; it does not upload** — and that is the same reasoning as the
deferred-upload presave above, from the other end. A media *field* can stage a
file because the record's save is the commit point that turns it into an asset.
An image in a document is a **URL in the stored HTML**: it needs a real,
resolvable address the moment it is inserted, so an upload from inside a draft
would put a file in the library whether or not the record is ever saved —
precisely the orphan the presave exists to prevent. Picking an asset that already
exists has no such problem.

The picked asset's URL is stored as the image's `src`, not as an asset id: a
`wysiwyg` value is HTML any consumer can render with nothing to resolve. The cost
is real and worth naming — deleting that asset leaves a dead image in whatever
documents used it.

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

## Thumbnails — the grid never loads a full-size original

Image assets carry server-generated WebP derivatives — `thumbUrl` (~320px) and
`previewUrl` (~1280px), mapped from the API's `variants` by `mediaMapper`.
`MediaThumbnail` renders the `thumb` in grid + picker tiles and the `preview` in
the detail drawer (`size` prop), falling back to the full `url` when a derivative
is absent (an SVG, or an image too small to derive).

The **field tiles** follow the same rule from the other side of the wire:
`MediaRef` now carries `thumbUrl` / `previewUrl` (resolved by media-server's
`MediaAssetResolverQuery`), so `MediaFieldDisplay.url` is the derivative and
`originalUrl` — the full bytes — is reserved for the tile's open-in-a-new-tab
link. A staged upload puts its local object URL in the same slot, so the tile
renders one way regardless of where the image came from.

## End-to-end cover

The **Media tab** has an admin-e2e suite —
`apps/admin-e2e/src/content/media-fields.spec.ts`, driven by the
`MediaFieldPage` page object: picking from the library, the `accept` narrowing,
walking into a folder and back out via the breadcrumb, staging an upload and
asserting it is sent **only** on save (an upload spy proves the count is 0 until
then), dropping a staged file, appending + reordering a multiple field, a saved
record's assets resolving to names, and an axe scan with the picker open. Its
seeds are `MEDIA_FIELDS_*` in `support/api/content.ts` (their schema is what
makes the tab appear) plus the existing `mockMediaApi`.

Two harness details worth keeping: mock asset ids are **uuids**
(`MEDIA_ASSET_IDS` / `uploadedAssetId`), because the shared kernel shape-checks a
media value and a friendlier `a_hero` is refused client-side before any save;
and `mockEntryMedia` must be registered **after** `mockContentEntryWrites`,
whose multi-segment route would otherwise answer `/:id/media` with an entry
record.

The **Media Library page** still has only `media-library.spec.ts`.

## Not yet (follow-ups)

Server-side pagination for large folders; a keyboard suite for the field and the
library; alt/tag editing in the drawer (read-only today).

## Commands

- `npm exec nx typecheck @ortha-cms/media-admin`
- `npm exec nx lint @ortha-cms/media-admin`

# @ortha-cms/content-admin

The **Content Library feature plugin** for the Ortha CMS admin UI. It is the
admin counterpart to `@ortha-cms/content-server` (which owns the content
registry, schema, and `CONTENT_CATALOG`). It mounts **inside a workspace** at
`/workspaces/:id/content/*` and ships the library's **landing + navigation
shell**: a second sidebar listing the workspace's content types, a ⌘K search
palette, and pin-to-favorite. Selecting a **collection** opens a dynamic records
table (search, query-builder filter, **click-to-sort headers**, a column picker with
**drag-and-drop / keyboard reordering**, **row selection** with a select-all and
a "{n} selected" bar, pagination, and an **Add record** action); selecting a
**single** (page) still shows the
"entries coming soon" placeholder until its single-entry editor lands. The entry
**list is mock-backed** for now (`useContentEntries`) — the table, filters, and
schema-driven columns are real, only the rows are fabricated until the server's
`GET /api/content/:typeName` lands. Creating/opening an entry routes to a
placeholder stub.

## Layout (the second sidebar)

`ContentLibraryPage` owns a two-pane layout inside the shell's content area
(beside the 56px workspace rail): a sticky **`ContentSidebar`** on the left and
an outlet driven by nested routes on the right (`index` → `ContentWelcome`,
`:typeName` → `ContentTypeView`, `:typeName/new` + `:typeName/:entryId` →
create/edit placeholder stubs; the static `new` segment outranks the
`:entryId` param). `ContentTypeView` branches on `kind`: a collection renders
`CollectionRecordsView` (the records table), a single keeps the placeholder. The
sidebar splits types via
`groupContentTypes` into **collapsible** groups — **Favorites** (shown only when
something is pinned), **Collections** (`kind: 'collection'`), **Pages**
(`kind: 'single'`) — built on the design-system `Collapsible`. Each row links to
its type and carries a pin toggle. The **`ContentSearchDialog`** is a
`CommandDialog` (cmdk) palette opened from the sidebar's search trigger or the
global ⌘K / Ctrl+K shortcut (owned by the page).

## Data + favorites

- `useContentTypes` (`src/lib/api/useContentTypes/`) reads the registry's source
  of truth, **`GET /api/content-schema`** — **not** the workspace wizard's
  `/api/content-types` mock. Gated on `content:read` (the rail item carries the
  same `permission`).
- **Scoped to the workspace.** The schema list is global, so the page filters it
  to the open workspace's granted content slugs — `Workspace.content` from
  `@ortha-cms/workspaces-admin` (surfaced by `GET /api/workspaces`, sourced from
  the `workspace_content` grants written by the create wizard). Only related
  collections/pages show; an ungranted `:typeName` renders the not-found state.
- `useContentFavorites` (`src/lib/hooks/useContentFavorites/`) persists pinned
  type-names in `localStorage`, **keyed per workspace** (`ortha:content:
favorites:<workspaceId>`), with guarded reads/writes. There is no favorites
  server yet — that is the planned migration point.
- **Records table data layer** (per-collection): `useContentSchema`
  (`GET /api/content-schema/:name`, the full field schema) feeds both the columns
  and the query-builder filter fields (`filterFieldsFromSchema`). `useContentEntries`
  is the **single mock boundary** — it fabricates rows via `utils/mockEntries`
  and applies search → query-builder filter (`utils/applyFilterTree`, evaluating
  the same wire JSON the server's `parseFilterTree` consumes) → **type-aware sort**
  → pagination, returning the `{ items, total, page, pageSize }` envelope. Swap
  its body for an `apiClient` call when the entry API lands; callers stay
  unchanged. Sort is a URL param (`?sort=<columnId>` asc, `?sort=-<columnId>`
  desc); a header click cycles asc → desc → off, sets `aria-sort` on the
  `<th>`, and resets the page. URL state (search/filter/sort/page) is owned by
  `useTableUrlState` (`@ortha-cms/utils-admin`),
  mirroring the Members page. `useEntryColumns` holds the **ordered** visible
  columns in component state (**not persisted** — the choice lasts the session
  and resets on reload) — the array is both the visibility set and the display
  order, so it powers the column picker's toggles *and* its drag-to-reorder
  (`reorder` via `@dnd-kit/sortable`'s `arrayMove`); it is seeded from a smart
  default (`utils/entryColumns`, excluding richtext/json) narrowed to the live
  schema, and re-seeded when the open type changes. Row selection is local
  component state (a `Set<string>` by id)
  in `CollectionRecordsView`, surfaced through the table's leading checkbox column
  and the `CollectionRecordsSelectionBar`.
- Column **order and visibility** are both chosen in
  `CollectionRecordsColumnPicker` — a `Popover` (not a `DropdownMenu`, whose menu
  semantics fight dnd-kit's keyboard sensor) listing visible columns first as
  drag-and-drop / keyboard reorderable rows (a `DndContext` + vertical
  `SortableContext`, `GripVertical` handle per row, `KeyboardSensor` +
  `sortableKeyboardCoordinates`), then hidden columns as toggle-only rows. The
  table header itself is static. The records view spans full width (`Container`
  overridden to `max-w-none`) with a uniform 16px gutter (`p-4 sm:p-4`, overriding
  the Container's responsive padding); the table sits in a full-width bordered
  card with no padding of its own.
- The design-system `command` + `collapsible` primitives this plugin relies on
  were added there via the shadcn skill (consumed from `@ortha-cms/design-system`).

## Package

- Name: `@ortha-cms/content-admin`
- Import: `import { ContentPlugin } from '@ortha-cms/content-admin'`
- Grouped package (`packages/content/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.
- Register it in `createAdmin({ plugins })` **after** `WorkspacesPlugin()` — it
  contributes only to the workspace shell's slots
  (`WORKSPACE_SIDEBAR_SLOT` + `WORKSPACE_ROUTE_SLOT`), which `WorkspacesPlugin`
  owns, so it depends on `@ortha-cms/workspaces-admin`.

## Lives strictly inside a workspace

This plugin contributes **no top-level route and no top-toolbar nav item**. It
adds a `Library` rail button (`order: 10`, first) and a `content/*` route to the
workspace shell — so it only ever renders under `/workspaces/:id/content`. The
page reads the open workspace via `useCurrentWorkspace()` from
`@ortha-cms/workspaces-admin`.

## Conventions

Follows the workspaces-admin conventions: `type` over `interface`; JSDoc on
exports; `<name>/index.ts(x)` folders (pages in `src/lib/pages/<Name>/`, the
factory in `src/lib/utils/contentPlugin/`); co-located `react-intl` messages
namespaced `content.<area>.<key>`; UI from `@ortha-cms/design-system` only.

- **A component used by only one other component nests inside that parent's
  folder** (it is not a render method on the parent and not a top-level
  component). So the search palette's result row lives at
  `components/ContentSearchDialog/ContentSearchItem/`, not as a `renderItem`
  closure inside the dialog.
- **No magic string literals for route segments, route params, keyboard keys, or
  permissions** — define them as named constants in `src/lib/constants/` and
  import them wherever they're used. `CONTENT_SEGMENT` is the single source of
  truth for the `content` mount path, shared by `contentPlugin` (slot `to` +
  route `path`) and `ContentLibraryPage` (`basePath`); `HISTORY_SEGMENT` /
  `TRASH_SEGMENT` / `TYPE_PARAM` drive the nested routes and the sidebar links;
  `SEARCH_SHORTCUT_KEY` is the ⌘K key; `CONTENT_READ` is the permission gate.

## Commands

- `npm exec nx typecheck @ortha-cms/content-admin`
- `npm exec nx lint @ortha-cms/content-admin`

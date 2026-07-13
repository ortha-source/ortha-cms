# @ortha-cms/content-admin

The **Content Library feature plugin** for the Ortha CMS admin UI. It is the
admin counterpart to `@ortha-cms/content-server` (which owns the content
registry, schema, and `CONTENT_CATALOG`). It mounts **inside a workspace** at
`/workspaces/:id/content/*` and ships the library's **navigation + landing**:
the **Content section of the app sidebar** (listing the workspace's content
types, with a ⌘K search palette and pin-to-favorite) plus the work-area island.
Selecting a **collection** opens a dynamic records
table (search, query-builder filter, **click-to-sort headers**, a column picker with
**drag-and-drop / keyboard reordering**, **row selection** with a select-all and
a "{n} selected" bar, pagination, and an **Add record** action); selecting a
**single** (page) opens its **entry editor** directly (its one row, or a blank
create form). The entry
list is **served by the API** (`useContentEntries` → `GET /api/content/:typeName`):
search, query-builder filter, sort, and pagination all run server-side. Creating
(`/new`) or opening (`/:entryId`) an entry renders the **`EntryEditor`** — a
tabbed, schema-driven form (see below). Writes are **live**: create/update
(`useSaveEntry`), publish/unpublish + soft-delete/restore/purge
(`useEntryStatusActions`), and their batch forms (`useBulkEntryActions`), all
against the content-server write API; a server 422 maps back onto the form's
fields. Each paranoid collection also has a **Trash** view
(`:typeName/trash`).

## Layout (the Content sidebar section)

The content-type nav lives in the **app sidebar**, not the page: `ContentPlugin`
contributes a **`ContentNavSection`** to the workspace shell's
`WORKSPACE_SECTION_SLOT`, rendering the **`ContentSidebar`** (nav landmark
"Content types") + the ⌘K palette there. Because that section renders **above**
the shell's `CurrentWorkspaceProvider`, `ContentNavSection` resolves the open
workspace itself (`useMatch('/workspaces/:id/*')` + `useWorkspaces`) rather than
`useCurrentWorkspace`, and owns the ⌘K/Ctrl+K shortcut so search works anywhere
in the workspace. `ContentLibraryPage` then owns only the **work-area island**
(`ContentPane`) — an outlet driven by nested routes.
The routes are (`index` → `ContentWelcome`,
`:typeName` → `ContentTypeView`, `:typeName/new` + `:typeName/:entryId` →
`ContentEntryRoute` (the create / edit editor); the static `new` segment
outranks the `:entryId` param). `ContentTypeView` branches on `kind`: a
collection renders `CollectionRecordsView` (the records table), a single renders
`ContentEntryView` in `single` mode (its one-entry editor). The
sidebar splits types via
`groupContentTypes` into **collapsible** groups — **Favorites** (shown only when
something is pinned), **Collections** (`kind: 'collection'`), **Pages**
(`kind: 'single'`) — built on the design-system `Collapsible`. Each row links to
its type and carries a pin toggle. The **`ContentSearchDialog`** is a
`CommandDialog` (cmdk) palette opened from the sidebar's search trigger or the
global ⌘K / Ctrl+K shortcut (both owned by `ContentNavSection`).

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
  fetches `GET /api/content/:name` with `{ search, filter, sort, page, pageSize }`
  → the `{ items, total, page, pageSize }` envelope; the **server** runs search →
  query-builder filter → sort → pagination (this hook owns no row logic). The
  schema gates the query (disabled until it resolves) and supplies the type name.
  **`status` is publishable-only**: `entryColumns` offers a Status column and
  `filterFieldsFromSchema` prepends a Status filter **only when `schema.publishable`**
  (a non-publishable type has no publish state). Sort is a URL param
  (`?sort=<columnId>` asc, `?sort=-<columnId>`
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
  overridden to `max-w-none`) with a uniform 24px gutter (`p-6 sm:p-6`, overriding
  the Container's responsive padding); the table sits in a full-width bordered
  card with no padding of its own.
- **Entry editor** (`/new`, `/:entryId`, and a single page): `ContentEntryView`
  resolves the initial values per mode — `create` → blank; `edit` → the record
  from `GET /content/:type/:id` (`useContentEntry`), seeded instantly from the
  records-list cache when opened from the table; `single` → the type's one row via
  the list endpoint, else blank — then renders **`EntryEditor`**. The editor owns the
  form state (`useEntryForm`, with client validation in `utils/validateEntryValues`
  mirroring the server's rules) and lays out a title header, a **full-width**
  tabbed body (**General** = `EntryFieldSections`, which groups fields into titled
  `Card`s by control shape — short scalars in a grid, long-form/JSON stacked,
  toggles/multi-choice; **Relations** = relation fields via the **`RelationField`**
  picker (empty state otherwise); **Media** + **History** = placeholders; all four
  tabs always present), and the
  right rail (`EntrySidebar`): a top **action bar** — a primary button
  (**Publish** for a publishable type the user may publish, else **Save** /
  **Save draft**) beside a compact **⋯ menu** (Save draft, Save & publish,
  Unpublish, Delete; each permission-gated) — over stacked **card blocks**: a
  live **Publish Gate** (`PublishGateItem[]`, computed by `EntryEditor` from the
  strict `validateEntryValues` — each required/invalid field with its pass/fail,
  header `blocking`/`ready`; publishable types only) and a static **Details**
  block (status, created/updated, id). `EntryFieldInput` (top-level, shared) renders one **flat** (no-shadow)
  control per field type — `date`/`datetime` use a shadcn `Calendar` popover
  (`EntryFieldInput/DateField`, with a time input for datetime), and
  `multiselect` uses the design-system `MultiSelect` (Popover + Command + Badge)
  rather than native controls. The records pane (`ContentPane`) is `overflow-auto` so
  wide content scrolls inside the work-area island, not the page.
- **Relation picker** (`EntryEditor/RelationField/`): the Relations tab is a stack
  of **`RelationFieldSection`** **rounded-border collapsible cards** — each relation
  field a section (chevron + label + linked-count; starts collapsed when a type has
  >3 relation fields, but **force-opens with a header alert icon when it holds a
  validation/server error**, so a save failure is never hidden inside a collapsed
  section) wrapping **`RelationField`**. **Only relations whose target
  collection is granted to the open workspace are shown** — `EntryEditor` filters by
  `availableTypeNames` (passed `workspace.content` from `ContentEntryView`) and passes
  the hidden ones to `useEntryForm` as `ignoreFields`, so a hidden (ungranted)
  relation is excluded from client validation **and** the publish gate — a required
  one can't become an un-satisfiable, invisible block. A **visible** required
link-managed relation (many / inverse-of-many) *is* publish-gated, but by its
**effective link count** (`relationRefs[field].total − staged.removed +
staged.added`), not the values bag it doesn't live in — mirroring the server's
`assertRequiredRelations`. To seed those counts the aggregate relations read
(`useEntryRelations`) now fires on **entry open** (not only when the Relations
tab is first shown), so a populated relation never briefly reads as 0.
`RelationField`
  shows assigned records by **title** (not raw uuid; no avatar) with a remove control
  and an **open-in-new-tab** link to that record's own editor
  (`RelationItemRow`, href built by `utils/contentEntryPath`); a many-relation's
  rows are **drag/keyboard reorderable**
  (dnd-kit, like the records column picker — the array order is the value, via
  `SortableRelationItem`). An Assign/Add button opens **`RelationPickerDialog`**: a
  search box and an **inline, collapsible** query-builder filter (the headless
  **`QueryBuilder`**, *not* a drawer — a nested modal over the dialog is an a11y
  hazard) over the *target type's* real schema (`useContentSchema(target)` →
  `filterFieldsFromSchema`), and a lazily-scrolled candidate list (accessible
  checkbox group for a many-relation, radio group for a single). Fully controlled —
  the form owns the value (single → one id string, many → string[]). Candidates
  are **served by the API** (`api/useRelationCandidates` → `GET /content/:target`,
  the same list endpoint the records table uses): the picker's search **and** the
  query-builder filter (serialized via `treeToJsonFilter`) run **server-side**,
  and the lazy-scroll window is a `pageSize` grown by the dialog. Titles are
  derived from each row's values by `utils/relationLabel` (mirrors the server's
  `entryTitle`). `RelationPickerDialog` owns state/data and composes nested pieces:
  **`RelationPickerFilters`** (search + inline query builder) and
  **`RelationCandidateList`** → **`RelationCandidateRow`** (each candidate row
  also carries the same **open-in-new-tab** link to that record's editor).
- **Assigned relations — single vs many/inverse.** The links read is **lazy**:
  `EntryEditor` calls `useEntryRelations` (`GET /content/:type/:id/relations` →
  `{ relations: { <field>: { items, total } } }`, each field's **first page** +
  total) **gated on the Relations tab being open** — it never fires on entry
  load, and single-relation *values* come from the entry read's `values` (their
  FK id), so a save preserves them even if the tab was never opened. A relation
  is edited one of two ways, chosen by `RelationFieldSection`:
    - **Single** relations (and **any** relation while creating a not-yet-saved
      entry) are **form-backed**: `seedRelationValues` seeds the value (single →
      its FK id; a new entry's many → an empty staged array), and `RelationField`
      renders/edits it, submitted in the entry `values` on save (create's
      whole-set → the server `writeLinks`). Titles come from the loaded
      `RelationRef`s (`initialRefs`) or the picked candidate.
    - **Many / inverse** relations are edited by `RelationFieldLive` (create and
      edit alike): the assigned list is the server set — **infinite-scroll
      paginated** (`useRelationFieldLinks` → `GET …/relations/:field`) on an
      existing entry, empty while creating — with the user's **local staging**
      (`StagedRelation` = added refs / removed ids / order) overlaid. Assign /
      unassign / reorder mutate **only** that staging (owned by `EntryEditor`, so
      it survives collapsing a section or switching tabs); **nothing is sent until
      Save**, which serializes each field's staging to a `{ link?, unlink?, order? }`
      delta and posts it in the entry body — one transaction, one request, a huge
      relation never sent whole. `seedRelationValues` **drops** these fields from
      the form (a save can't wipe links it never loaded); a successful save clears
      the staging and `useSaveEntry` invalidates the field queries. Owning
      many-relations reorder (persisted via `position`); the inverse reads order
      but isn't sortable.
  A field with pending edits shows a **"Changed" badge** (`ChangedBadge`): general
  fields (dirty vs the seed) in `EntryFieldSections`, and relation sections
  (dirty staging, or a dirty single value) in the section header — so the user
  sees exactly what a Save will persist.
- **Writes + permissions.** The sidebar's Save / Save&publish / Unpublish / Delete
  actions, the table row menu (Edit/Publish/Unpublish/Delete; Restore/Delete-
  permanently in trash), and the selection-bar bulk actions are all gated by
  `useHasPermission` (`content:create`/`update`/`publish`/`delete`). "Save &
  publish" chains create/update then the dedicated publish endpoint (one validated
  path). Bulk publish opens **`BulkPublishDialog`** — a dry run
  (`bulk/publish/preview`) listing each row's verdict before publishing only the
  valid drafts. Destructive actions confirm through the design-system
  **`ConfirmDialog`** (shared, i18n-free — pass localized labels). Mutations invalidate the type's records list
  (`contentEntriesPrefix`); the 422 `issues` ride on `ApiError.details` and are
  extracted by `utils/entryIssues`.
- The design-system `command` + `collapsible` + `tabs` + `calendar` +
  `multi-select` primitives this plugin relies on were added there via the
  shadcn skill (consumed from `@ortha-cms/design-system`).

## Package

- Name: `@ortha-cms/content-admin`
- Import: `import { ContentPlugin } from '@ortha-cms/content-admin'`
- Grouped package (`packages/content/admin`), admin-only. Consumed from source
  (`exports` → `./src/index.ts`); no build step.
- Register it in `createAdmin({ plugins })` **after** `WorkspacesPlugin()` — it
  contributes only to the workspace shell's slots
  (`WORKSPACE_SECTION_SLOT` + `WORKSPACE_ROUTE_SLOT`), which `WorkspacesPlugin`
  owns, so it depends on `@ortha-cms/workspaces-admin`.

## Lives strictly inside a workspace

This plugin contributes **no top-level route and no global nav item**. It adds
the **Content section** (`WORKSPACE_SECTION_SLOT`, its `ContentNavSection`) and a
`content/*` route (`WORKSPACE_ROUTE_SLOT`, the lowest `order` so it is the
workspace's default landing) to the workspace shell — so it only ever renders
under `/workspaces/:id/content`. The page reads the open workspace via
`useCurrentWorkspace()` from
`@ortha-cms/workspaces-admin`.

## Conventions

Follows the workspaces-admin conventions: `type` over `interface`; JSDoc on
exports; `<name>/index.ts(x)` folders (pages in `src/lib/pages/<Name>/`, the
factory in `src/lib/utils/contentPlugin/`); co-located `react-intl` messages
namespaced `content.<area>.<key>`; UI from `@ortha-cms/design-system` only.

- **One component per file.** Never define a second React component in the same
  file — not as a `renderItem` closure, not as a sibling `function Foo()` above
  the export. Extract it. A component used by only one other component **nests
  inside that parent's folder** (its own `<Name>/index.tsx`, with co-located
  `messages`); a shared one goes under `components/`. Examples: the search
  palette's result row lives at
  `components/ContentSearchDialog/ContentSearchItem/`, and the bulk-publish
  dialog's row at `components/CollectionRecordsView/BulkPublishDialog/VerdictRow/`
  — not as functions inside their parent file.
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

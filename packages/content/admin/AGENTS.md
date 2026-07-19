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

## Layout — layered (ADR-0003)

This plugin is **layered (tactical DDD)**, mirroring the `workspaces/admin` and
`users/admin` pilots. `src/lib` is organized into four layers, not the legacy
per-hook `api/` + `utils/` layout:

- **`domain/`** — pure TS, no React, no transport: the shared view types
  (`types/contentType`), the `constants` (field types, statuses, route segments,
  permissions), and the pure helpers that are UX invariants (`entryColumns`,
  `emptyEntryValues`, `groupContentTypes`, `relationLabel`, `relationHandle`,
  `relationIds`, `stagedRelation`, `contentEntryPath`, `adminProps`).
- **`application/`** — the TanStack Query hooks (reads + mutations), each calling
  the **gateway**, never `apiClient`. The multi-step flows are **use-case hooks**:
  `usePublishEntryFlow` (save → the kernel `canPublish` gate → publish/unpublish →
  invalidate, owning the create→update id continuity) and `useBulkPublishFlow`
  (dry-run preview → commit, surfacing the server's partial-success shape), so the
  entry view and the bulk dialog render the flow's result instead of sequencing
  mutations themselves.
- **`infrastructure/`** — the `ContentGateway` **port** + its `httpContentGateway`
  implementation (the one place `apiClient` is used, consolidating every request
  fn), `contentMapper` (the thin wire→view anti-corruption layer), `contentKeys`
  (every query key), `entryIssues` (the 422 `issues` extractor), and
  `entryFieldSpec` (the one adapter mapping a wire `ContentField` to the kernel's
  serialized field spec).
- **`presentation/`** — pages, components, the `contentPlugin` factory, the
  `slots`, the presentation `hooks` (`useEntryForm`, `useEntryColumns`, …), and
  `entryValidation`; consumes view models + hooks + the kernel only, never
  `apiClient` or wire types.

### Single validation source — the shared kernel

Field-value validation and the publish gate are **not** hand-mirrored in the
admin anymore. They live once, in `@ortha-cms/content-domain` (the shared
**kernel**, per ADR-0003), which `@ortha-cms/content-server` validates against
too — so the admin and server can't drift. `presentation/entryValidation` is a
thin **i18n anti-corruption layer**: it runs the kernel's `validateFieldValue`
over each field (via the `entryFieldSpec` adapter) and renders the kernel's
stable issue reason as localized copy; parameters (`min`/`max`) are read from the
field's own rules, never parsed out of the kernel string. `usePublishEntryFlow`
applies the kernel's `canPublish` as its publish gate. The deleted
`utils/validateEntryValues` (the old hand-mirror) is gone.

## Layout (the Content sidebar section)

The content-type nav lives in the **app sidebar**, not the page: `ContentPlugin`
contributes a **`ContentNavSection`** to the workspace shell's
`WORKSPACE_SECTION_SLOT`, rendering the **`ContentSidebar`** (nav landmark
"Content types") + the ⌘K palette there. Because that section renders **above**
the shell's `CurrentWorkspaceProvider`, `ContentNavSection` resolves the open
workspace itself (`useMatch('/workspaces/:id/*')` + `useWorkspaces`) rather than
`useCurrentWorkspace`, and owns the ⌘K/Ctrl+K shortcut so search works anywhere
in the workspace. `ContentLibraryPage` then owns only the **work-area island**
(`ContentPane`) — a sticky **`ContentTopBar`** (a colored icon tile + a
route-derived breadcrumb: Content › the type's label › the open record's title /
"New record" / "Trash"; the record title comes from `EntryTitleCrumb`, which
subscribes to the editor's own schema/entry queries at no extra request) over an
outlet driven by nested routes.
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

- `useContentTypes` (`application/useContentTypes/`) reads the registry's source
  of truth, **`GET /api/content-schema`** — **not** the workspace wizard's
  `/api/content-types` mock. Gated on `content:read` (the rail item carries the
  same `permission`).
- **Scoped to the workspace.** The schema list is global, so the page filters it
  to the open workspace's granted content slugs — `Workspace.content` from
  `@ortha-cms/workspaces-admin` (surfaced by `GET /api/workspaces`, sourced from
  the `workspace_content` grants written by the create wizard). Only related
  collections/pages show; an ungranted `:typeName` renders the not-found state.
- `useContentFavorites` (`presentation/hooks/useContentFavorites/`) persists pinned
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
  default (`domain/entryColumns`, excluding richtext/json) narrowed to the live
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
  form state (`useEntryForm`, with client validation in `presentation/entryValidation`
  (the kernel-backed i18n ACL, not a hand-mirror of the server rules)) and lays out a title header, a **full-width**
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
  strict kernel-backed validation — each required/invalid field with its pass/fail,
  header `blocking`/`ready`; publishable types only) and a static **Details**
  block (status, created/updated, id). `EntryFieldInput` (top-level, shared) renders one **flat** (no-shadow)
  control per field type — `date`/`datetime` use a shadcn `Calendar` popover
  (`EntryFieldInput/DateField`, with a time input for datetime), and
  `multiselect` uses the design-system `MultiSelect` (Popover + Command + Badge)
  rather than native controls. The records pane (`ContentPane`) is `overflow-auto` so
  wide content scrolls inside the work-area island, not the page.
- **Relation picker** (`EntryEditor/RelationField/`): the Relations tab opens with
  a one-line subtitle ("Assign related records and set the order they appear in the
  delivery API.") over a stack of **`RelationFieldSection`** **titled cards** — each
  relation field a card (label + a derived description + — for a many relation — a
  right-aligned "{n} linked" count + a "Changed" badge, and a **header alert icon +
  destructive border when it holds a validation/server error**). Cards are **always
  expanded** (no chevron/collapse — the error is never hidden). The description is
  derived from the relation shape: single → "Single relation — one record from
  {Target}."; many → "Ordered relation — drag to reorder, or use the arrows. Order
  is delivered as-is."; inverse → "Linked from {Target}." Each card wraps
  **`RelationField`** (single) or **`RelationFieldLive`** (many/inverse). **Only
  relations whose target collection is granted to the open workspace are shown** —
  `EntryEditor` filters by
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
Each assigned record renders as a **`RelationItemRow`** — a generalized row with a
  **leading slot** (an initials `Avatar` for a single relation, a zero-padded
  `01`/`02` **index** for an ordered many-relation, via `RelationIndex`), the
  **title** + a muted `/handle` (the target's `slug`, else a slugified title — see
  `domain/relationHandle`), an optional **status badge**, and a trailing controls
  cluster: reorder **up/down arrows** (ordered relations), the drag `handle`, an
  **open-in-new-tab** link (`domain/contentEntryPath`), a **Replace** action (single
  relations, re-opens the picker), and remove. `RelationField` (single) stores one
  id string in the form values; `RelationFieldLive` (many/inverse) stages links as
  a delta. A many-relation's rows are **drag/keyboard reorderable** (dnd-kit, like
  the records column picker — the array order is the value, via
  `SortableRelationItem`) **and** nudgeable one place with the up/down arrows (same
  staged `order` path as a drag; ↑ disabled on the first row, ↓ on the last). The
  row's accessible names — `Remove {title}`, `Reorder {title}`, `Open {title} in a
  new tab`, `Move {title} up` / `down`, `Replace` — are what the e2e drives.
  An Assign/Add button opens **`RelationPickerDialog`**: a
  search box and an **inline, collapsible** query-builder filter (the headless
  **`QueryBuilder`**, *not* a drawer — a nested modal over the dialog is an a11y
  hazard) over the *target type's* real schema (`useContentSchema(target)` →
  `filterFieldsFromSchema`), and a lazily-scrolled candidate list (accessible
  checkbox group for a many-relation, radio group for a single). Fully controlled —
  the form owns the value (single → one id string, many → string[]). Candidates
  are **served by the API** (`application/useRelationCandidates` → `GET /content/:target`,
  the same list endpoint the records table uses): the picker's search **and** the
  query-builder filter (serialized via `treeToJsonFilter`) run **server-side**,
  and the lazy-scroll window is a `pageSize` grown by the dialog. Titles are
  derived from each row's values by `domain/relationLabel` (mirrors the server's
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
  extracted by `infrastructure/entryIssues`.
- The design-system `command` + `collapsible` + `tabs` + `calendar` +
  `multi-select` primitives this plugin relies on were added there via the
  shadcn skill (consumed from `@ortha-cms/design-system`).

## Extension slots

The library exposes six named slots (`presentation/slots/contentSlots`, via
`createSlot`) another admin plugin contributes into — no coupling beyond the
contracts, the same idiom as the workspace shell's slots.
`@ortha-cms/i18n-admin` fills all six. **Slot items are boot-frozen**
(`createAdmin` registers them once, before the first render), which is what
makes the two **hook-style** items (`RECORDS_COLUMN_SLOT.useRowsData`,
`RECORDS_FILTER_FIELDS_SLOT.useFields`) rules-of-hooks-safe when the render
sites call them in a loop — the call order never changes; an item gates its own
fetching internally.

- **`RECORDS_TOOLBAR_SLOT`** — a control in the records toolbar; owns URL
  `listParamKeys` forwarded to the list request (and its query key), with
  `updateParams` (resets the page).
- **`RECORDS_COLUMN_SLOT`** — an extension table column (`COLUMN_KIND.Extension`)
  that joins the column picker like any column (non-sortable header); optional
  `useRowsData` batches per-page data once for all its cells.
- **`ENTRY_SIDEBAR_WIDGET_SLOT`** — a card in the entry editor's right rail,
  rendered with an `EntrySlotContext` (schema, entry?, isCreate, mode,
  workspaceId, typePath, **params**) assembled by `ContentEntryView` and shared
  via `EntrySlotContextProvider`. `params` is the current URL values of the
  `ENTRY_PARAMS_SLOT` keys (list + create-body), opaque — a slot reads only its
  own keys (e.g. i18n scopes the relation picker by its `locale` even on a create
  form, where there's no saved `entry`).
- **`ENTRY_HEADER_SLOT`** — an inline element in the entry editor's title row,
  rendered **after** the `<h1>` (the heading stays the sole `<h1>`) with the
  same `EntrySlotContext`. Used for the i18n plugin's current-locale chip.
- **`RECORDS_FILTER_FIELDS_SLOT`** — extra query-builder filter fields, appended
  after `filterFieldsFromSchema`.
- **`ENTRY_PARAMS_SLOT`** — non-visual plumbing: params scoping the single-mode
  one-entry read (`listParamKeys`), URL values copied into the create body
  (`createBodyKeys`; each must exist on the server `SaveEntryDto`), and extra
  relation-candidate list params (`relationCandidateParams`, consumed by the
  picker dialog through the slot context).

The data hooks accept slot-contributed passthrough: `useContentEntries` (`extra`
list params), `useSaveEntry` (`extra` create-body params), `useRelationCandidates`
(`extra`). Wire types carry `i18n` (summary/detail), `localized` (field), and
`locale`/`localeGroupId` (`EntryRecord`).

Two generic hooks surface the `localized` schema flag (same way the editor
already surfaces `required`), so a locale plugin needs no field-level slot:
- `EntryFieldInput` renders a small **localizable indicator**
  (`LocalizedFieldMark` — a `Globe` icon + native `title` + sr-only name) when
  `field.localized`. It shares a single right-aligned **end-adornment** with the
  "Changed" badge (the `changed` prop) at the far right of the label row (a
  `w-full` `FieldLabel`, or `InputField`'s `labelAction` slot) — so the badge and
  the globe sit **side by side** instead of overlapping. The `changed` flag comes
  from `EntryFieldSections` (`isChanged`); the badge is no longer an absolute
  overlay. Self-scopes (only i18n types ever mark a field localized).
- `ContentEntryView` create mode reads `location.state.translateFrom` (a source
  record's values) and seeds the blank form with **only the non-localized**
  fields — the "create a translation" prefill; localized fields start empty.
- **A save keeps the user on the editor** — success is surfaced via a `toast`,
  not a bounce back to the records list. A brand-new record (any create, incl. a
  translation sibling) navigates to its own editor `${typePath}/${saved.id}` so
  the id is in the URL and a further save updates it; an existing record stays in
  place (its `useSaveEntry`-invalidated query refreshes the Details/status); a
  single stays put (`?locale=` re-resolves). The "Back to records" link is the
  way back.

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
exports; `<name>/index.ts(x)` folders (pages in `presentation/pages/<Name>/`, the
factory in `presentation/contentPlugin/`); co-located `react-intl` messages
namespaced `content.<area>.<key>`; UI from `@ortha-cms/design-system` only.

- **One component per file.** Never define a second React component in the same
  file — not as a `renderItem` closure, not as a sibling `function Foo()` above
  the export. Extract it. A component used by only one other component **nests
  inside that parent's folder** (its own `<Name>/index.tsx`, with co-located
  `messages`); a shared one goes under `presentation/components/`. Examples: the search
  palette's result row lives at
  `presentation/components/ContentSearchDialog/ContentSearchItem/`, and the bulk-publish
  dialog's row at `presentation/components/CollectionRecordsView/BulkPublishDialog/VerdictRow/`
  — not as functions inside their parent file.
- **No magic string literals for route segments, route params, keyboard keys, or
  permissions** — define them as named constants in `domain/constants/` and
  import them wherever they're used. `CONTENT_SEGMENT` is the single source of
  truth for the `content` mount path, shared by `contentPlugin` (slot `to` +
  route `path`) and `ContentLibraryPage` (`basePath`); `HISTORY_SEGMENT` /
  `TRASH_SEGMENT` / `TYPE_PARAM` drive the nested routes and the sidebar links;
  `SEARCH_SHORTCUT_KEY` is the ⌘K key; `CONTENT_READ` is the permission gate.

## Commands

- `npm exec nx typecheck @ortha-cms/content-admin`
- `npm exec nx lint @ortha-cms/content-admin`

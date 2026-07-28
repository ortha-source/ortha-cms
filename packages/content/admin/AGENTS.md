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
outranks the `:entryId` param).

**The editor's tabs are routes**, one segment deeper — `:typeName/:entryId/:tab`
(and `:typeName/new/:tab`); for a **single**, whose editor is mounted on the type
itself, each tab slug is spelled out as a **static** segment (`:typeName/general`
…) so it outranks the `:entryId` route, the same trick `new` and `trash` use. The
default tab (`general`) is **omitted**, so the bare entry URL stays the canonical
short link. `domain/entryTab` resolves the open tab from the **last path
segment** — the two editor shapes don't share one route param (a single's static
tab segment yields none), and reading the path covers both. Tabs are routes and
not component state because the editor is remounted by navigations it doesn't
own: switching locale re-targets it at the sibling's id, which used to drop the
user back on General mid-task. `EntrySlotContext.tabSegment` (`'/relations'`, or
`''` on the default) is how a slot that navigates to a sibling record — the i18n
locale switcher — lands the reader on the tab they were working in.

`ContentTypeView` branches on `kind`: a
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
  (`GET /api/content-schema/:name`, the full field schema) feeds the columns.
  The query-builder **filter fields** are **served, not mirrored**:
  `useFilterFields` (`GET /api/content-schema/:name/filter-fields`) fetches the
  recursive filterable surface — the type's own fields **plus its relations'
  fields** (`author.name`, `author.company.name`) — and `contentMapper.toFilterField`
  maps each wire path to a query-builder `FilterField` (dotted `id`, `group`
  breadcrumb, `relationTarget`). This **replaced** the old client-side
  `filterFieldsFromSchema` mirror (deleted): with a relation graph to walk,
  hand-mirroring the server's whitelist would drift into user-visible 400s, so
  the server owns the one traversal that builds both. Because it is **fetched**,
  it has a failure mode a derived list didn't: `useFilterFields` returns
  `{ fields, isPending, isError, refetch }` and the panel renders a **loading**
  and an **error** state (with retry) instead of an empty picker. That is not
  cosmetic — the Apply gate rejects any rule whose field it can't resolve, so
  without the definitions Apply can never commit; an empty picker would be a
  dead button with nothing on screen explaining why. A relation-`id` rule renders
  the **`RelationValuePicker`** (a searchable, lazily-paginated multi-select over
  the target type, reusing `useRelationCandidates`), injected into the query
  builder via `renderRelationValue` at both call sites (the records
  `QueryBuilderPanel` and the relation picker's inline builder) — rendered as an
  element so its hooks stay scoped. **The records filter is an inline accordion,
  not a drawer**: the toolbar "Filters" button toggles a full-width
  `QueryBuilderPanel` that sits between the toolbar and the table and pushes the
  table down (height-animated, no overlay); collapsed with active filters, the
  applied conditions read out as a `QueryBuilderSummary` row of removable chips
  under the toolbar, and Apply collapses back to it. `useContentEntries`
  fetches `GET /api/content/:name` with `{ search, filter, sort, page, pageSize }`
  → the `{ items, total, page, pageSize }` envelope; the **server** runs search →
  query-builder filter → sort → pagination (this hook owns no row logic). The
  schema gates the columns query and supplies the type name.
  **`status` is publishable-only**: `entryColumns` offers a Status column and the
  server's filter surface includes a Status filter **only when publishable**
  (a non-publishable type has no publish state). The same rule holds **wherever
  publish state is drawn** — the editor rail's Details **Status** row, the
  **Revisions** rows' Live/Draft/Superseded badges (and the preview dialog's),
  and the i18n **Locale** rows' badges are all gated on `publishable`. On an
  always-live type those would label a state the type doesn't have; a version
  there was simply saved, so a Revisions row keeps its number, its "Current"
  marker and its time, and nothing else. Sort is a URL param
  (`?sort=<columnId>` asc, `?sort=-<columnId>`
  desc); a header click cycles asc → desc → off, sets `aria-sort` on the
  `<th>`, and resets the page. URL state (search/filter/sort/page) is owned by
  `useTableUrlState` (`@ortha-cms/utils-admin`),
  mirroring the Members page. `useEntryColumns` holds the **ordered** visible
  columns in component state (**not persisted** — the choice lasts the session
  and resets on reload) — the array is both the visibility set and the display
  order, so it powers the column picker's toggles _and_ its drag-to-reorder
  (`reorder` via `@dnd-kit/sortable`'s `arrayMove`); it is seeded from a smart
  default (`domain/entryColumns`, excluding richtext/json) narrowed to the live
  schema, and re-seeded when the open type changes. Row selection is local
  component state (a `Set<string>` by id)
  in `CollectionRecordsView`, surfaced through the table's leading checkbox column
  and the `CollectionRecordsSelectionBar`.
- **Relation columns** render a **`RelationCell`** — a titled trigger (the first
  linked record + a `+N` overflow) opening a `Popover` of the linked records,
  each an `<a target="_blank">` to that record's own editor
  (`domain/contentEntryPath`) with its muted `/handle`. Never the raw FK id — a
  ref the server flags `missing` (its target soft-deleted or out of workspace)
  renders as "Unavailable record" and carries no link, since its `title` is only
  the id standing in.
  Loading is **two-tier**: the list response carries a capped `relations`
  preview (requested via `relations: 'preview'` + `relationFields`, derived from
  the **visible** relation columns, so hiding one stops the server resolving
  it), which renders the collapsed cell and the popover's first view at **no
  extra request**; opening a many/inverse relation then scroll-paginates the
  rest through `useRelationFieldLinks`
  (`GET …/relations/:field`) — the same infinite scroll the editor uses, with the
  same `onScroll` threshold. So a record with thousands of links never loads
  whole. The paginating half lives in the nested **`RelationCellList`**, mounted
  only while the popover is open, so a table of relation cells registers no idle
  queries; a single relation skips the query entirely (its preview is the whole
  story). Two structural rules the table enforces for these cells: they are
  **excluded from the first column's row `<Link>`** (an `<a>` inside an `<a>` is
  invalid) and they `stopPropagation` so a click doesn't fire the row's
  navigation. Relation headers render **non-sortable** — the server's sort
  whitelist excludes relations, so a click would silently fall back to
  `updatedAt`.
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
  toggles/multi-choice — **media fields are excluded from General**, rendering on
  the Media tab instead; **Relations** = relation fields via the **`RelationField`**
  picker (empty state otherwise); **`ENTRY_TAB_SLOT` tabs** — contributed editor
  tabs (the media plugin's **Media** tab) render between Relations and History
  when their `appliesTo` matches the open type; **History** = revisions), and the
  right rail (`EntrySidebar`) — the **Properties panel** (see below): a top
  **action bar** — a primary button
  (**Publish** for a publishable type the user may publish, else **Save** /
  **Save draft**) beside a compact **⋯ menu** (Save draft, Save & publish,
  Unpublish, Delete; each permission-gated) — over a
  live **Publish Gate** (`PublishGateItem[]`, computed by `EntryEditor` from the
  strict kernel-backed validation — each required/invalid field with its pass/fail,
  header `blocking`/`ready`; publishable types only) and a static **Details**
  block (status, created/updated, id). While a save/publish is running, the view
  covers itself with the **`EntryBusyOverlay`** (see _Save/publish flow_ below). `EntryFieldInput` (top-level, shared) renders one **flat** (no-shadow)
  control per field type — a **`wysiwyg`** field renders **`WysiwygFieldControl`**
  (wrapping `WysiwygField` from `@ortha-cms/wysiwyg-admin`): a **preview** of the
  document (its miniature, title and word count) that, when pressed, hands the
  block editor the **whole work area** — every other field goes away while the
  sidebar, top bar and the record's tabs stay (see _The work-area region_ below).
  It is a controlled HTML-in/HTML-out control that rides Save, the Changed badge,
  the publish gate and the 422→field mapping exactly like an `<input>`, and edits
  commit live to the same form state — collapsing is not a save; its **records cell** and its **revision
  diff** render `htmlExcerpt` / `htmlToPlainText` rather than the markup (a
  document is compared by its words, and a list view is the one place rendering
  author-supplied HTML buys nothing); `date`/`datetime` use a shadcn `Calendar` popover
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
  link-managed relation (many / inverse-of-many) _is_ publish-gated, but by its
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
  **`QueryBuilder`**, _not_ a drawer — a nested modal over the dialog is an a11y
  hazard) over the _target type's_ filterable surface (`useFilterFields(target)`,
  gated on the dialog being open), and a lazily-scrolled candidate list (accessible
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
  load, and single-relation _values_ come from the entry read's `values` (their
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
      sees exactly what a Save will persist. It is **exported from the package
      index** (like `EntryStatusBadge`) so a plugin contributing an `ENTRY_TAB_SLOT`
      tab — the media plugin's Media tab — marks a changed field with the same
      badge instead of a look-alike that drifts.
- **Writes + permissions.** The sidebar's Save / Save&publish / Unpublish / Delete
  actions, the table row menu (Edit/Publish/Unpublish/Delete; Restore/Delete-
  permanently in trash), and the selection-bar bulk actions are all gated by
  `useHasPermission` (`content:create`/`update`/`publish`/`delete`). "Save &
  publish" chains create/update then the dedicated publish endpoint (one validated
  path). Bulk publish opens **`BulkPublishDialog`** — a dry run
  (`bulk/publish/preview`) listing each row's verdict before publishing only the
  valid drafts. That dialog is **exported from the package index**: a plugin
  acting on a _known_ set of this library's records reuses the whole dry-run →
  verdicts → commit flow rather than building a second one (i18n's "publish all
  locales" hands it the record's locale siblings). Two props make it read as
  something other than a table selection — `labels` (heading/body) and
  `labelFor(id)`, which renames a row when the verdict's own title is the wrong
  handle (every locale sibling carries the _same_ record title, so the locale is
  what tells them apart). `useBulkEntryActions` is exported for the same reason —
  i18n's "unpublish all locales" is `bulk/unpublish` over the sibling ids, since
  unpublish has no pre-flight to run. Destructive actions confirm through the design-system
  **`ConfirmDialog`** (shared, i18n-free — pass localized labels). Mutations invalidate the type's records list
  (`contentEntriesPrefix`); the 422 `issues` ride on `ApiError.details` and are
  extracted by `infrastructure/entryIssues`.
- The design-system `command` + `collapsible` + `tabs` + `calendar` +
  `multi-select` primitives this plugin relies on were added there via the
  shadcn skill (consumed from `@ortha-cms/design-system`).

## The work-area region

`WorkAreaRegion` (wrapping the page's `<Routes>`) offers a **fillable region**
spanning the content pane below the top bar, published through
`useWorkAreaRegion`. A control that needs the whole area fills it by portal; the
region then hides the routed content.

Why a region and not the control hiding things itself: a form control has no
reach outside itself, so it cannot make its siblings disappear. And why the
routed content is hidden (`display: none`) rather than unmounted: the control
doing the filling *lives* in that form, and its value is the form's state —
unmounting would take the control, its portal and the edit with it. `display:
none` also drops the form out of the tab order and the accessibility tree, so
there is nothing behind the region to reach by accident. Unfilled, the wrapper is
`display: contents` and disappears from layout, so every route lays out exactly
as it did before the region existed.

It is the same idiom as the shell's `PageActionsPortal` / `RightPanelPortal`, one
level down — the region belongs to this page because the top bar it sits under is
this page's, not the shell's.

## The Properties panel + the editor's actions live in the app chrome

The entry editor no longer draws its own rail or its own action bar. Both render
into **shell-owned regions** (`@ortha-cms/shell-admin`), filled by portal from
inside the editor:

- **`RightPanelPortal title="Properties"`** ← `EntrySidebar`, the panel body.
  The shell's `AppRightPanel` supplies the column, the heading, the collapse
  toggle and the independent scroll; collapsed, the column disappears and the
  reopen button shows up in the top bar.
- **`PageActionsPortal`** ← **`EntryActions`**, the write actions (the primary
  **Publish** / **Save** / **Save draft** button + the ⋯ menu holding Save draft,
  Save & publish, Unpublish, Delete, each permission-gated, plus the delete
  `ConfirmDialog`). They sit in the top bar because the panel can be collapsed
  away entirely and a record you can't save is a trap.
  `ContentTopBar` renders the shell's `<PageActions />` as its last child, which
  is the region they land in.

**Why portals and not "hand the shell a node".** React resolves context by where
a node is _rendered_. Rendered by the shell, this content would be cut off from
`useCurrentWorkspace` (every entry query needs it), from `EntrySlotContext` (the
i18n **Locale** widget), and from the editor's own handlers and busy state.
`createPortal` moves only the DOM. `ContentNavSection` is the counter-example —
it renders above `CurrentWorkspaceProvider` and has to re-resolve the workspace
by hand.

The panel body itself is a **single flat surface**: a run of sections told apart
by **dividers**, deliberately not a column of cards — every block used to draw
its own border, tinted background, and heading, so five blocks read as five
floating boxes stacked on a page rather than one surface with sections.

- **`EntrySidebarSection`** (title + optional `action` adornment + optional
  `description`) and **`EntrySidebarRow`** (a `<dt>`/`<dd>` label-left /
  value-right pair, `stacked` for a long value like a UUID) are the panel's whole
  chrome. Both are **exported from the package index** — a plugin filling
  `ENTRY_SIDEBAR_WIDGET_SLOT` (the i18n **Locale** panel) renders _these_, for the
  same reason `ChangedBadge` and `EntryStatusBadge` are shared: a widget with a
  card of its own would be the one floating box left in the panel.
- **The divider belongs to the rail, not the section.** The blocks sit in a
  `divide-y` wrapper, so a contributed widget is separated exactly like a
  built-in one without drawing a border itself (and a widget that renders `null`
  — `LocaleWidget` on a non-i18n type — leaves no stray rule behind).
- **Collapse is the shell's, not ours** — including its persistence, so it
  survives the remounts this editor takes from navigations it doesn't own (a
  locale switch re-targets it at a sibling record; a single's tab segments are
  separate routes). `EntrySidebar` renders **chrome-less**: no column, no
  heading, no toggle.
- **The collapse is instant — leave it that way.** Two motion treatments were
  built for it and both were rejected: a `transition-[width]` slide and then a
  cross-fade. Don't try a third.
- Headings run `h1` (the record title) in the page → `h2` ("Properties", the
  shell panel's heading) → `h3` (each section).

## Publish state — four labels over two stored values

The server stores only `draft`/`published`, because a save moves a publishable
entry back to `draft` while its published _version_ stays live in history. That
conflates two situations a writer must tell apart, so the UI reads a **third**
signal — `EntryRecord.publishedAt`, which is stamped on publish, cleared only by
unpublish, and deliberately survives an edit:

| stored                     | shown             | meaning                            |
| -------------------------- | ----------------- | ---------------------------------- |
| (create form)              | **Not saved yet** | nothing stored                     |
| `draft`, no `publishedAt`  | **Draft**         | never published                    |
| `draft`, has `publishedAt` | **Modified**      | live content + unpublished changes |
| `published`                | **Published**     | live and current                   |

`domain/entryStatusView` is the pure classifier; **`presentation/components/
EntryStatusBadge`** is its one rendering, used by _both_ the records table's
Status column and the editor's Details block so a record can't read two ways in
the two places it's looked at. Modified is a `warning` badge, not `success` —
what's live is not what's on screen. The table cell used to print the raw wire
value (`draft`/`published`, lowercase, untranslated); it is now localized, which
a third state with no column value spelling it made unavoidable.

## Save/publish flow — one refresh pass, one cover

- **`application/refreshEntryCaches`** is the single cache-refresh pass for any
  entry write (list, revisions, relations, per-field links, and — unless
  `skipEntry` — the read-one). Having one definition is what lets the
  save→publish **chain** run it _once at the end_ (`useSaveEntry` takes
  `deferRefresh`, set by `usePublishEntryFlow` from the same `canPublish` gate,
  now decided **before** the save) instead of each mutation refetching on the way
  past — one Publish click used to re-read the record and its whole timeline
  twice. If the chained publish 422s, the flow runs the deferred pass itself so a
  landed save isn't left with stale caches.
- **Write responses seed the cache.** Every entry write returns the canonical
  record, so each mutation `setQueryData`s the read-one instead of invalidating
  it, and `useContentEntry` carries a `staleTime` so the create→`/:type/:id`
  navigation stops discarding the record it was just handed. Only the **primed**
  record is spared (`primedEntryId`) — every _other_ cached record of the type is
  still invalidated, because one save can rewrite rows it didn't name: the i18n
  shared-field sync writes a non-localized field to every locale sibling, and
  sparing the whole prefix left a switch to that sibling showing the pre-save
  copy until a reload. Cache-seeded opens
  pass `initialDataUpdatedAt` (the age of the _list_ read), so a stale row still
  refetches. Invalidation ignores `staleTime`, so nothing this app writes goes
  unnoticed.
- **`EntryBusyOverlay`** covers the editor for the whole write — a blur +
  spinner + "Saving…"/"Publishing…", mirroring i18n's locale-switch flourish. Two
  differences from that one: **no delay** (nothing changes until the server
  answers, so there's nothing to hide behind a cover — only lag to add), and **no
  fixed timer** (it's held by `ContentEntryView` around the whole `flow.submit`,
  refetches included, so it never lifts onto pre-save values). It's held in view
  state rather than derived from `isPending` because the chain's two mutations
  are briefly both idle between steps, which would blink the cover mid-flow.

## Revisions (version history)

Every save is versioned (server: `content_entry_revisions`). The editor surfaces
this in two mount points that share one cached query and one action core:

- **`useEntryRevisions`** (`application/`) reads the timeline
  (`GET /content/:type/:id/revisions`), gated on a saved entry id.
  **`useRevisionActions`** owns the **restore** (`POST …/revisions/:number/restore`)
  and **publish-a-version** (`POST …/revisions/:number/publish`) mutations, both
  invalidating the same caches a save does (records list, read-one, relations, and
  the revisions prefix). Every mutation that changes the timeline invalidates the
  **revisions prefix** so the widget + History tab refresh immediately:
  `useSaveEntry` (each save appends a version; on a publishable type a save is a
  **draft** — editing a published entry moves it back to draft while its published
  version stays live in history) and `useEntryStatusActions` (publish/unpublish).
- **Publishing a version.** Server-side, publishing a version marks **that
  version** live in place (prior live → superseded); an earlier version's content
  is re-applied to the record first, but **no new version is recorded** — the
  timeline doesn't grow by one on every publish. So the editor can build up drafts
  and then publish the current one **or switch back to any earlier version and
  publish it**. After the latter, the "Live" badge and the "Current" (newest)
  marker sit on different rows — that is the point, not a glitch.
  A `RevisionRow` shows a **Publish** action on any version that isn't already live
  (publishable type + `content:publish`), and the preview dialog carries a
  **Publish this version** button; both route through a `ConfirmDialog` + toast in
  `RevisionList`. A `422` (an incomplete version) surfaces as an error toast.
- **`RevisionList`** (`EntryEditor/RevisionList/`) is the shared core — a
  `RevisionRow` per version (number, status badge Live/Draft/Superseded, capture
  time) plus the **Restore** flow (permission gate on `content:update`, a
  `ConfirmDialog`, and the success/failure `toast`). Restore re-applies an older
  snapshot as a **new** revision, so the timeline refreshes in place.
- **Preview / compare** (`RevisionList/RevisionPreviewDialog/`): each earlier
  version's row carries a **Preview** action opening a diff dialog. It fetches
  that version's snapshot **and** the latest one (`useRevisionDetail` →
  `getRevision`; the newest snapshot equals the live record, since every save
  appends one) and runs the pure `domain/revisionDiff` — a field-by-field compare
  in schema order (scalars/single-FKs via `values`, join-backed relations via the
  ordered `relations` id lists). Changed fields render a **Current → Version {n}**
  pair, unchanged ones collapse behind a toggle. Scalars format via
  `formatRevisionValue` (a read-only sibling of the records table's `renderCell`);
  **relation fields render the actual linked records** (`RelationRefList`), not a
  count — the detail read resolves each field's snapshot ids to titled refs
  server-side (`RevisionDetail.relationRefs`/`relationTotals`, capped with a "+N
  more"; a soft-deleted / cross-workspace target reads as "Unavailable record").
  **Media fields render the actual assets** the same way (`MediaRefList` —
  thumbnail + file name, in stored order — the ref's `thumbUrl` derivative when
  the asset has one, else the original), from `RevisionDetail.mediaRefs`, which
  the server had always resolved and the admin used to drop: a media row printed
  the bare asset uuid, which tells a reader nothing about what a version held. A
  side with no resolved list falls back to `formatRevisionValue` — the server
  omits an empty field (so the row reads "Empty") and omits media wholly when no
  media plugin is bound, where the stored value beats claiming "No assets".
  A **Restore this version** button hands the number back to the list's restore
  flow (its own `ConfirmDialog`) — never a modal stacked on a modal. The Preview +
  Restore actions are hidden on the newest row (nothing to compare/apply against),
  and render **icon-only** in the compact right-rail widget (`compact` prop) vs.
  labelled in the History tab.
- Two mount points: the right-rail **`RevisionWidget`** (rendered by
  `EntrySidebar` below Details, a compact first-N view) and the **History tab**
  **`HistoryTimeline`** (the full list; prompts to save first on a create form).

The gateway carries `listRevisions` / `getRevision` / `restoreRevision`; the wire
types (`RevisionSummary` / `RevisionDetail` / `RevisionListView`) live in
`domain/types/contentType`, mirroring the server. Previewing a version is a
**read-only compare against the current record** (the `RevisionPreviewDialog`
above), not an in-form staging preview; restore remains the switch-back path.

## Extension slots

The library exposes ten named slots (`presentation/slots/contentSlots`, via
`createSlot`) another admin plugin contributes into — no coupling beyond the
contracts, the same idiom as the workspace shell's slots.
`@ortha-cms/i18n-admin` fills eight; `@ortha-cms/media-admin` fills the other two
(`ENTRY_TAB_SLOT`, the Media tab, and `ENTRY_PRESAVE_SLOT`, its staged uploads).
**Slot items are boot-frozen**
(`createAdmin` registers them once, before the first render), which is what
makes the **hook-style** items (`RECORDS_COLUMN_SLOT.useRowsData`,
`RECORDS_FILTER_FIELDS_SLOT.useFields`, `ENTRY_PRESAVE_SLOT.usePresave`,
`ENTRY_MENU_SLOT.useItem`)
rules-of-hooks-safe when the render
sites call them in a loop — the call order never changes; an item gates its own
fetching internally.

- **`RECORDS_TOOLBAR_SLOT`** — a control in the records toolbar; owns URL
  `listParamKeys` forwarded to the list request (and its query key), with
  `updateParams` (resets the page).
- **`RECORDS_COLUMN_SLOT`** — an extension table column (`COLUMN_KIND.Extension`)
  that joins the column picker like any column (non-sortable header); optional
  `useRowsData` batches per-page data once for all its cells.
- **`ENTRY_SIDEBAR_WIDGET_SLOT`** — a **section** of the entry editor's
  Properties rail (render the exported `EntrySidebarSection` /
  `EntrySidebarRow`, not a card — see _The Properties rail_ above),
  rendered with an `EntrySlotContext` (schema, entry?, isCreate, mode,
  workspaceId, typePath, **params**, **tabSegment**) assembled by
  `ContentEntryView` and shared
  via `EntrySlotContextProvider`. `params` is the current URL values of the
  `ENTRY_PARAMS_SLOT` keys (list + create-body), opaque — a slot reads only its
  own keys (e.g. i18n scopes the relation picker by its `locale` even on a create
  form, where there's no saved `entry`). `tabSegment` is the open tab as a path
  segment (`'/relations'`, or `''` on the default tab) — a slot that navigates
  the user to **another record in this same editor** appends it so they land on
  the tab they were working in.
- **`ENTRY_HEADER_SLOT`** — an inline element in the entry editor's title row,
  rendered **after** the `<h1>` (the heading stays the sole `<h1>`) with the
  same `EntrySlotContext`. Used for the i18n plugin's current-locale chip.
- **`RECORDS_FILTER_FIELDS_SLOT`** — extra query-builder filter fields, appended
  after the server-derived fields (`useFilterFields`) at the call site.
- **`CONTENT_OVERLAY_SLOT`** — viewport-level chrome, rendered once by
  `ContentLibraryPage` (via `ContentOverlays`) **outside** its `<Routes>`, so a
  contribution stays mounted across every navigation within the library —
  including the window where the entry editor has replaced itself with a loading
  state. That window is why the slot exists: the i18n plugin's locale-switch
  cover used to be rendered by the editor's sidebar widget, i.e. inside the very
  tree that unmounts while the destination record loads, so it vanished
  mid-transition and came back after — two loaders blinking in sequence. A cover
  has to outlive the thing it covers. Takes no props; anything view-specific
  belongs in a narrower slot.
- **`ENTRY_PARAMS_SLOT`** — non-visual plumbing: params scoping the single-mode
  one-entry read (`listParamKeys`), URL values copied into the create body
  (`createBodyKeys`; each must exist on the server `SaveEntryDto`), and extra
  relation-candidate list params (`relationCandidateParams`, consumed by the
  picker dialog through the slot context).
- **`ENTRY_TAB_SLOT`** — a whole editor **tab** (id + `slug` + `label` + `order`
    - `appliesTo` + `Component`). Rendered between Relations and History when
      `appliesTo(schema)` holds; the `slug` must be a known `ENTRY_TAB_SLUGS` member
      so the tab router/`entryTabFromPath` accept it. The Component receives an
      **`EntryTabContext`** — the `EntrySlotContext` plus a **form bridge**
      (`values` / `errorFor` / `setValue` / `touch` / `isFieldDirty`) and the saved
      entry's resolved `mediaRefs` — so a contributed tab renders controls bound to
      the editor's shared form: a field edited there rides Save, the Changed badge,
      the publish gate, and the 422→field mapping exactly like a General-tab field.
      `@ortha-cms/media-admin` fills it with the **Media** tab (media fields live in
      the values bag; the tab is only their rendering surface). `useSaveEntry` also
      invalidates the entry-media cache so the tab reflects the saved set. The
      context also carries **`presave`** — the handles below, so a tab reaches state
      that has to outlive its own body.
- **`ENTRY_MENU_SLOT`** — an action in the entry editor's **⋯ menu**
  (id + `group` + `order` + optional `appliesTo` + **`useItem`**). The menu is laid
  out in `ENTRY_MENU_GROUP` sections — `save` · `publish` · `extras` · `danger`,
  a rule between non-empty ones — and the built-ins sit in them too (Save draft +
  Save & publish, Unpublish, Delete), which is what makes a contribution land in a
  run of related actions instead of after Delete. Contributions default to
  `extras`.
    - `useItem(context)` is a **hook**, not static data: a real item needs
      queries, `useHasPermission` and its own dialog state. Return `null` to
      hide — that is how an item disappears **without skipping its hook**.
      `appliesTo` filters the _result_, never the call, so the hook count can't
      change when the open type does.
    - An item's `overlay` is rendered **outside** `DropdownMenuContent`, by
      `EntryMenu`. That is the whole reason the menu is its own component: the
      menu content unmounts the instant the menu closes — precisely when a
      dialog opened from it is meant to appear — so an item's dialog cannot live
      inside it.
    - `@ortha-cms/i18n-admin` fills it with **Publish all locales** / **Unpublish
      all locales**.
- **`ENTRY_PRESAVE_SLOT`** — a plugin's participation in the **save itself**:
  `usePresave()` is mounted once per `ContentEntryView` and returns
  `{ commit, settle?, handle? }`. `commit(values, publish)` runs after client
  validation and **before** the write, under the busy cover, and returns the
  values actually saved — throwing aborts the save (the step owns surfacing its
  own failure). `settle()` runs once the write succeeded. `handle` is published
  to contributed tabs as `EntryTabContext.presave[id]`, opaque, each tab reading
  only its own key.
  This is what lets `@ortha-cms/media-admin` **defer uploads to Save**: files
  chosen on a media field are staged under a placeholder uuid (which the values
  bag holds, so validation and the publish gate treat them like any asset id),
  and `commit` uploads them and swaps in the real ids. The staging lives in the
  hook because editor **tabs are routes** — the Media panel unmounts on every tab
  switch, and a file staged there must not die with it.

The data hooks accept slot-contributed passthrough: `useContentEntries` (`extra`
list params), `useSaveEntry` (`extra` create-body params), `useRelationCandidates`
(`extra`). Wire types carry `i18n` (summary/detail), `localized` (field), and
`locale`/`localeGroupId` (`EntryRecord`).

Two generic hooks surface the `localized` schema flag (same way the editor
already surfaces `required`), so a locale plugin needs no field-level slot:

- `EntryFieldInput` renders a small **localizable indicator**
  (`LocalizedFieldMark` — a `Globe` in a **`Tooltip`**, opening on hover _and_
  focus; it was a bare span with a native `title`, which never surfaces for
  keyboard or touch users) when `field.localized`. Its trigger suppresses the
  surrounding `<label>`'s activation, so reading the hint never focuses — or, on
  a toggle, flips — the control it describes. It shares a single right-aligned
  **end-adornment** with the
  "Changed" badge (the `changed` prop) at the far right of the label row (a
  `w-full` `FieldLabel`, or `InputField`'s `labelAction` slot) — so the badge and
  the globe sit **side by side** instead of overlapping. The `changed` flag comes
  from `EntryFieldSections` (`isChanged`); the badge is no longer an absolute
  overlay. Self-scopes (only i18n types ever mark a field localized).
- A **required** field's label carries a `RequiredMark` (`*`) and its control
  carries `aria-required`. The mark is deliberately `aria-hidden`: the control
  already announces "required", so marking the asterisk up too would say it
  twice on every required field.
- `EntryFieldSections` **groups the General tab by locale scope** when the type
  has both kinds of field: a **Translated fields** run (`localized`) over a
  **Shared fields** run, each a `FieldGroup` with a one-line explanation —
  editing a shared field changes it in _every_ locale, which is not something to
  discover after saving. A type with only one kind (every plain, non-i18n type)
  keeps the flat, header-free stack, so this is inert outside i18n.
- `RelationFieldSection` marks a relation whose **target collection** is
  localized (`targetSchema.i18n`) with a `LocalizedRelationMark`. It labels the
  _field_, not each linked row: the picker scopes candidates strictly to the
  record's locale, so every link is necessarily in it — one identical locale
  repeated down every row would be noise, while _why the picker hides other
  locales' records_ is the part that isn't obvious.
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
  `TAB_PARAM` / `ENTRY_TAB` / `ENTRY_TAB_SLUGS` / `DEFAULT_ENTRY_TAB` are the
  editor's tab routes; `SEARCH_SHORTCUT_KEY` is the ⌘K key; `CONTENT_READ` is
  the permission gate.

## Commands

- `npm exec nx typecheck @ortha-cms/content-admin`
- `npm exec nx lint @ortha-cms/content-admin`

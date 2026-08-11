# @ortha-cms/content-admin — Test Artifact

> **Unit:** `packages/content/admin` · **Package:** `@ortha-cms/content-admin` · **Kind:** admin plugin
> **Source of truth:** `packages/content/admin/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** the Content Library experience inside a workspace: the app sidebar's
**Content section** (search trigger + Favorites/Collections/Pages groups + the
⌘K palette), the work-area island at `/workspaces/:id/content/*` (top bar +
nested routes), the **records table** for a collection (search, query-builder
filter, click-to-sort headers, column picker with drag/keyboard reorder, row
selection + bulk bar, pagination, trash view, per-row actions), the
**entry editor** for create/edit/single (tabbed, schema-driven form; Relations
tab + relation picker; History/revisions; the Properties rail and the write
actions portalled into the shell chrome), eight **Insights widgets**, and the
**eleven extension slots** other plugins fill.

**Does NOT own:**

- the content model, validation rules or the publish gate — those live in
  `@ortha-cms/content-domain` (the kernel) and `@ortha-cms/content-server`
  ([ADR-0003](../adr/0003-tactical-ddd-inside-plugins.md)); this package's
  `presentation/entryValidation` is only an **i18n anti-corruption layer**
  (`src/lib/presentation/entryValidation/index.ts:96-134`);
- the rich-text control (`@ortha-cms/wysiwyg-admin` fills
  `ENTRY_FIELD_CONTROL_SLOT`), the **Media tab** and staged uploads
  (`@ortha-cms/media-admin` fills `ENTRY_TAB_SLOT` + `ENTRY_PRESAVE_SLOT`), and
  all locale behaviour (`@ortha-cms/i18n-admin` fills eight slots);
- the sidebar chrome, right panel and page-actions region (`shell/admin` —
  this package only portals into `RightPanelPortal` / `PageActionsPortal`);
- the workspace shell and `useCurrentWorkspace` (`workspaces-admin`);
- permission enforcement. `useHasPermission` hides affordances for UX only; the
  server guard is the boundary (`.cursor/BUGBOT.md`, "Permission gating only in
  the UI").

### Entry points

**Routes** (all nested under the workspace shell's `content/*` route,
`src/lib/presentation/contentPlugin/index.tsx:163-177`; the route table is
`src/lib/presentation/pages/ContentLibraryPage/index.tsx:132-225`):

| Path (under `/workspaces/:id/content`) | Component | Notes |
| --- | --- | --- |
| *(index)* | `ContentWelcome` | landing |
| `history` / `trash` | `ContentComingSoon` | placeholders (library-level) |
| `:typeName` | `ContentTypeView` | collection → records table; single → editor |
| `:typeName/{general,relations,media,history}` | `ContentTypeView` | a **single**'s tab segments, static so they outrank `:entryId` (`ContentLibraryPage/index.tsx:169-175`) |
| `:typeName/trash` | `ContentTypeView trashed` | collection trash |
| `:typeName/new` and `:typeName/new/:tab` | `ContentEntryRoute mode=create` | |
| `:typeName/:entryId` and `:typeName/:entryId/:tab` | `ContentEntryRoute mode=edit` | |
| `*` | `<Navigate to="." replace>` | silent fallback (`:224`) |

**Slots filled:** `WORKSPACE_SECTION_SLOT` (`ContentNavSection`, order 10),
`WORKSPACE_ROUTE_SLOT` (`content/*`, order 10 → the workspace's default
landing), `COMMAND_SLOT` (`ContentTypeCommands`, order 20),
`INSIGHTS_WIDGET_SLOT` (eight items, `contentPlugin/index.tsx:53-141`).

**Slots defined** (eleven, `src/lib/presentation/slots/contentSlots/index.ts`):
`RECORDS_TOOLBAR_SLOT:66`, `RECORDS_COLUMN_SLOT:109`,
`ENTRY_SIDEBAR_WIDGET_SLOT:161`, `ENTRY_HEADER_SLOT:178`,
`CONTENT_OVERLAY_SLOT:207`, `RECORDS_FILTER_FIELDS_SLOT:223`,
`ENTRY_PARAMS_SLOT:257`, `ENTRY_TAB_SLOT:347`, `ENTRY_MENU_SLOT:397`,
`ENTRY_PRESAVE_SLOT:449`, `ENTRY_FIELD_CONTROL_SLOT:559`.
(The root `AGENTS.md` and `CONTEXT-MAP.md` still say "five" — stale.)

**API calls** (all through `infrastructure/httpContentGateway`, the sole
`apiClient` user, plus `httpContentInsightsGateway` for the widgets):
`GET /api/content-schema`, `GET /api/content-schema/:name`,
`GET /api/content-schema/:name/filter-fields`, `GET /api/content/:name`
(list + candidates + single resolution), `GET /api/content/:name/:id`,
`POST|PATCH /api/content/:name[/:id]`, `POST …/:id/publish|unpublish|restore`,
`DELETE …/:id`, `DELETE …/:id/purge`, `GET …/:id/relations`,
`GET …/:id/relations/:field`, `GET …/:id/media`, `GET …/:id/revisions`,
`GET …/:id/revisions/:n`, `POST …/revisions/:n/restore|publish`,
`POST …/bulk/publish[/preview]|unpublish|delete`, and the
`/api/insights/content/*` aggregates.

**Exports** (`src/index.ts`): `ContentPlugin`, all eleven slot symbols + their
item/context types, `EntrySidebarSection`, `EntrySidebarRow`, `ChangedBadge`,
`EntryStatusBadge`, `BulkPublishDialog`, `useBulkEntryActions`, the query keys,
and the `ContentType`/`ContentTypeDetail`/`ContentField`/`EntryRecord`/`MediaRef`
view types.

### Runtime prerequisites

- Stack up: `docker compose up -d && npm run dev` (Vite proxies `/api` → `:3000`).
- A signed-in session **and** membership of the workspace being opened.
- `content:read` gates everything (`domain/constants/index.ts:8`); writes need
  `content:create` / `content:update` / `content:publish` / `content:delete`
  (`:11-20`).
- **The workspace must have content grants.** The schema list is global and
  filtered to `workspace.content`
  (`ContentLibraryPage/index.tsx:112-113`, `ContentNavSection/index.tsx:59-60`);
  a workspace granted nothing renders `ContentLibraryEmpty` and **no sidebar
  section at all**.
- For the entry editor's Media tab you additionally need `@ortha-cms/media-admin`
  registered; for rich text, `@ortha-cms/wysiwyg-admin`. **Both are optional
  plugins** — see `🐞 BUG-content-admin-02`.
- e2e needs no server: `apps/admin-e2e` mocks `/api` with `page.route`
  (`apps/admin-e2e/src/support/api/content.ts`).

### How to exercise it manually

```bash
docker compose up -d && npm run dev
# http://localhost:4200 → sign in → /workspaces/<id>  (lands on Content)
#   /workspaces/<id>/content                     → welcome + sidebar
#   /workspaces/<id>/content/blog_post           → records table
#   /workspaces/<id>/content/blog_post?q=a&sort=-title&page=2&pageSize=5
#   /workspaces/<id>/content/blog_post/trash     → trash view
#   /workspaces/<id>/content/blog_post/new       → create editor
#   /workspaces/<id>/content/blog_post/<id>/relations   → Relations tab
#   /workspaces/<id>/content/home_page/history   → a single's History tab
```

Run the e2e suites (no server needed):

```bash
npx nx e2e admin-e2e -- --project=chromium src/content
```

### Dependencies that must be healthy

`@ortha-cms/workspaces-admin` (`useCurrentWorkspace`, `useWorkspaces`, the
workspace slots — register `ContentPlugin()` **after** `WorkspacesPlugin()`),
`@ortha-cms/shell-admin` (`RightPanelPortal`, `PageActionsPortal`,
`COMMAND_SLOT`), `@ortha-cms/identity-admin` (`useHasPermission`),
`@ortha-cms/content-domain` (the validation kernel + `canPublish`),
`@ortha-cms/query-builder-admin`, `@ortha-cms/insights-admin`,
`@ortha-cms/utils-admin` (`apiClient`, `createSlot`, `useTableUrlState`,
`useUnsavedChanges`, `ApiError`), `@ortha-cms/design-system`, `@dnd-kit/*`.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Content sidebar section (nav landmark "Content types", heading, search trigger) | `presentation/components/ContentSidebar/index.tsx:102-126` | ✅ E2E |
| F2 | Collapsible Collections / Pages groups; the open type's group starts expanded | `ContentSidebar/index.tsx:79-85,145-163` | ✅ E2E |
| F3 | Favorites group (pin/unpin, per-workspace `localStorage`) | `presentation/hooks/useContentFavorites/index.ts:42-79` | ✅ E2E |
| F4 | Sidebar hides itself when the workspace has no granted types | `ContentNavSection/index.tsx:54-63` | ⚠️ PARTIAL |
| F5 | ⌘K / Ctrl+K opens the palette from anywhere in the workspace | `ContentNavSection/index.tsx:36-48` | ✅ E2E |
| F6 | Non-⌘K route into the palette (sidebar "Search…" button) | `ContentSidebar/index.tsx:113-125` | ✅ E2E |
| F7 | Palette lists Collections + Pages, filters, navigates on select | `ContentSearchDialog/index.tsx:90-140` | ✅ E2E |
| F8 | Palette footer keyboard legend (↑↓ / ↵ / esc) | `ContentSearchDialog/index.tsx:141-155` | ❌ NONE |
| F9 | Library forbidden state without `content:read` | `pages/ContentLibraryPage/index.tsx:81-96` | ❌ NONE |
| F10 | Library error state + retry (distinct from empty) | `ContentLibraryPage/index.tsx:98-104` → `ContentLibraryError` | ✅ E2E |
| F11 | Library empty state (no grants) | `ContentLibraryPage/index.tsx:115-121` | ✅ E2E |
| F12 | Type catalogue scoped to `workspace.content` | `ContentLibraryPage/index.tsx:112-113` | ✅ E2E |
| F13 | Unknown `:typeName` → not-found pane | `ContentTypeView/index.tsx:48-66` | ❌ NONE |
| F14 | Unknown type on an entry route → redirect to library index | `ContentEntryRoute/index.tsx:104-111` | ❌ NONE |
| F15 | Top bar breadcrumb (Content › type › record / New / Trash) | `ContentTopBar/index.tsx` | ⚠️ PARTIAL |
| F16 | Records table: columns from schema, `scope="col"`, table `aria-label` | `CollectionRecordsTable/index.tsx:277-354` | ✅ E2E |
| F17 | Click-to-sort headers, asc → desc → off, `aria-sort`, `?sort=` | `CollectionRecordsTable/index.tsx:291-348`, `LoadedRecordsView/index.tsx:176-187` | ✅ E2E |
| F18 | Relation columns render `RelationCell` (titles + `+N`), non-sortable | `CollectionRecordsTable/index.tsx:80-86,146-159` | ✅ E2E |
| F19 | Rich-text columns render a plain-text excerpt | `domain/richTextExcerpt/index.ts:205-214`, `renderCell.tsx:101-110` | ❌ NONE |
| F20 | Per-type cell rendering (bool/select/multiselect/date/money/number/json) | `CollectionRecordsTable/renderCell.tsx:26-118` | ⚠️ PARTIAL |
| F21 | Row click + first non-interactive cell `<Link>` open the record | `CollectionRecordsTable/index.tsx:261-263,443-456` | ✅ E2E |
| F22 | Fallback `sr-only` open-link when every column is interactive | `CollectionRecordsTable/index.tsx:392-410` | ❌ NONE |
| F23 | Row selection + select-all-on-page (indeterminate) + "{n} selected" bar | `LoadedRecordsView/index.tsx:229-248`, `CollectionRecordsSelectionBar` | ✅ E2E |
| F24 | Bulk actions (publish w/ dry run, unpublish, delete, restore, purge) | `CollectionRecordsBulkActions`, `BulkPublishDialog`, `application/useBulkEntryActions` | ⚠️ PARTIAL |
| F25 | Per-row actions menu: Edit/View, Publish/Unpublish, Copy ID, Delete | `CollectionRecordsRowActions/index.tsx:195-322` | ✅ E2E |
| F26 | Trash view: Restore / Delete permanently, no row navigation | `CollectionRecordsRowActions/index.tsx:209-241`, `LoadedRecordsView/index.tsx:409-419` | ❌ NONE |
| F27 | Debounced search → `?q=`, server-side | `LoadedRecordsView/index.tsx:149-161` (`useTableUrlState`) | ✅ E2E |
| F28 | Inline query-builder filter panel, `aria-expanded`/`aria-controls`, focus return | `LoadedRecordsView/index.tsx:351-360,472-516` | ✅ E2E |
| F29 | Applied-filter chip summary when the panel is collapsed | `LoadedRecordsView/index.tsx:517-524` | ✅ E2E |
| F30 | Filter fields **served** (`/filter-fields`) with loading + error + retry | `application/useFilterFields`, `LoadedRecordsView/index.tsx:254-259` | ✅ E2E |
| F31 | `RelationValuePicker` for relation-id filter rules | `components/RelationValuePicker/index.tsx` | ✅ E2E |
| F32 | Column picker: toggle + drag/keyboard reorder (session-only) | `CollectionRecordsColumnPicker/*`, `hooks/useEntryColumns/index.ts:113-158` | ✅ E2E |
| F33 | Relation preview requested only for **visible** relation columns | `LoadedRecordsView/index.tsx:277-293` | ⚠️ PARTIAL |
| F34 | Pagination: rows-per-page select, range readout, prev/next | `CollectionRecordsPagination/index.tsx:46-142` | ❌ NONE |
| F35 | Page clamped to `pageCount` after a narrowing change / delete | `LoadedRecordsView/index.tsx:333-340` | ❌ NONE |
| F36 | Three distinct list states: skeleton vs `role="alert"` error vs empty | `LoadedRecordsView/index.tsx:549-571` | ⚠️ PARTIAL |
| F37 | Two empty variants (filtered vs genuinely empty vs trash) | `CollectionRecordsEmpty/index.tsx:68-78` | ✅ E2E |
| F38 | Live regions: result count + selection count | `LoadedRecordsView/index.tsx:531-547` | ❌ NONE |
| F39 | Schema-load failure for a collection → error card + retry | `CollectionRecordsView/index.tsx:57-76` | ✅ E2E |
| F40 | Entry editor: create / edit / single resolution, cache-seeded open | `ContentEntryView/index.tsx:259-360` | ✅ E2E |
| F41 | Per-field-type controls (text, number/money, bool, select, multiselect, date/datetime, json, richtext, relation) | `EntryFieldInput/index.tsx:234-536` | ⚠️ PARTIAL |
| F42 | Required indication: `*` mark (aria-hidden) + `aria-required` on the control | `EntryFieldInput/index.tsx:162-171`, `RequiredMark/index.tsx:18-29` | ✅ E2E |
| F43 | Localized-field globe mark in a focusable tooltip | `LocalizedFieldMark/index.tsx:34-54` | ✅ E2E |
| F44 | "Changed" badge per dirty field / relation section | `ChangedBadge/index.tsx:66-73`, `EntryEditor/index.tsx:269-271` | ✅ E2E |
| F45 | Validation errors: `<FieldError id>` + `aria-describedby` + `aria-invalid` | `EntryFieldInput/index.tsx:180-184` | ❌ NONE |
| F46 | Strict vs draft validation (`submit` vs `submitDraft`), reveal on submit | `hooks/useEntryForm/index.ts:152-170` | ⚠️ PARTIAL |
| F47 | Server 422 → inline per-field errors, cleared on edit | `useEntryForm/index.ts:108-129`, `infrastructure/entryIssues` | ❌ NONE |
| F48 | Blocked submit announces itself (toast naming the first field) + switches tab | `EntryEditor/index.tsx:479-500` | ✅ E2E |
| F49 | Publish gate panel in the Properties rail (live pass/fail per field) | `EntrySidebar/PublishGate/index.tsx:70-150`, `EntryEditor/index.tsx:378-443` | ❌ NONE |
| F50 | Required **link-managed** relation gated by effective link count | `EntryEditor/index.tsx:396-436` | ❌ NONE |
| F51 | Editor tabs are routes (General/Relations/[slot tabs]/History) | `domain/entryTab/index.ts:16-21`, `ContentEntryView/index.tsx:242-257` | ✅ E2E |
| F52 | Write actions portalled into the top bar (primary + ⋯ menu, grouped) | `EntryActions/index.tsx:110-143`, `EntryMenu/index.tsx:113-166` | ✅ E2E |
| F53 | Properties rail portalled into the shell right panel | `EntryEditor/index.tsx:663-672`, `EntrySidebar/index.tsx:189-216` | ⚠️ PARTIAL |
| F54 | Four publish labels over two stored values (Not saved / Draft / Modified / Published) | `domain/entryStatusView`, `EntryStatusBadge/index.tsx:115-141` | ⚠️ PARTIAL |
| F55 | Save → toast, stay on editor; a create navigates to its own id | `ContentEntryView/index.tsx:486-518` | ✅ E2E |
| F56 | Save→publish chain with one deferred cache-refresh pass | `application/usePublishEntryFlow/index.ts:118-187`, `refreshEntryCaches` | ⚠️ PARTIAL |
| F57 | Busy overlay covering the whole write incl. refetches | `ContentEntryView/index.tsx:320,444-481`, `EntryBusyOverlay` | ⚠️ PARTIAL |
| F58 | Shared-field save confirmation on a localized type | `EntryEditor/index.tsx:517-533,945-969` | ❌ NONE |
| F59 | Unsaved-changes guard on any navigation away | `EntryEditor/index.tsx:596-605` (`useUnsavedChanges`) | ❌ NONE |
| F60 | Read-only editor (form, not just buttons) + `ReadOnlyNotice` | `EntryEditor/index.tsx:233-236,726`, `hooks/useEntryReadOnly` | ✅ E2E |
| F61 | Relations tab: titled cards, counts, sync marks, empty state | `RelationFieldSection/*`, `EntryEditor/index.tsx:778-917` | ✅ E2E |
| F62 | Relation picker dialog: search + inline filter + lazy list + select-all | `RelationPickerDialog/index.tsx:311-460` | ✅ E2E |
| F63 | Candidate rows: checkbox (many) / radio (single) + open-in-new-tab | `RelationCandidateRow/index.tsx:46-101` | ✅ E2E |
| F64 | Many/inverse relations staged as deltas, sent only on Save | `EntryEditor/index.tsx:445-453`, `ContentEntryView/index.tsx:117-127` | ✅ E2E |
| F65 | Ungranted relation targets hidden **and** excluded from validation/gate | `EntryEditor/index.tsx:279-314` | ✅ E2E |
| F66 | Revisions: timeline, restore, publish-a-version, preview/diff | `RevisionList/*`, `application/useRevisionActions` | ⚠️ PARTIAL |
| F67 | Revision diff renders relation refs + media refs, not raw ids | `RevisionPreviewDialog/{RelationRefList,MediaRefList}` | ❌ NONE |
| F68 | Expanded field view (`FullView`) replaces the tab strip | `EntryEditor/index.tsx:537-582,728-730` | ✅ E2E |
| F69 | The editor's `<form>` ignores submits it didn't raise (portal guard) | `EntryEditor/index.tsx:618-639` | ✅ E2E |
| F70 | Enter in a text field runs the **primary** action (publish if publishable) | `EntryEditor/index.tsx:635-638` | ⚠️ PARTIAL |
| F71 | Eleven extension slots (contract, hook-style items, boot-frozen) | `presentation/slots/contentSlots/index.ts` | ⚠️ PARTIAL |
| F72 | Slot passthrough params (`extra` list/body/candidate params) | `ContentEntryView/index.tsx:192-222`, `hooks/useSlotListParams` | ✅ E2E |
| F73 | Eight Insights widgets (3 stat tiles sharing one key + 5 charts) | `contentPlugin/index.tsx:53-141`, `application/useContentInsights` | ⚠️ PARTIAL |
| F74 | Command-palette entries jumping to a content type | `components/ContentTypeCommands/index.tsx` | ❌ NONE |
| F75 | `CONTENT_OVERLAY_SLOT` renders outside `<Routes>` so covers outlive the view | `ContentLibraryPage/index.tsx:127-130`, `ContentOverlays` | ✅ E2E |

## 3. Manual Test Plan

Common preconditions: signed in; the account is a member of workspace `W` which
is granted `blog_post` (collection, publishable, paranoid), `product`
(collection, two required fields `name` + `price`), and `home_page` (single).
Roles: `ADMIN` (all `content:*`), `EDITOR` (`content:read|create|update`),
`READER` (`content:read` only). Every block ends with a **Keyboard-only path**
and a **Screen-reader expectation** — both required by §4A.

### F1 / F2 / F3 / F6 — The Content sidebar section

**Preconditions:** `READER` in `W`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/workspaces/W/content` | Sidebar shows a `<nav aria-label="Content types">` with an `<h2>` "Content" |
| 2 | Read the section | A "Search…" button with a `⌘K` chip; a "Workspace Content" caption; "Collections" (count 2) expanded, "Pages" (count 1) collapsed |
| 3 | Click "Pages" | It expands and shows "Home page" |
| 4 | Open `/workspaces/W/content/home_page` directly | "Pages" is the group that starts open (`ContentSidebar/index.tsx:82-85`) |
| 5 | Hover a row, click its pin | The type appears in a new "Favorites" group above "Workspace Content" |
| 6 | Reload the page | The pin survives (`localStorage` key `ortha:content:favorites:W`) |
| 7 | Open the same URL as a different workspace `W2` | The Favorites group is empty — favorites are keyed per workspace |

**Keyboard-only path:** Tab reaches the "Search…" button, then each group's
disclosure trigger (Enter/Space toggles), then each type link, then each pin
toggle. **Screen-reader expectation:** the nav is announced by its label; the
group triggers announce expanded/collapsed. The `⌘K` chip is a bare `<kbd>` with
no `aria-label`, so it is read literally as "command K" — see
`♿ A11Y-content-admin-09`.

### F5 / F7 / F8 — The ⌘K command palette

**Preconditions:** `READER`, anywhere under `/workspaces/W/...`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Press ⌘K (macOS) or Ctrl+K | A modal palette opens, titled "Search content types", with the input focused |
| 2 | Type `blo` | The list narrows to matching rows; each row shows label + description/machine name + a "Collection"/"Page" badge |
| 3 | Press ↓ then ↵ | Navigates to `/workspaces/W/content/blog_post`; the palette closes |
| 4 | Press ⌘K again, then Esc | The palette closes |
| 5 | Type `zzzz` | "No content types found." |
| 6 | Press ⌘K **twice** quickly | It opens then closes — the handler *toggles* (`ContentNavSection/index.tsx:43`) |
| 7 | Focus the rich-text editor on an entry, press ⌘K | The content palette opens and the keystroke never reaches the editor — see `🐞 BUG-content-admin-06` |

**Keyboard-only path:** the whole feature is keyboard-first (cmdk owns
↑/↓/Enter/Esc and the focus trap). **Screen-reader expectation:** the dialog
announces its title and description; the input is a `combobox` wired to the
listbox by cmdk. **The filtered result count is never announced** — see
`♿ A11Y-content-admin-05`. On Esc, Radix restores focus to whatever was focused
before opening; when opened by the shortcut from an arbitrary page that is
usually correct, but there is no explicit assertion of it anywhere.

### F9 / F10 / F11 / F12 / F13 / F14 — Library-level states

**Preconditions:** vary per row.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Sign in as a role without `content:read`, open `/workspaces/W/content` | An `Alert role="alert"` titled "No access" with "You don't have permission to view content here." |
| 2 | Make `GET /api/content-schema` return 500, reload | After TanStack's 3 retries: "Couldn't load content types" + a "Try again" button |
| 3 | Click "Try again" with the API healthy | The sidebar and pane render |
| 4 | Use a workspace with zero content grants | The pane shows `ContentLibraryEmpty`; **the sidebar Content section is absent entirely** |
| 5 | Open `/workspaces/W/content/not_a_type` | "Unknown content type" / "This content type doesn't exist in this workspace." |
| 6 | Open `/workspaces/W/content/not_a_type/new` | Redirects to `/workspaces/W/content` |
| 7 | Repeat step 2, but look at the **sidebar** | The Content section silently vanishes with no error and no retry — see `🐞 BUG-content-admin-03` |

**Keyboard-only path:** the retry button is the only control; it is reachable by
Tab. **Screen-reader expectation:** the error `Alert` carries `role="alert"` so
it is announced when it replaces the pane; the sidebar's disappearance (step 7)
is announced by nothing at all.

### F16 / F17 / F20 / F21 — The records table

**Preconditions:** `ADMIN`; `blog_post` seeded with ≥ 12 rows.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/workspaces/W/content/blog_post` | Header "Blog posts" + subtitle "12 records in this collection."; a bordered card holding `<table aria-label="Blog posts records">` |
| 2 | Read the header row | A checkbox cell, one `<th scope="col">` per visible column, and a trailing "Actions" header |
| 3 | Click the "Title" header | URL gains `?sort=title`; the `<th>` reads `aria-sort="ascending"`; an ↑ icon appears; rows re-order |
| 4 | Click it again | `?sort=-title`, `aria-sort="descending"` |
| 5 | Click a third time | `sort` disappears from the URL; `aria-sort="none"` |
| 6 | Click a relation column header | Nothing happens — relation and extension headers render as plain text (`CollectionRecordsTable/index.tsx:304-310`) |
| 7 | Read a `boolean` cell | It prints the literal English `true`/`false` — see `🐞 BUG-content-admin-07` |
| 8 | Read a `money` cell holding `1999` | It reads `$19.99` regardless of the field's real currency — see `🐞 BUG-content-admin-08` |
| 9 | Click anywhere in a row | Navigates to `/workspaces/W/content/blog_post/<id>` |
| 10 | Click the title cell's link specifically | Same destination, exactly one navigation (`stopPropagation`, `:448-450`) |

**Keyboard-only path:** Tab order is Add record → search box → toolbar slot
controls → Columns → Filters → the header sort buttons (one per sortable column)
→ per row: the select checkbox → the title link → the ⋯ actions trigger. The
`<tr onClick>` itself is **not** focusable, so the title link (or the ⋯ menu's
Edit item) is the only keyboard route into a record.
**Screen-reader expectation:** the table is announced by its `aria-label`;
`aria-sort` is exposed and updated. Sorting is otherwise silent — the persistent
`role="status"` region only restates the unchanged total (see
`♿ A11Y-content-admin-04`).

### F23 / F24 / F25 — Selection, bulk actions and row actions

**Preconditions:** `ADMIN`; `blog_post` with ≥ 3 rows, at least one `draft`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Tick one row's checkbox | A bar appears above the table reading "1 selected" with bulk actions + "Clear" |
| 2 | Tick the header checkbox | Every row on the page is selected; the header checkbox is `indeterminate` when only some are |
| 3 | Go to page 2 and tick a row | The count keeps page 1's selections (selection is by id, `LoadedRecordsView/index.tsx:229`) |
| 4 | Click "Clear" | The bar disappears and "No rows selected." is announced |
| 5 | With 2 drafts selected, run bulk Publish | `BulkPublishDialog` opens with a **dry run** listing each row's verdict; only the publishable ones are published on confirm |
| 6 | Open one row's ⋯ menu | Items: Edit, Publish (or Unpublish), Copy ID, ─, Delete — each gated by permission |
| 7 | Choose Delete → confirm | Toast "Moved to trash" (paranoid) or "Deleted"; the row disappears |
| 8 | After step 7, note the selection bar | If the deleted row was selected, it stays counted — see `🐞 BUG-content-admin-05` |

**Keyboard-only path:** every checkbox is a Radix `role="checkbox"` button
(Space toggles); the ⋯ trigger opens on Enter/Space and the menu is arrow-key
navigable with `modal={false}`. **Screen-reader expectation:** each row
checkbox has a distinct name ("Select {first field value}",
`CollectionRecordsTable/index.tsx:63-73`), but **every row's ⋯ trigger is named
identically** — see `♿ A11Y-content-admin-01`. After the delete confirm closes,
focus is lost to `<body>` — see `♿ A11Y-content-admin-02`.

### F26 — Trash view

**Preconditions:** `ADMIN`; `blog_post` is `paranoid` with ≥ 1 soft-deleted row.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On the records page, click "Trash" | Navigates to `…/blog_post/trash`; title "Blog posts · Trash", subtitle "N deleted records." |
| 2 | Read a row | Rows are **not** clickable and carry no link (`trashed` disables both, `CollectionRecordsTable/index.tsx:362-372,392,443`) |
| 3 | Open a row's ⋯ menu | Restore, Copy ID, ─, Delete permanently |
| 4 | Restore → confirm nothing (no dialog) | Toast "Restored"; the row leaves the trash immediately |
| 5 | Delete permanently → confirm | Toast "Deleted"; the row is gone for good |
| 6 | Empty the trash entirely | "Trash is empty" / "Deleted records will appear here." — a third empty variant |
| 7 | Click "Back to records" | Returns to `…/blog_post` |

**Keyboard-only path:** the trash view has **no keyboard route into a record at
all** — rows are not links and the menu offers no Edit. That is intentional
(trashed rows aren't editable) but means Tab reaches only the checkbox and the ⋯
trigger per row. **Screen-reader expectation:** identical to F25, with the same
duplicate-name problem on ⋯.

### F27 / F28 / F29 / F30 / F31 — Search and the filter panel

**Preconditions:** `ADMIN` on `blog_post`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Type `hello` into "Search records" | After ~300 ms the URL gains `?q=hello`; a busy cue shows on the keystroke |
| 2 | Reload | The search survives (URL is the source of truth) |
| 3 | Search for `zzz-no-such-record` | "No records match" + a "Clear filters" button |
| 4 | Click "Filters" | The button's `aria-expanded` flips to `true`; a full-width panel pushes the table down (no overlay) |
| 5 | Build `author.name contains ann`, Apply | The panel collapses, focus returns to the "Filters" button, `?filter=` holds the JSON, the table refetches behind a skeleton |
| 6 | Read the collapsed state | A row of removable condition chips under the toolbar; the Filters button reads "Filters · 1" |
| 7 | Make `/filter-fields` 500, reopen the panel | An error state with a retry — **not** an empty field picker |
| 8 | Add a rule on a relation `id` field | The value control is a searchable, paginated `RelationValuePicker`, not a raw uuid box |

**Keyboard-only path:** the Filters button is a real `<button>` with
`aria-controls`; Esc inside the panel collapses it and returns focus to the
toggle (`LoadedRecordsView/index.tsx:357-360`). **Screen-reader expectation:**
the panel is a labelled region (`labelledBy={filtersToggleId}`); after Apply the
result count region updates. The chip summary is a plain row of buttons.

### F32 / F33 — Column picker

**Preconditions:** `ADMIN` on `blog_post`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Click "Columns" | A Popover lists visible columns first (each with a grip handle), then hidden ones |
| 2 | Untick "Excerpt" | The column disappears from the table immediately |
| 3 | Drag "Status" above "Title" | The header order changes; the table body follows |
| 4 | Focus a grip and press Space, ↓, Space | Same reorder from the keyboard (dnd-kit `KeyboardSensor`) |
| 5 | Hide the only relation column | The next list request drops `relations=preview` + `relationFields` entirely |
| 6 | Reorder two relation columns | **No** refetch — `relationFields` is sorted before joining (`LoadedRecordsView/index.tsx:286-291`) |
| 7 | Reload the page | The column choice resets to the schema defaults — it is session state, not persisted (`useEntryColumns/index.ts:113-118`) |
| 8 | Untick every column | The table renders only the checkbox and Actions columns; an `sr-only` "Open {label}" link appears in the checkbox cell (F22) |

**Keyboard-only path:** as step 4; the picker is a Popover (not a menu)
precisely so dnd-kit's keyboard sensor works. **Screen-reader expectation:**
each row is a labelled toggle; the reorder announces through dnd-kit's own live
region (design-system-owned, unverified here).

### F34 / F35 — Pagination and the page clamp

**Preconditions:** `ADMIN`; `blog_post` with exactly 21 rows, `pageSize=10`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the records page | Footer reads "Rows per page 10", "1–10 of 21", "Page 1 of 3" |
| 2 | Click "Next page" | `?page=2`; the table swaps to a skeleton, then rows 11–20 |
| 3 | Click "Next page" again | `?page=3`, one row, Next is `disabled` |
| 4 | Delete that single row | The list refetches (total 20 → `pageCount` 2) and the clamp effect rewrites `?page=2`; the table shows rows 11–20 — **not** an empty page |
| 5 | Deep-link `?page=99` | The first fetch returns page 99 (empty), then the clamp pulls it back to the last real page |
| 6 | Change rows-per-page to 100 | `?pageSize=100`, `page` is dropped (`updateParams` resets it), all 21 rows on one page, the pager controls disappear |
| 7 | Deep-link `?page=abc` / `?page=0` / `?page=-1` | All fall back to page 1 (`useTableUrlState/index.ts:9-12`) |

**Keyboard-only path:** Tab reaches the rows-per-page `Select` then Previous/Next.
**Screen-reader expectation:** the range and "Page X of Y" are plain `<span>`s
outside any live region, so **paging announces nothing** (see
`♿ A11Y-content-admin-04`); and reaching the last page disables the Next button
the user just activated, dropping focus to `<body>`
(`CollectionRecordsPagination/index.tsx:128`).

### F36 / F37 / F38 / F39 — The three list states

**Preconditions:** `ADMIN` on `blog_post`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Load with a slow `/api/content/blog_post` | A bordered skeleton of 8 shimmer rows; the sr-only status reads "Loading records…" |
| 2 | Make the list return 500 | A destructive `Alert role="alert"`: "Couldn't load this collection. Please try again." + Retry. **Not** the empty state |
| 3 | Click Retry with the API healthy | Rows render |
| 4 | Make `/api/content-schema/blog_post` return 500 | The same error card, rendered one level up (`CollectionRecordsView/index.tsx:57-76`) |
| 5 | Load a collection with 0 rows and no filters | "No records yet" / "Add the first record to this collection." + an "Add record" button (only with `content:create`) |
| 6 | Same, with a search applied | "No records match" / "Try a different search, or clear the filters." + "Clear filters" |
| 7 | Compare 1/2/5 | Three visually and textually distinct states |

**Keyboard-only path:** Retry / Clear filters / Add record are all real buttons.
**Screen-reader expectation:** loading and the result count go through a
persistently-mounted `role="status"` region (`LoadedRecordsView/index.tsx:531-537`);
the error goes through `role="alert"` and the status region is deliberately
emptied so the two don't fight. This is one of the better-handled surfaces in
the package.

### F40 / F41 / F42 / F43 / F44 / F45 — The entry editor's General tab

**Preconditions:** `EDITOR`; `product` has required `name` (text) and `price`
(money), plus optional `active` (boolean), `tier` (select), `tags`
(multiselect), `launch_at` (datetime), `spec` (json).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/workspaces/W/content/product/new` | `<h1>` "New Product"; tabs General / Relations / History; the top bar shows the primary write button |
| 2 | Read the `name` row | A `<label for="entry-field-name">` whose text ends with a red `*`; the input carries `aria-required="true"` |
| 3 | Read the `active` row | A `SegmentedControl` labelled by `entry-field-active-label` via `aria-labelledby` with Enabled / Disabled segments |
| 4 | Read the `tier` row | A `Select` whose trigger carries `id="entry-field-tier"`, so clicking the label focuses it |
| 5 | Read the `spec` row | A monospace textarea plus the description "Raw JSON." |
| 6 | Read `launch_at` | A calendar popover plus a time input (`DateField`) |
| 7 | Type `abc` into `price` and Tab away | Inline error "Must be a number"; the control gains `aria-invalid` and `aria-describedby="entry-field-price-error"`; the description is replaced by the error |
| 8 | Fix `price` to `19.99` | The error clears; the value is sent as a **number**, not a string (`EntryFieldInput/index.tsx:92-96`) |
| 9 | Clear `price` entirely | The field is sent as `undefined`, never `NaN` |
| 10 | Edit `name`, then look at its label row | A yellow "Changed" pill appears at the far right of the label row |
| 11 | On a localized type, read a `localized` field | A globe button sits beside the badge; focusing it opens a tooltip "This value can differ per locale." and does **not** focus the control |

**Keyboard-only path:** Tab walks the fields in schema-rank order (simple →
choice → large, `EntryFieldSections/index.tsx:156-171`). Every control is
natively focusable; the globe is a real `<button>` that suppresses the label's
activation. **Screen-reader expectation:** each control announces label,
required, invalid, and — once invalid — the error via `aria-describedby`. The
field **description** is *never* in `aria-describedby` (only the error is,
`EntryFieldInput/index.tsx:183-184`), so hints are never announced — see
`♿ A11Y-content-admin-03`.

### F46 / F47 / F48 / F49 / F50 — Validation, the gate, and blocked submits

**Preconditions:** `ADMIN` on `product` (publishable, both fields required).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `/product/new` and read the Properties rail | A "Publish gate" section, header badge "blocking", one row per required field with a ✗ and "Required" |
| 2 | Press **Publish** with both empty | No request is sent; a toast "Can't publish — 2 fields need attention. Start with "Name"."; the tab switches to General; both fields now show inline errors |
| 3 | Fill `name`, watch the rail | That row flips to a ✓ with no message; the header still reads "blocking" |
| 4 | Fill `price` too | The header flips to "ready"; the list is all ✓ |
| 5 | On `blog_post` (publishable) press **Save draft** with a required field empty | It saves — the draft gate is relaxed (`useEntryForm/index.ts:162-170`) |
| 6 | On `blog_post` put `abc` in a number field and press Save draft | Refused: a malformed *present* value is still gated, toast "Can't save — 1 field needs attention…" |
| 7 | Make the server return 422 with `issues:[{field:'name',message:'Already taken'}]` | The busy cover lifts and "Already taken" appears under `name` |
| 8 | Edit `name` | The server error clears immediately (`useEntryForm/index.ts:110-117`) |
| 9 | On a type with a required **many** relation, open the Relations tab and remove every link | The gate gains a row "…: Needs at least one link" even though the field is not in the values bag |
| 10 | Mark a field `admin.hidden: true` **and** `required: true` in the schema and retry step 2 | Save is permanently refused with a toast naming a field that is **rendered nowhere** — see `🐞 BUG-content-admin-01` |

**Keyboard-only path:** the primary button is reachable by Tab from the top bar;
Enter inside any text field submits the form. **Screen-reader expectation:** the
toast is announced (sonner live region), but **focus is never moved to the first
invalid field** and the gate list conveys pass/fail with an `aria-hidden` icon
and colour only — see `♿ A11Y-content-admin-06` and `♿ A11Y-content-admin-07`.

### F51 / F52 / F53 / F68 — Tabs, actions and the rail

**Preconditions:** `ADMIN` on `blog_post` record `R`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open `…/blog_post/R` | URL has no tab segment; General is selected (the bare URL is canonical) |
| 2 | Click "Relations" | URL becomes `…/blog_post/R/relations` |
| 3 | Reload | Still on Relations |
| 4 | Click "General" | The `/general` segment is dropped, not appended |
| 5 | Open `…/home_page/relations` (a single) | The static segment resolves the tab even though there is no `:entryId` (`domain/entryTab/index.ts:16-21`) |
| 6 | Read the top bar | Primary "Publish" (publishable + `content:publish`) beside a ⋯ button labelled "More actions" |
| 7 | Open ⋯ | Grouped sections separated by rules: Save draft + Save & publish · Unpublish · *(contributions)* · Delete |
| 8 | Collapse the right panel from the shell | Save/Publish stay reachable in the top bar |
| 9 | Click the rich-text field's expand control | The tab strip is replaced by the full editor; the `<h1>`, the sidebar, the top-bar actions and the Properties rail all keep working |
| 10 | Press the expanded view's back control | The tab strip returns with the value preserved |

**Keyboard-only path:** `TabsList` is a Radix roving-tabindex — one Tab stop,
arrows move between tabs, and the panel is the next stop. **Screen-reader
expectation:** the tab pattern is fully exposed by Radix. **A tab change is a
route change and moves no focus** and posts no status — see
`♿ A11Y-content-admin-08`.

### F55 / F56 / F57 / F58 / F59 — Saving

**Preconditions:** `ADMIN`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | On `/product/new` fill both fields, press Publish | A blur + spinner cover reading "Publishing…" appears; on success a toast "Product published." and the URL becomes `…/product/<newId>` |
| 2 | Press Publish again | It **updates** the same record — no second row (`usePublishEntryFlow/index.ts:120,149`) |
| 3 | Watch the network tab for step 1 | `POST /content/product` then `POST …/publish`, and **one** refresh pass at the end (`deferRefresh`) |
| 4 | Make the publish 422 after the save succeeds | The draft persists, the caches still refresh, and the field issues land on the form |
| 5 | Edit an existing published record and press Save draft | Toast "Blog post moved to draft."; the previously published *version* stays live in History |
| 6 | On a localized type edit a **shared** field and press Save | A confirm dialog "This also changes the other locales" naming the field; Cancel abandons, "Save anyway" proceeds |
| 7 | Dirty a field and click "Back to records" | A browser/app confirm blocks the navigation (`useUnsavedChanges`) |
| 8 | Repeat step 7 as `READER` | No prompt — the guard is not armed in read-only mode |
| 9 | Dirty only a **staged relation** and navigate away | The guard still fires (`isDirty` includes staged deltas, `EntryEditor/index.tsx:596-598`) |

**Keyboard-only path:** Enter in any text field triggers the primary action —
on a publishable type that is **Publish**, i.e. a keystroke publishes the record
live with no confirmation (`EntryEditor/index.tsx:635-638`). See
`🐞 BUG-content-admin-04`. **Screen-reader expectation:** the busy overlay is a
visual cover; the spinner inside it and the one in the primary button carry
`aria-hidden`, so the saving state is announced by nothing until the toast fires.

### F60 — Read-only editor

**Preconditions:** `READER` (no `content:update`), on `…/blog_post/R`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the record | A "View only" banner under the title explaining the permission |
| 2 | Focus a text field | It is focusable and selectable but `readOnly` — typing does nothing, the value stays full-contrast |
| 3 | Try the select / multiselect / boolean / date controls | All `disabled` (they have no read-only state) |
| 4 | Look at the Relations tab | No Assign/Remove/reorder controls and no drag handles; the open-in-new-tab links remain |
| 5 | Look at the top bar | No primary button, and the ⋯ menu renders only if some contribution supplies an item |
| 6 | Put the caret in a text field and press Enter | Nothing is submitted (`runSave` returns early, `EntryEditor/index.tsx:507`) |
| 7 | Open the rich-text field | It is renamed "View"; the panel renders `role="region"` with no toolbar |

**Keyboard-only path:** every field is still reachable so the record can be read
and copied. **Screen-reader expectation:** the banner is deliberately *not* a
live region — it is read in document order between the `<h1>` and the fields.

### F61 / F62 / F63 / F64 / F65 — Relations

**Preconditions:** `ADMIN`; `blog_post` has `author` (single → `author`),
`tags` (many → `tag`), `comments` (inverse), and `secret_ref` → an ungranted type.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the Relations tab | A subtitle, then one always-expanded card per relation; `secret_ref` is **absent** |
| 2 | Read the `tags` card | Label, "Ordered relation — drag to reorder…", a right-aligned "{n} linked" count |
| 3 | Click "Assign" on `tags` | A dialog "Assign Tag" with a search box, a collapsible inline filter, a scrolling candidate list of checkboxes, and Cancel / "Add {n}" |
| 4 | Type in the search | The list refetches server-side; the count line updates |
| 5 | Scroll to the bottom | The next page loads in place (infinite scroll) |
| 6 | Tick "Select all {total}" with more pages loaded | The remaining pages are pulled (progress text), then everything is checked; capped at 40 pages |
| 7 | Tick 3 rows and press "Add 3" | The dialog closes; three rows appear with `01`/`02`/`03` indices, titles and `/handle`s; the card header shows a "Changed" badge |
| 8 | Press ↓ on a row's "Move down" | The row moves one place; the staged order changes |
| 9 | Press Save and inspect the request | `values` carries **no** `tags` key; the body carries `relations: { tags: { link: [...], order: [...] } }` |
| 10 | Click "Assign" on `author` (single) then pick a row | The dialog closes immediately (radio semantics) and the value is stored in `values.author` |
| 11 | Make the candidate query 500 | The list shows "Couldn't load records. Check your connection and retry." — not the empty state |

**Keyboard-only path:** the dialog traps focus (Radix); Tab reaches search →
filter toggle → the select-all checkbox → each candidate control → Cancel → Add.
Each candidate is inside a `<label>` so Space toggles it.
**Screen-reader expectation:** the candidate group is `role="group"` (many) or
`role="radiogroup"` (single) named by the target label; each control is named by
the record title. The "{n} records" count and the "{n} selected" summary are
**not** live regions, and the "select-all was capped" warning is delivered as a
bare `⚠` glyph with a `title` — see `♿ A11Y-content-admin-10`.

### F66 / F67 — Revisions

**Preconditions:** `ADMIN`; record `R` with ≥ 3 versions, v2 currently live.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open the History tab | A row per version: number, a Live/Draft/Superseded badge (publishable types only), and the capture time |
| 2 | Read the Properties rail | The same list, compact and icon-only, under Details |
| 3 | Click Preview on v1 | A diff dialog: changed fields as "Current → Version 1" pairs, unchanged ones behind a toggle |
| 4 | Read a relation row in the diff | The **linked records' titles**, not id lists; a deleted target reads "Unavailable record" |
| 5 | Read a media row in the diff | Thumbnails + file names in stored order; a deleted asset reads "Unavailable asset" |
| 6 | Click "Publish this version" on v1 → confirm | v1 becomes Live; v2 becomes Superseded; **no new version is appended**, so "Live" and "Current" sit on different rows |
| 7 | Click Restore on v1 → confirm | v1's snapshot is re-applied as a **new** version at the top |
| 8 | Try Preview/Restore on the newest row | Neither is offered (nothing to compare against) |
| 9 | Publish a version that fails validation | An error toast; the timeline is unchanged |

**Keyboard-only path:** each row's actions are real buttons; the dialogs are
Radix and Esc-dismissible. **Screen-reader expectation:** the compact rail
variant renders icon-only buttons — verify each carries an `aria-label`
(unverified in this pass).

### F69 / F70 — The form-submit seam

**Preconditions:** `ADMIN` on a `blog_post` record with a rich-text field.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Expand the rich-text editor, insert an image, open its alt-text popover, press its own Save | Only the popover commits — the record is **not** saved or published (`EntryEditor/index.tsx:634`) |
| 2 | Put the caret in the `title` input and press Enter | The record is saved **and published** (the primary action) with no confirmation |
| 3 | Repeat step 2 on a non-publishable type | A plain save |
| 4 | Repeat step 2 as `READER` | Nothing happens |

**Keyboard-only path:** this *is* the keyboard path. **Screen-reader
expectation:** step 2 produces a "published" toast for a keystroke the user is
unlikely to have meant as "publish".

### F71 / F72 / F75 — The extension slots

**Preconditions:** `ADMIN`, with `@ortha-cms/i18n-admin` registered (it fills
eight of the eleven), plus a throwaway plugin registered after `ContentPlugin()`
for the negative cases.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Register a `RECORDS_TOOLBAR_SLOT` item declaring `listParamKeys:['locale']` | Its control renders in the toolbar's actions row, after the column picker and Filters |
| 2 | Change its param via `updateParams` | `?locale=` lands in the URL, is forwarded to `GET /api/content/:name`, rides the query key, and resets `page` |
| 3 | Register two toolbar items | They render in **plugin registration order** — the item type carries **no `order`** field (`contentSlots/index.ts:49-60`) |
| 4 | Register a `RECORDS_COLUMN_SLOT` item | It joins the column picker as an extension column, hidden by default, non-sortable, with `useRowsData` called once per page |
| 5 | Register an `ENTRY_TAB_SLOT` item with `slug:'media'`, `order:10` | The tab renders between Relations and History and receives the form bridge |
| 6 | Register one with a slug **not** in `ENTRY_TAB_SLUGS` | The trigger renders but no route matches the segment; the tab cannot be deep-linked |
| 7 | Register an `ENTRY_MENU_SLOT` item whose `useItem` returns `null` | Nothing renders, and its hook still runs (stable hook order) |
| 8 | Register an `ENTRY_MENU_SLOT` item with `group:'nonsense'` | `groups[item.group].push(...)` throws — the whole admin unmounts (`EntryMenu/index.tsx:158`) |
| 9 | Register two `ENTRY_FIELD_CONTROL_SLOT` items matching `richtext` | The **first registered** wins (`EntryFieldInput/index.tsx:192-194`) |
| 10 | Make any slot component throw during render | The whole SPA blanks — there is **no error boundary** anywhere in `bootstrap-admin`, `utils-admin` or this package |
| 11 | Register a `CONTENT_OVERLAY_SLOT` item and navigate between records | It stays mounted across every content navigation, including the editor's loading window |
| 12 | Unregister `i18n/admin` entirely | Every slot render site degrades to nothing; the library works unchanged (verified by reading each `getItems()` call site) |

**Keyboard-only path / screen-reader expectation:** delegated entirely to the
contribution — the slot contracts document a required `id` for
`ENTRY_FIELD_CONTROL_SLOT` (`contentSlots/index.ts:466-471`) but nothing
enforces it, so a control that drops the id silently breaks its `<label for>`.

### F73 / F74 — Insights widgets and command entries

**Preconditions:** `ADMIN`; open `/workspaces/W/insights`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read the Overview row | Entries / Published / Drafts tiles, served by **one** `content/totals` request (shared key) |
| 2 | Make that request 500 | All three tiles show their own error state after **2** attempts (`retry: 1`), not 4 |
| 3 | Switch workspace | The numbers refetch — keys are workspace-scoped |
| 4 | Read "Waiting to go live" | "N of M live records have pending edits"; with `live === 0` it shows its empty state instead |
| 5 | Publish a record, return to Insights | The tiles are **stale** — `refreshEntryCaches` does not invalidate the insights keys |
| 6 | Open the global command palette (shell `COMMAND_SLOT`) | Content-type entries appear and navigate into the library |

**Keyboard-only path:** the Insights page owns the frame; widgets are static
cards. **Screen-reader expectation:** chart primitives belong to
`insights-admin`; not assessed here.

## 4. Edge Cases & Negative Paths

**Empty / zero**

- **EC-01 — Workspace with zero content grants.** `✅ E2E`
  `apps/admin-e2e/src/content/content-library.spec.ts:151` — the pane shows the
  empty state. The sidebar's own `return null` (`ContentNavSection/index.tsx:61-63`)
  is not asserted.
- **EC-02 — A collection with zero rows and no filters.** `✅ E2E` (implicit in
  `content-library.spec.ts:217` for the filtered variant). Subtitle reads
  "0 records in this collection." via the plural rule.
- **EC-03 — A type with zero fields.** `❌ NONE` `EntryFieldSections` returns
  `null` (`:197`), so the General tab renders an **empty panel** with no message.
- **EC-04 — A type with no relation fields.** `✅ E2E` "This content type has no
  relation fields." (`EntryEditor/index.tsx:911-915`).
- **EC-05 — Every column hidden.** `❌ NONE` `linkColumnIndex === -1`, so the
  `sr-only` "Open {label}" link in the checkbox cell is the only route into a
  record (F22). Untested.
- **EC-06 — Empty vs whitespace-only search.** `❌ NONE` `hasFilters` uses
  `searchInput.trim()` (`LoadedRecordsView/index.tsx:363`), so `"   "` shows the
  *unfiltered* empty state — but `updateParams` writes the raw value into `?q=`,
  so the request still carries the spaces. A mismatch worth pinning.
- **EC-07 — `relationFields` empty string.** `⚠️ PARTIAL` With no relation column
  visible the list request drops `relations`/`relationFields` entirely
  (`:310-312`). Asserted only indirectly by `relation-cells.spec.ts`.
- **EC-08 — `null` vs `undefined` vs absent field value.** `❌ NONE`
  `isEmpty` treats `null` and `''` alike (`renderCell.tsx:13-15`) but **not**
  `undefined`… it does: `value == null` covers both. A `0` or `false` value is
  correctly **not** empty.
- **EC-09 — A rich-text body of `<p></p>`.** `❌ NONE` `richTextExcerpt` returns
  `''` and the cell falls back to the em-dash (`renderCell.tsx:106-108`).

**Boundary**

- **EC-10 — Delete the only row on the last page.** `❌ NONE` Steps: 21 rows,
  pageSize 10, go to page 3, delete the row. Expected **and actual**: the effect
  at `LoadedRecordsView/index.tsx:333-340` clamps `page` to `pageCount` once the
  refetch settles. This package **does** clamp — BUGBOT's classic bug is absent
  here. Not asserted anywhere; the POM even has an unused `nextPage` accessor
  (`apps/admin-e2e/src/support/pages/ContentLibraryPage.ts:502-504`).
- **EC-11 — The clamp window.** `❌ NONE` Between the delete's refetch landing
  and the effect running, `entries.length === 0` renders the **empty state** for
  one frame. With `hasFilters` false that reads "No records yet" on a collection
  holding 20 rows. Cosmetic but jarring; worth an assertion.
- **EC-12 — `?page=99` deep link.** `❌ NONE` Guarded on `data && !isPlaceholderData`
  so the first fetch is allowed through, then clamped (`:334`).
- **EC-13 — `?page=0` / `-1` / `abc` / `1.5`.** `❌ NONE` `readInt` requires an
  integer ≥ 1 (`useTableUrlState/index.ts:9-12`), so all fall back to 1.
- **EC-14 — `?pageSize=999`.** `❌ NONE` Accepted by the client; the server's
  `MAX_PAGE_SIZE` decides, and the footer then reads `data.pageSize`
  (`effectivePageSize`, `:324`) — so the *select* shows a value not in
  `PAGE_SIZE_OPTIONS` and renders blank. Untested.
- **EC-15 — Exactly `pageSize` rows.** `❌ NONE` `pageCount === 1`, the pager
  controls are hidden (`CollectionRecordsPagination/index.tsx:98`), the range
  reads "1–10 of 10".
- **EC-16 — `SELECT_ALL_PAGE_CEILING` (40 pages).** `❌ NONE` Beyond it the
  picker selects what it loaded and shows the capped warning
  (`RelationPickerDialog/index.tsx:41,278-296`).
- **EC-17 — A `?sort=` naming a column that isn't in the whitelist.** `❌ NONE`
  The client sends it verbatim; the server falls back to `updatedAt` and the
  header shows `aria-sort="none"` for every column — a silent disagreement.
- **EC-18 — `?sort=-` (bare dash).** `❌ NONE` `key` is `''` → `sort` is `null`
  (`LoadedRecordsView/index.tsx:172-175`), so it degrades to no sort.

**Size & encoding**

- **EC-19 — A title containing `<script>alert(1)</script>`.** `❌ NONE` React
  escapes it in the table cell, the breadcrumb, the row-checkbox `aria-label`
  (`rowLabel`), the relation row titles and the delete dialog. The one place
  markup is *interpreted* is the rich-text field, which belongs to
  `wysiwyg-admin`.
- **EC-20 — A rich-text body containing `<script>…</script>`.** `❌ NONE`
  `richTextExcerpt` strips script/style bodies wholesale before tag-stripping
  (`richTextExcerpt/index.ts:173,207`), and the result is only ever rendered as
  text.
- **EC-21 — Emoji / CJK / RTL in a title.** `❌ NONE` No `dir="auto"` anywhere in
  the package, so RTL content inside the LTR table renders with mixed direction.
- **EC-22 — A 10k-character text field.** `❌ NONE` No `maxLength` is applied
  from `field.validation.maxLength` to the input; the kernel reports it only
  *after* typing. A client-side `maxLength` would be a lie for a server that
  accepts more, so this is arguably right — but untested either way.
- **EC-23 — A relation many textarea fed `id1, id2\nid3`.** `❌ NONE` Split on
  `/[\s,]+/` (`EntryFieldInput/index.tsx:432`). Note this control is only
  reachable when a many-relation somehow renders through `EntryFieldInput`
  rather than `RelationFieldLive` — in practice the Relations tab owns it.
- **EC-24 — A field label that duplicates another's.** `❌ NONE` `PublishGate`
  keys its rows by `item.label` (`PublishGate/index.tsx:112`), so two fields
  sharing an `admin.label` collide on the React key.
- **EC-25 — A `select` field whose stored value is no longer in `options`.**
  `❌ NONE` `Select` renders an empty trigger; the kernel reports "Choose one of
  the allowed options" only once validation runs.
- **EC-26 — 500 columns / 100 relation columns.** `❌ NONE` Every visible
  relation column is requested as a preview; the table has no virtualisation.

**Permission matrix**

| Surface | READER (`read`) | EDITOR (`read/create/update`) | ADMIN (all) |
| --- | --- | --- | --- |
| Content sidebar + palette | visible ✅ | visible ✅ | visible ✅ |
| Records table | visible ✅ | visible ✅ | visible ✅ |
| "Add record" | hidden ✅ | visible ✅ | visible ✅ |
| "Trash" button | hidden (needs `delete`) ❌ | hidden ❌ | visible ❌ |
| Row ⋯ → Edit vs View | "View" + eye icon ✅ | "Edit" ✅ | "Edit" ✅ |
| Row ⋯ → Publish/Unpublish | hidden ❌ | hidden ❌ | visible ✅ |
| Row ⋯ → Delete | hidden ❌ | hidden ❌ | visible ✅ |
| Editor fields | read-only ✅ | editable ✅ | editable ✅ |
| Editor primary button | absent ✅ | "Save draft" ❌ | "Publish" ✅ |
| Editor ⋯ menu | absent ✅ | Save draft only ❌ | full ✅ |
| Relations assign/remove | absent ✅ | present ❌ | present ✅ |

- **EC-27 — `content:publish` without `content:update`.** `❌ NONE`
  `primary = publishable && canPublish && canSave` (`EntryActions/index.tsx:89-99`),
  and `canSave` is `canUpdate` on an existing record — so a publish-only role
  gets **no primary button and no menu**, i.e. cannot publish from the editor at
  all. It *can* still publish from the row menu (`CollectionRecordsRowActions/index.tsx:262`).
  A real inconsistency; verify against the server's intent.
- **EC-28 — `content:delete` without `content:read`.** Not reachable — the whole
  library is gated on `content:read`.
- **EC-29 — Permission revoked mid-session.** `❌ NONE` The buttons persist until
  the auth query refetches; the server refuses regardless.
- **EC-30 — A create form for a role with `update` but not `create`.** `❌ NONE`
  `EntryEditor` resolves `CONTENT_CREATE` in create mode
  (`EntryEditor/index.tsx:233-235`), so `/new` renders read-only with the
  "View only" banner — correct, untested.

**Tenant isolation**

- **EC-31 — Deep-link a record id belonging to another workspace.** `❌ NONE`
  The request carries the ambient `X-Workspace-Id`; the server 404s and the
  editor shows its load-error card. **The admin never filters by workspace
  client-side** — verified: the only client scoping is `workspace.content` on
  the *type* list (`ContentLibraryPage/index.tsx:112-113`).
- **EC-32 — Query keys are workspace-scoped.** `✅` Verified by reading every key
  in `infrastructure/contentKeys/index.ts:57-152` — all entry-scoped keys carry
  `workspaceId`. The **exception is `contentTypesKey`** (`:46`), which is a bare
  `['content-types']`: correct only because `GET /api/content-schema` is global.
  A future per-workspace schema surface would leak across workspaces from cache.
- **EC-33 — Ungranted `:typeName` deep link.** `✅ E2E`
  `content-library.spec.ts:87` asserts only granted types are listed; the
  not-found pane for an ungranted deep link is `❌ NONE`.
- **EC-34 — A relation whose target type is ungranted.** `✅ E2E`
  `apps/admin-e2e/src/content/relations.spec.ts:237` — the field is hidden. That
  it is also excluded from validation **and** the publish gate
  (`EntryEditor/index.tsx:279-314`) is not separately asserted.

**Concurrency & state after mutation**

- **EC-35 — Two editors on one record.** `❌ NONE` Last write wins; there is no
  version token in the save body. The loser's `initialValues` identity changes
  on the next refetch, which **re-seeds the form and discards their unsaved
  edits** (`useEntryForm/index.ts:82-90`) with no warning.
- **EC-36 — Double-click Publish.** `⚠️ PARTIAL` The primary button is
  `disabled={busy}` (`EntryActions/index.tsx:117`) and the busy cover is up.
  Untested.
- **EC-37 — Double-confirm a delete.** `❌ NONE` `ConfirmDialog` closes
  immediately on confirm (`CollectionRecordsRowActions/index.tsx:339`), so
  `busy={actions.remove.isPending}` never renders — the guard is the dialog
  closing, not the busy flag.
- **EC-38 — Selection surviving a mutation.** `❌ NONE` A single-row delete does
  **not** clear the selection — see `🐞 BUG-content-admin-05`.
- **EC-39 — Filters surviving a refetch and a reload.** `⚠️ PARTIAL` Search,
  filter, sort, page and pageSize are all URL state, so both survive. Only the
  search's URL round-trip is asserted (`content-library.spec.ts:233`).
- **EC-40 — Column choice surviving a reload.** `❌ NONE` It does **not** —
  session-only by design (`useEntryColumns/index.ts:113-118`).
- **EC-41 — Over-invalidation.** `⚠️ PARTIAL` `refreshEntryCaches` invalidates
  six prefixes plus the read-ones minus the primed id
  (`refreshEntryCaches/index.ts:46-74`) — scoped to the workspace and the type,
  never the whole cache. **But** it invalidates *every* other cached record of
  the type on every save (deliberate, for i18n sibling sync), and it invalidates
  **nothing** in the insights namespace, so the Insights tiles go stale after a
  publish (EC-42).
- **EC-42 — Insights staleness after a write.** `❌ NONE` See above; the
  `contentInsightsKeys` prefixes are absent from the refresh pass.
- **EC-43 — Create → navigate → save again.** `✅ E2E`
  `content-library.spec.ts:336` covers the stay-on-editor toast;
  `apps/admin-e2e/src/content/i18n.spec.ts:429,461` cover the
  "never PATCH the original after re-targeting" case that `editorKey` exists for.
- **EC-44 — `editorKey` changing mid-create.** `❌ NONE` The JSDoc warns the key
  must **not** change within one create session
  (`usePublishEntryFlow/index.ts:93-97`); a slot that adds a create-body param
  mid-flow would reset `createdId` and POST a second row.

**Failure & partiality**

- **EC-45 — `GET /api/content-schema` fails.** `✅ E2E`
  `content-library.spec.ts:162` — pane error + retry. The **sidebar** case is
  `❌ NONE` and broken (`🐞 BUG-content-admin-03`).
- **EC-46 — `GET /api/content/:name` fails.** `⚠️ PARTIAL` Distinct
  `role="alert"` error, never the empty state (`LoadedRecordsView/index.tsx:551-564`).
  The analogous relation-picker case is asserted
  (`RelationCandidateList/index.tsx:73-76`), the table's is not.
- **EC-47 — `GET …/filter-fields` fails.** `✅ E2E`
  `apps/admin-e2e/src/content/records-filter.spec.ts:307` — an error state, not
  an empty picker; `:328` asserts the table still loads.
- **EC-48 — `GET …/:id/relations` fails.** `❌ NONE` `relationRefs` is
  `undefined`, so the header count renders a neutral affordance and the
  required-relation gate rows are **skipped** rather than failing
  (`EntryEditor/index.tsx:409-413`) — fails *open* on the gate. Deliberate, but
  it means a required relation can be published as empty when its aggregate
  read is down; the server still refuses.
- **EC-49 — `GET …/:id/media` fails.** `❌ NONE` `mediaRefsPending` resolves to
  false so a contributed tab falls back rather than waiting
  (`EntryEditor/index.tsx:347-349`).
- **EC-50 — A presave step throws.** `❌ NONE` The save aborts, the busy cover
  lifts, nothing is written, and the step owns the error message
  (`ContentEntryView/index.tsx:456-466`).
- **EC-51 — A refetch inside `refreshEntryCaches` fails.** `❌ NONE` Swallowed on
  purpose (`refreshEntryCaches/index.ts:75-78`) so a landed write isn't reported
  as failed.
- **EC-52 — Network drop mid-save.** `❌ NONE` The cover lifts (`finally`), the
  form stays dirty, no toast fires from `onSave` (the rejection propagates to
  `submitWith`'s `.catch`, which calls `setServerErrors(entryIssuesFrom(error))`
  — for a non-422 that is an **empty issue list**, so the user sees the cover
  vanish and nothing else). Worth pinning.
- **EC-53 — `localStorage` blocked (private mode).** `❌ NONE` Favorites degrade
  to in-memory (`useContentFavorites/index.ts:29-31,60-62`).
- **EC-54 — Corrupt favorites JSON.** `❌ NONE` `readFavorites` returns `[]`, and
  the persist effect then **overwrites** the corrupt value with `[]`.

**Idempotency & replay**

- **EC-55 — Re-publish an already-published record.** `❌ NONE` The row menu
  shows Unpublish instead; the editor's Publish re-saves then publishes.
- **EC-56 — Restore a record already restored.** `❌ NONE` Server-idempotent.
- **EC-57 — Browser Back after a delete from the editor.** `❌ NONE` The editor
  route for the dead id remounts and shows its load-error card (edit mode with
  a 404), not a blank form.
- **EC-58 — Browser Back after a create.** `❌ NONE` `navigate` (not `replace`),
  so Back returns to `/new` — a blank form whose `createdId` has been forgotten
  by the `editorKey` effect (`usePublishEntryFlow/index.ts:114-116`) only if the
  key changed; on the same key it is retained, so a save would PATCH the record
  just created from a form the user believes is blank. Worth verifying.
- **EC-59 — Refresh mid-edit.** `❌ NONE` `useUnsavedChanges` arms the
  `beforeunload` guard.
- **EC-60 — Re-opening the relation picker after cancelling.** `✅ E2E` implied
  by `relations.spec.ts`; the reset is keyed on the open **transition**
  (`RelationPickerDialog/index.tsx:147-158`).

**UI-specific**

- **EC-61 — Loading vs error vs empty on the records table.** `⚠️ PARTIAL` Three
  genuinely distinct branches (`LoadedRecordsView/index.tsx:549-571`); only the
  empty branch is asserted (`content-library.spec.ts:217`).
- **EC-62 — Loading vs error vs empty on the sidebar.** `❌ NONE` **Only two**:
  error collapses into "render nothing" (`🐞 BUG-content-admin-03`).
- **EC-63 — `keepPreviousData` showing stale rows.** `⚠️ PARTIAL` Deliberate for
  typing; Apply and page changes raise `applying`/`paging` so the skeleton
  replaces the table (`:296-321`). Untested.
- **EC-64 — Focus after a dialog closes.** `❌ NONE` Radix restores to the
  trigger — except when the trigger was inside a `DropdownMenuContent` that has
  since unmounted, which is exactly the row-delete case
  (`♿ A11Y-content-admin-02`).
- **EC-65 — `prefers-reduced-motion`.** `⚠️ PARTIAL` The Filters chevron opts out
  explicitly (`LoadedRecordsView/index.tsx:488`); the query-builder panel's
  height animation and the busy overlay's blur are the design system's.
  `apps/admin-e2e/src/content/relation-cells.spec.ts:225` asserts the relation
  dropdown *does* animate — nothing asserts it stops under the media query.
- **EC-66 — i18n coverage for every branch.** `⚠️ PARTIAL` Every user-visible
  string goes through `defineMessages` **except**: `renderCell`'s boolean
  (`String(value)`, `renderCell.tsx:39`), its `select`/`multiselect` option
  values (raw), `RelationCandidateRow`'s status badge
  (`RelationCandidateRow/index.tsx:82`), the hard-coded `⌘K` chip
  (`ContentSidebar/index.tsx:122-124`), the `⚠` glyph
  (`RelationPickerDialog/index.tsx:397`), and `renderCell`'s hard-coded
  `currency: 'USD'` (`renderCell.tsx:71-75`).
- **EC-67 — A `richtext` value that is not a string.** `❌ NONE`
  `richTextExcerpt` returns `''` for a non-string (`:206`), so the cell shows the
  em-dash.
- **EC-68 — Two relation dropdowns open at once.** `✅ E2E`
  `relation-cells.spec.ts:166` — opening one closes the other.

### 4A. Accessibility & Section 508 Conformance

**Standards.** Revised Section 508 (36 CFR Part 1194, Appendices A–C)
incorporates WCAG 2.0 A + AA by reference — **E205.4** for electronic content
and **504.2** for authoring tools. This repo's `accessibility` skill targets
WCAG **2.1** AA, so every finding is stated at 2.1 AA with the 508 provision
cited alongside. Chapter 5 provisions assessed: **502.2/502.3** (AT
interoperability — name, role, state, value exposed *and kept current*),
**503.2** (platform preferences), **504** (authoring tools). WCAG 2.2 items
(2.4.11, 2.5.8) are advisory only.

**Automated coverage is not conformance.** This unit's a11y automation is
**eleven axe scans**, none of which touches the surfaces where its problems
live:

| Scan | File:line | What it covers |
| --- | --- | --- |
| Sidebar + welcome | `apps/admin-e2e/src/content/a11y.spec.ts:26` | the nav section, nothing selected |
| Records table | `a11y.spec.ts:32` | the loaded table with checkboxes |
| Column picker open | `a11y.spec.ts:45` | the popover |
| Search palette open | `a11y.spec.ts:56` | the ⌘K dialog |
| Relations tab | `apps/admin-e2e/src/content/relations.spec.ts:360` | the field sections |
| Relation picker open | `relations.spec.ts:370` | the dialog |
| Relation picker + filter | `relations.spec.ts:378` | the inline builder |
| Relation dropdown | `apps/admin-e2e/src/content/relation-cells.spec.ts:258` | one open cell popover |
| Read-only editor | `apps/admin-e2e/src/content/entry-read-only.spec.ts:238` | the preview form |
| Rich-text collapsed / expanded | `apps/admin-e2e/src/content/wysiwyg-fields.spec.ts:651,660` | the wysiwyg surfaces |
| Media tab + picker | `apps/admin-e2e/src/content/media-fields.spec.ts:355` | media-admin's tab |

No rule is disabled — `apps/admin-e2e/src/support/a11y.ts` asserts on the raw
violation list and `apps/admin-e2e/src/support/fixtures.ts:110-116` runs the
full `wcag2a/2aa/21a/21aa` tag set. That is good hygiene, but axe covers a
minority of the criteria and proves nothing about focus restoration,
announcement timing, or whether a name is *meaningful*. **Never scanned:** the
**writable** General tab with validation errors on screen, the publish gate, the
pagination footer, the trash view, the records **error** and **empty** states,
the query-builder panel on the records page, any `ConfirmDialog`
(delete/purge/shared-save), the `BulkPublishDialog`, the selection bar, the
History tab and the revision preview dialog, and the busy overlay. Four of the
ten findings below sit in states no scan reaches.

**508 Chapter 5 — 504 Authoring Tools.** This *is* the authoring path, so 504 is
where the real exposure is.

- **504.2 (produce conformant content).** **Partially Supports.** A `richtext`
  field goes through `wysiwyg-admin`, which stores semantic HTML — real headings,
  lists and a table with its header row are all asserted
  (`wysiwyg-fields.spec.ts:241,266`). Every other field type stores plain
  scalars, which carry no structure to get wrong.
- **504.2.1 (preserve accessibility information).** **Partially Supports.**
  Alt text survives a save/reload as part of the rich-text HTML, and a media
  asset's `alt` is carried into the body on insert
  (`wysiwyg-fields.spec.ts:608`). The **revision** path is weaker: a restore
  re-applies the stored snapshot, so alt survives, but the *diff* view renders
  media thumbnails with `alt=""` (`MediaRefList/index.tsx:80`) so a reviewer
  comparing two versions cannot tell that the alt text changed — an accessibility
  attribute the tool stores but never shows.
- **504.3 (prompt for accessibility information).** **Does Not Support for media
  fields; Supports for rich text.** Inserting an image *in the rich-text body*
  prompts for alt text with an explicit decorative option
  (`wysiwyg-fields.spec.ts:515,549`) — exemplary. Attaching an asset to a
  **`media` field** prompts for nothing: `media-fields.spec.ts:79-204` walks the
  whole attach/upload/reorder flow with no alt-text step, and this package's own
  `EntryFieldInput` has **no `media` case at all** (`EntryFieldInput/index.tsx:234-536`)
  — media fields are excluded from General (`EntryEditor/index.tsx:323-327`) and
  handed to a slot. See `♿ A11Y-content-admin-11`.
- **504.3 / data model — can the content model even store alt text?**
  **Partially Supports.** `MediaRef.alt?: string | null` exists
  (`domain/types/contentType/index.ts:144`), so alt lives on the **asset**, not
  on the usage. One image reused as a hero on one record and an inline figure on
  another carries **one** alt string for both, which is exactly the case where
  alt must differ. A `media` field's value is a bare id (or id list), with no
  per-usage `{ id, alt }` shape. There is **no `caption` field and no `lang`
  marker anywhere** in `ContentField` (`:68-121`) or `EntryRecord`. That is a
  schema-level *Does Not Support* and should be filed against
  `content/server` + `content/domain` too.
- **504.4 (templates/defaults).** **Not Applicable** — content types are defined
  in `content/server`; this package ships no starter content.

| Provision | Verdict | Basis |
| --- | --- | --- |
| 1.1.1 Non-text Content (A) / 508 E205.4 | **Supports** | Every decorative lucide icon carries `aria-hidden` (`CollectionRecordsTable/index.tsx:330,341`, `RowActions:205,220,235`, `PublishGate:334,340`, `MediaRefList:91`); the media thumbnail is `alt=""` beside its visible file name (`MediaRefList/index.tsx:80`) |
| 1.3.1 Info & Relationships (A) | **Partially Supports** | Real `<table>` + `<th scope="col">` + `aria-sort`; `Field`/`FieldLabel`/`FieldError` on every control. But ♿-03 (descriptions unassociated), ♿-07 (gate state not in text), and the h1→h3 jump below |
| 1.3.2 Meaningful Sequence (A) | **Supports** | DOM order matches visual order; no positive `tabindex` in the package |
| 1.3.5 Identify Input Purpose (AA) | **Not Applicable** | No field collects information about the *user* |
| 1.4.1 Use of Color (A) | **Does Not Support** | ♿-07 — a passing publish-gate row is a green `aria-hidden` check and nothing else |
| 1.4.3 / 1.4.11 Contrast (AA) | **Not verified** | axe enforces `color-contrast` on the eleven scanned states only, and no suite runs the **dark** theme separately. Unverified: the `ChangedBadge` `warning-soft` pill (`ChangedBadge/index.tsx:69`), `ReadOnlyNotice`'s `info-soft` (`ReadOnlyNotice/index.tsx:173`), the `text-muted-foreground/50` sort glyph (`CollectionRecordsTable/index.tsx:341`), and the destructive gate messages |
| 1.4.4 Resize Text (AA) | **Not verified** | No zoom test exists |
| 1.4.10 Reflow (AA) | **Not verified** | The records card is `overflow-hidden` around a full-width `<table>` (`CollectionRecordsTable/index.tsx:276`) with no `overflow-x:auto` — at 320 px a wide table is **clipped, not scrollable**. Untested and a likely failure |
| 1.4.12 Text Spacing (AA) | **Not verified** | `truncate` / `max-w-[28ch]` on every text cell (`renderCell.tsx:109,115`) is the risk |
| 1.4.13 Content on Hover or Focus (AA) | **Partially Supports** | `LocalizedFieldMark` is a proper Radix tooltip on hover *and* focus. But three native `title` tooltips are not dismissible, hoverable, or focus-reachable: `RequiredMark` (`:24`), `EntryStatusBadge`'s "Modified" hint (`:132-136`), and the picker's `⚠` (`RelationPickerDialog/index.tsx:396`) — ♿-10 |
| 2.1.1 Keyboard (A) | **Partially Supports** | Every action has a keyboard route (the table row is not focusable, but the title link and the ⋯ menu are). ♿-01 makes several of them indistinguishable |
| 2.1.2 No Keyboard Trap (A) | **Supports** | Every overlay is Radix `Dialog`/`Popover`/`DropdownMenu`; Esc closes each; the row menu is `modal={false}` deliberately |
| 2.2.1 Timing Adjustable (A) | **Not Applicable** | No timed content; the 300 ms search debounce is not a time limit on input |
| 2.4.1 Bypass Blocks (A) | **Not Applicable here** | The skip link belongs to `shell/admin`'s `AppShell` |
| 2.4.2 Page Titled (AA→A) | **Does Not Support** | `document.title` is the static "Admin" (`apps/admin/index.html:5`); nothing in this package updates it per route, so every content route is titled identically. Owned jointly with `bootstrap-admin` |
| 2.4.3 Focus Order (A) | **Does Not Support** | ♿-02 (focus lost after delete), ♿-06 (no focus move to the first invalid field), ♿-08 (tab change moves no focus) |
| 2.4.6 Headings and Labels (AA) | **Partially Supports** | One `<h1>` per editor route; the sidebar `<h2>`. But the editor's main column jumps **h1 → h3** (`FieldGroup/index.tsx:272`) — the intervening `<h2>` is "Properties" in the shell's *right panel*, a different region, so `AGENTS.md`'s claimed h1→h2→h3 does not hold in reading order. Plus ♿-01 |
| 2.4.7 Focus Visible (AA) | **Supports** | `focus-visible:ring-*` on every hand-rolled control (`CollectionRecordsTable/index.tsx:319`, `ContentSidebar/index.tsx:116`, `LocalizedFieldMark/index.tsx:42`, `RelationCandidateRow/index.tsx:48` via `has-[:focus-visible]`) |
| 3.1.1 Language of Page (A) | **Not Applicable here** | `<html lang>` is `bootstrap-admin`'s |
| 3.1.2 Language of Parts (AA) | **Does Not Support** | No content field can carry a `lang` marker, so a German record in an English admin (or a German excerpt inside an English record) is announced in the wrong voice. Schema-level — file against `content/domain` too |
| 3.2.1 On Focus (A) | **Supports** | Nothing changes context on focus |
| 3.2.2 On Input (A) | **Does Not Support** | Enter in any text field **publishes** a publishable record (`EntryEditor/index.tsx:635-638`) — a change of context far beyond what entering data implies. Cross-ref `🐞 BUG-content-admin-04` |
| 3.3.1 Error Identification (A) | **Partially Supports** | Errors are text, `FieldError` is `role="alert"`, `aria-invalid` is set. But the toast is the only cue that a *submit* was refused, and it does not move focus (♿-06) |
| 3.3.2 Labels or Instructions (AA→A) | **Partially Supports** | Every control has a programmatic label. Field **descriptions** are visible but unassociated (♿-03) |
| 3.3.3 Error Suggestion (AA) | **Supports** | Kernel messages are specific and parameterised ("Must be at least {min} characters"); the blocked-submit toast names the first offending field |
| 3.3.4 Error Prevention (AA) | **Partially Supports** | Delete, purge, restore-a-version, publish-a-version and the shared-field save all confirm; the unsaved-changes guard covers navigation. **Publish itself never confirms**, and Enter triggers it (♿ / `🐞 BUG-content-admin-04`) |
| 4.1.2 Name, Role, Value (A) / 508 502.2 | **Partially Supports** | ♿-01, ♿-07, ♿-10 |
| 4.1.3 Status Messages (AA) / 508 502.3 | **Partially Supports** | The records list is exemplary — two persistently-mounted `role="status"` regions for the result count and the selection count (`LoadedRecordsView/index.tsx:531-547`). Everything else is silent: ♿-04, ♿-05, ♿-08, ♿-09 |
| 508 503.2 Platform preferences | **Partially Supports** | One explicit `motion-reduce:` opt-out (`LoadedRecordsView/index.tsx:488`); **forced-colors / Windows High Contrast is unhandled** — the selected-row tint (`data-state="selected"`), the relation-card destructive border, the `ChangedBadge` pill and the gate's colour-only pass state all lose their meaning |
| 508 503.4 Captions / audio controls | **Not Applicable** | This package renders no media playback |

#### ♿ A11Y-content-admin-01 — Every row's actions menu has the same accessible name

- **WCAG:** `4.1.2 Name, Role, Value (A)`, `2.4.6 Headings and Labels (AA)` · **508:** `E205.4 / 502.2` · **Verdict:** **Does Not Support**
- **Location:** `packages/content/admin/src/lib/presentation/components/CollectionRecordsView/CollectionRecordsTable/CollectionRecordsRowActions/index.tsx:34-38,203`
  — `aria-label={intl.formatMessage(messages.open)}` where `open` is the static
  string `'Actions for this record'`.
- **Repro:** 1) `/workspaces/W/content/blog_post` with 10 rows. 2) Ask a screen
  reader to list buttons (VoiceOver rotor / NVDA `Insert+F7`).
- **Keyboard-only:** unaffected — Tab order still walks the rows.
  **Screen reader:** ten identical "Actions for this record" buttons with nothing
  distinguishing them. A user who navigates by control list cannot tell which
  record they are about to delete. The **sibling checkbox in the same file gets
  this right** — `rowLabel()` (`CollectionRecordsTable/index.tsx:63-73`, the parent table
  component — **not** this file, as an earlier draft of this artifact said)
  builds "Select {title}", so the fix is already written one component up.
- **Remediation:** interpolate the same `rowLabel(record, columns)` into the
  trigger's label, e.g. "Actions for {title}". (The component would need the
  columns, or the parent can pass the label it already computes.)

#### ♿ A11Y-content-admin-02 — Focus is lost after deleting a record from the row menu

- **WCAG:** `2.4.3 Focus Order (A)` · **508:** `E205.4 / 502.3` · **Verdict:** **Does Not Support**
- **Location:** `CollectionRecordsRowActions/index.tsx:324-341` — the
  `ConfirmDialog` is fully controlled (`open`/`onOpenChange`) with **no
  `DialogTrigger`**, and the element focused before it opened was a
  `DropdownMenuItem` inside a `DropdownMenuContent` that unmounts when the menu
  closes.
- **Repro:** 1) Tab to a row's ⋯ button, Enter. 2) Arrow to "Delete", Enter.
  3) The confirm dialog opens; press Enter on "Delete". 4) Press Tab.
- **Keyboard-only:** Radix tries to restore focus to a node that no longer
  exists, and the row it belonged to has just been removed by the refetch — so
  focus falls to `<body>` and the next Tab restarts from the top of the document,
  above the app sidebar. **Screen reader:** the "Moved to trash" toast is
  announced, then the user is silently at the top of the page with no idea where
  the table went. The same applies to the purge dialog (`:343-355`).
- **Remediation:** after a successful delete, move focus deliberately — to the
  next row's ⋯ trigger, or to the table's `aria-label`ed container with
  `tabIndex={-1}`.

#### ♿ A11Y-content-admin-03 — A field's description is visible but never announced

- **WCAG:** `1.3.1 Info and Relationships (A)`, `3.3.2 Labels or Instructions (A)` · **508:** `E205.4 / 502.2` · **Verdict:** **Partially Supports**
- **Location:** `packages/content/admin/src/lib/presentation/components/EntryFieldInput/index.tsx:180-184`
  — `const describedBy = error ? errorId : undefined;` (`:183`). The
  `<FieldDescription>` rendered at `:227,269,315,357,395,495` is given **no id**
  and is never referenced.
- **Repro:** 1) Open an entry whose schema sets `admin.description` on a field
  (or any `json` field, which gets the built-in "Raw JSON." hint). 2) Tab into
  the control with a screen reader running.
- **Keyboard-only:** the hint is on screen, so a sighted keyboard user is fine.
  **Screen reader:** the control announces its label, its required state, and
  nothing else — the author-supplied instruction is skipped entirely. Worse, the
  code **suppresses** the description whenever an error is showing (`:183`), so
  the two can never both be announced. The slot contract advertises `describedBy`
  to contributed controls (`slots/contentSlots/index.ts:477-483`) as "the id of
  the rendered `<FieldError>`" — so contributions inherit the same gap.
- **Remediation:** give the description an id (`${id}-description`) and join it
  with the error id in `aria-describedby`, keeping both rather than swapping.

#### ♿ A11Y-content-admin-04 — Sorting and paging change the table silently

- **WCAG:** `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3` · **Verdict:** **Does Not Support**
- **Location:** `packages/content/admin/src/lib/presentation/components/CollectionRecordsView/LoadedRecordsView/index.tsx:531-537`
  — the live region's only non-loading content is
  `intl.formatMessage(messages.results, { count: total })`, i.e. the **total**,
  which does not change when the sort or the page changes.
- **Repro:** 1) Open a collection with 3 pages. 2) Press the Next-page button.
  3) Press a column header.
- **Keyboard-only:** focus stays on the button pressed — until the last page,
  where Next becomes `disabled` (`CollectionRecordsPagination/index.tsx:128`) and
  focus is dropped to `<body>`. **Screen reader:** the region text is identical
  before and after, so nothing is announced for either action. `aria-sort` is
  correct but is only discovered by re-reading the header. A user cannot tell
  whether a sort click did anything.
- **Remediation:** extend the live region to restate the current view — "Page 2
  of 3, showing 11–20 of 21" / "Sorted by Title, ascending" — and on reaching the
  last page move focus to the Previous button (or keep Next focusable and
  `aria-disabled`).

#### ♿ A11Y-content-admin-05 — The ⌘K palette never announces its result count

- **WCAG:** `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3` · **Verdict:** **Partially Supports**
- **Location:** `packages/content/admin/src/lib/presentation/components/ContentSearchDialog/index.tsx:102-140`
  — `CommandInput` + `CommandList` with no result-count region; the only textual
  feedback is `CommandEmpty` when *zero* rows match.
- **Repro:** 1) Press ⌘K. 2) Type `b`, then `bl`, then `blo`.
- **Keyboard-only:** fine — ↑/↓ walk whatever remains.
  **Screen reader:** cmdk moves `aria-activedescendant` as the user arrows, so
  the *focused* option is announced, but nothing says how many options there
  now are. Typing a character that drops the list from 12 rows to 1 is
  indistinguishable from typing one that changes nothing, short of arrowing
  through the whole list. The zero case *is* announced, via `CommandEmpty`.
- **Remediation:** add an `sr-only` `role="status"` restating "{n} content types
  match" on each keystroke.

#### ♿ A11Y-content-admin-06 — A refused submit never moves focus to the offending field

- **WCAG:** `3.3.1 Error Identification (A)`, `2.4.3 Focus Order (A)` · **508:** `E205.4 / 502.3` · **Verdict:** **Partially Supports**
- **Location:** `packages/content/admin/src/lib/presentation/components/ContentEntryView/EntryEditor/index.tsx:479-515`
  — `announceBlocked` fires a toast and calls `onTabChange(...)`, but nothing
  calls `.focus()` on any control; `useEntryForm.submit` only flips `submitted`
  (`hooks/useEntryForm/index.ts:152-160`).
- **Repro:** 1) `/workspaces/W/content/product/new`. 2) Tab to the Publish
  button in the top bar. 3) Press Enter.
- **Keyboard-only:** focus stays on the Publish button. To reach the first
  invalid field the user must Shift+Tab back out of the top bar, through the
  breadcrumb and the back link, into the form — and the *tab* may have changed
  underneath them (`:486-490`), which is itself an unannounced context change.
  **Screen reader:** the toast is announced ("Can't publish — 2 fields need
  attention. Start with "Name"."), which is genuinely good copy — but "start
  with Name" is an instruction the user must then execute by hand. This is one
  of the better implementations in the repo (`content-library.spec.ts:709`
  pins the toast); it is one `.focus()` short of conformance.
- **Remediation:** after revealing errors, move focus to the first invalid
  control (`document.getElementById('entry-field-' + firstName)?.focus()`),
  after the tab switch has committed.

#### ♿ A11Y-content-admin-07 — The publish gate encodes pass/fail in colour and an aria-hidden icon

- **WCAG:** `1.4.1 Use of Color (A)`, `1.3.1 Info and Relationships (A)` · **508:** `E205.4 / 502.2` · **Verdict:** **Does Not Support**
- **Location:** `packages/content/admin/src/lib/presentation/components/ContentEntryView/EntryEditor/EntrySidebar/PublishGate/index.tsx:110-139`
  — a passing row renders `<Check aria-hidden>` + the label and **nothing else**;
  a failing row renders `<X aria-hidden>` + the label + the message. The
  section's header badge is the words "blocking"/"ready", but per-row state has
  no text equivalent.
- **Repro:** 1) Open `/product/new`. 2) Fill `name`, leave `price` empty.
  3) Read the "Publish gate" section in the Properties panel.
- **Keyboard-only:** the rail is not focusable (it is a `<ul>` of text), so a
  keyboard user reads it visually — colour and glyph are legible.
  **Screen reader:** the list reads "Name", "Price Required" — the passing row is
  a bare field label with no indication it is a *check that passes*, and a user
  could reasonably read it as another outstanding item. Under Windows High
  Contrast the green/red distinction is lost for sighted users too.
- **Remediation:** give each row an `sr-only` state word ("passes" / "needs
  attention") or make the icon meaningful with `role="img"` + an `aria-label`,
  and use `<ul role="list">` with the state as the first thing announced.

#### ♿ A11Y-content-admin-08 — Switching editor tab is a route change that moves no focus and announces nothing

- **WCAG:** `2.4.3 Focus Order (A)`, `4.1.3 Status Messages (AA)` · **508:** `E205.4 / 502.3` · **Verdict:** **Partially Supports**
- **Location:** `packages/content/admin/src/lib/presentation/components/ContentEntryView/index.tsx:242-257`
  (`onTabChange` → `navigate(...)`), rendered by
  `EntryEditor/index.tsx:732-939`.
- **Repro:** 1) Open a record. 2) Arrow from "General" to "Relations" in the tab
  strip. 3) Note the URL changes and the panel body swaps.
- **Keyboard-only:** Radix's roving tabindex keeps focus on the trigger and the
  next Tab lands in the panel, so the *manual* path is fine. The broken path is
  the **programmatic** one: `announceBlocked` (♿-06) switches tab on the user's
  behalf, and the "Publish all locales" and locale-switch slot flows navigate to
  another record entirely, appending `tabSegment`. In all three the destination
  panel is loaded with focus left wherever it was.
  **Screen reader:** a tab change here is also a URL change — an SPA route
  transition — with no announcement of the new view. The `EntryBusyOverlay` that
  covers a save is likewise silent: `<Spinner aria-hidden>` inside a visual
  cover (`ContentEntryView/index.tsx:379`, and the `Spinner` primitive's own
  `role="status"` is cancelled by the `aria-hidden` the call site adds).
- **Remediation:** post a `role="status"` on tab/record transitions, and on a
  programmatic tab switch move focus into the destination panel.

#### ♿ A11Y-content-admin-09 — The sidebar advertises a keyboard shortcut it hard-codes as macOS

- **WCAG:** `1.3.1 Info and Relationships (A)` · **508:** `E205.4` · **Verdict:** **Partially Supports**
- **Location:** `packages/content/admin/src/lib/presentation/components/ContentSidebar/index.tsx:122-124`
  — a literal `⌘K` inside a `<kbd>` with no `aria-label` and no platform check,
  while the handler accepts `metaKey || ctrlKey`
  (`ContentNavSection/index.tsx:38-42`).
- **Repro:** 1) On Windows/Linux, read the sidebar's search button.
- **Keyboard-only:** Ctrl+K works, but the UI never says so — a keyboard-first
  user on the majority platform is told the wrong key.
  **Screen reader:** the button's accessible name becomes "Search… ⌘K", and the
  `⌘` glyph is announced as "place of interest sign" or "command" depending on
  the engine. It is also untranslated in every locale.
- **Remediation:** derive the modifier glyph from the platform and give the
  `<kbd>` an `aria-label` (or `aria-hidden` it and put the shortcut in the
  button's `aria-keyshortcuts`).

#### ♿ A11Y-content-admin-10 — Three states are delivered only through a native `title` tooltip

- **WCAG:** `1.4.13 Content on Hover or Focus (AA)`, `4.1.2 Name, Role, Value (A)` · **508:** `E205.4 / 502.2` · **Verdict:** **Does Not Support**
- **Location:** three sites —
  `RelationPickerDialog/index.tsx:404-413` (a bare `<span title="Selected the
  first N of M…">⚠</span>`, not focusable, no role, no accessible name beyond the
  emoji), `EntryStatusBadge/index.tsx:57-63` (the "Modified" explanation), and
  `EntryFieldInput/RequiredMark/index.tsx:22-28` (the `*` legend, which is
  additionally `aria-hidden` so the title is unreachable by any route).
- **Repro:** 1) In a many-relation picker, tick "Select all" on a target with
  more pages than the ceiling. 2) Try to read why only some were selected without
  a mouse.
- **Keyboard-only:** none of the three is focusable, so the information is
  **mouse-only**. **Screen reader:** the `⚠` is announced as "warning sign" with
  no explanation; the Modified badge announces only "Modified", losing the one
  sentence that disambiguates the repo's most confusing status. Native `title`
  is also not dismissible or hoverable, which 1.4.13 requires.
- **Remediation:** use the design-system `Tooltip` (as `LocalizedFieldMark`
  already does) on a real focusable trigger, or render the text inline/`sr-only`.
  The capped-selection case is a status change and belongs in a live region.

#### ♿ A11Y-content-admin-11 — Attaching an asset to a media field prompts for no alt text

- **WCAG:** `1.1.1 Non-text Content (A)` (of the *published* output) · **508:** `504.3 Authoring Tools`, `504.2.1` · **Verdict:** **Does Not Support**
- **Location:** the gap is structural: `EntryFieldInput/index.tsx:234-536` has no
  `CONTENT_FIELD_TYPE.Media` case, `EntryEditor/index.tsx:323-327` excludes media
  fields from the General tab, and the field's value is a bare asset id with
  nowhere to put per-usage alt (`domain/types/contentType/index.ts:111-120,144`).
  The tab that does render them (`media-admin` via `ENTRY_TAB_SLOT`) walks
  attach / upload / reorder with no alt step —
  `apps/admin-e2e/src/content/media-fields.spec.ts:79,131,173`.
- **Repro:** 1) Open a record with a `media` field. 2) Attach an image from the
  library or upload one. 3) Save. 4) Look for anywhere to describe the image.
- **Keyboard-only / screen reader:** the *author* is not blocked — the harm lands
  on the **reader of the published site**, which is precisely what 504.3 exists
  to prevent. Contrast the rich-text path, which prompts for alt with a
  decorative option and is pinned by two specs
  (`wysiwyg-fields.spec.ts:515,549`) — the tool already knows how to do this and
  does not do it here.
- **Remediation:** two parts, and the schema one is the real fix: (a) prompt for
  alt (with an explicit "decorative" answer) when an asset is attached to a
  media field, and (b) change a media field's stored value from `id` to
  `{ id, alt }` so alt is per-usage rather than per-asset. File (b) against
  `content/domain` + `content/server` as well.

## 5. E2E Coverage Map

All admin suites; `apps/server-e2e` has nothing for this unit (it is UI-only).

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 sidebar | `apps/admin-e2e/src/content/content-library.spec.ts:30` | the "Workspace Content" section renders with its groups | ✅ E2E |
| F2 groups | `content-library.spec.ts:49` | Collections open by default, Pages toggles | ✅ E2E |
| F3 favorites | `content-library.spec.ts:105` | pinning adds a Favorites section | ⚠️ PARTIAL — no reload/persistence assertion, no per-workspace isolation |
| F4 no grants | `content-library.spec.ts:151` | the **pane** empty state | ⚠️ PARTIAL — the sidebar's `return null` is not asserted |
| F5 ⌘K | `content-library.spec.ts:138` | Ctrl/⌘+K opens, Escape closes | ✅ E2E |
| F6 search button | `content-library.spec.ts:122` | opens the palette and navigates | ✅ E2E |
| F7 palette | `content-library.spec.ts:122` | selecting a type routes to it | ⚠️ PARTIAL — no filtering, no group badges, no empty state |
| F10 library error | `content-library.spec.ts:162` | error title after 3 retries, then recovery via Retry | ✅ E2E |
| F11 empty | `content-library.spec.ts:151` | the empty state | ✅ E2E |
| F12 grant scoping | `content-library.spec.ts:87` | only granted types listed | ✅ E2E |
| F16 table | `content-library.spec.ts:182` | the records table renders for a selected collection | ✅ E2E |
| F17 sort | `content-library.spec.ts:418` | all three sort states: URL, `aria-sort`, **and** the rendered row order | ✅ E2E — the strongest assertion in the suite |
| F18 relation cells | `apps/admin-e2e/src/content/relation-cells.spec.ts:84,105,135,151,166,193` | title + `+N` not an id; dropdown of links; loads past the preview; no row navigation; one open at a time; em-dash when empty | ✅ E2E |
| F21 row navigation | `content-library.spec.ts:309` | Add record → `/new`, row click → `/:id` | ✅ E2E |
| F23 selection | `content-library.spec.ts:463` | select one, select-all, clear; the bar's presence/absence | ⚠️ PARTIAL — no cross-page selection, no indeterminate assertion |
| F24 bulk | `apps/admin-e2e/src/content/i18n.spec.ts:534,560,589` | the dry-run dialog and the partial-success shape — but only through i18n's **reuse** of it | ⚠️ PARTIAL — the records **selection bar** never drives a bulk action in any spec |
| F25 row actions | `content-library.spec.ts:497` | Edit / Publish-or-Unpublish / Copy ID present; opening does not navigate | ⚠️ PARTIAL — never *runs* an action; no Delete, no confirm dialog, no post-delete state |
| F27 search | `content-library.spec.ts:217` | no-match empty state + `?q=` in the URL | ✅ E2E |
| F28/F29 filter panel | `apps/admin-e2e/src/content/records-filter.spec.ts:69,95,119,146,181,207,257,270,282` | relation-path rules, wildcard escaping, negative operators, the chip summary and chip removal | ✅ E2E — thorough |
| F30 filter fields | `records-filter.spec.ts:44,307,328` | grouped related-type fields; an error state instead of an empty picker; the table still loads | ✅ E2E |
| F32 column picker | `content-library.spec.ts:236,258,293,360` | toggle, search, search-empty, **keyboard reorder** | ✅ E2E |
| F33 relation preview scoping | — | — | ❌ NONE — no spec asserts that hiding a relation column drops `relationFields` |
| F34 pagination | — | `apps/admin-e2e/src/support/pages/ContentLibraryPage.ts:502-504` defines a `nextPage` accessor that **no spec uses** | ❌ NONE |
| F35 page clamp | — | — | ❌ NONE — the highest-value untested behaviour in the unit |
| F36 three list states | `content-library.spec.ts:217` (empty only) | — | ⚠️ PARTIAL — neither the skeleton nor the `role="alert"` list error is asserted |
| F39 schema error | `content-library.spec.ts:162` | covers the library-level schema list, not `useContentSchema(:name)` | ⚠️ PARTIAL |
| F40 editor modes | `content-library.spec.ts:71,309,336` | single opens its editor; create and edit route correctly | ✅ E2E |
| F41 controls | `content-library.spec.ts:571,662,688` | datetime renders a UTC instant in local time; a numeric field sends a **number**; a cleared numeric sends nothing | ⚠️ PARTIAL — boolean, select, multiselect and json controls are never exercised |
| F42 required | `content-library.spec.ts:527` | the label carries `*` **and** the control `aria-required="true"`, and an optional field carries neither | ✅ E2E |
| F43 localized mark | `apps/admin-e2e/src/content/i18n.spec.ts:127` | the tooltip opens on hover **and on focus** | ✅ E2E |
| F44 changed badge | `apps/admin-e2e/src/content/relations.spec.ts:282` | on a relation section with staged edits | ⚠️ PARTIAL — never on a scalar field |
| F45 error wiring | — | — | ❌ NONE — no spec asserts `aria-describedby`, `aria-invalid`, or that an inline error appears at all |
| F46/F48 blocked submit | `content-library.spec.ts:709` | the toast, its count, the named field, **and** that no request is sent | ✅ E2E |
| F47 server 422 | — | — | ❌ NONE |
| F49/F50 publish gate | — | — | ❌ NONE — the rail's gate is never asserted, blocking or ready |
| F51 tabs-as-routes | `content-library.spec.ts:596,616,635` | the URL gains the tab, General stays canonical, a tab URL opens directly, a single carries its tab on the type path | ✅ E2E |
| F52 ⋯ menu | `i18n.spec.ts:513` | the menu's **grouping** of built-ins vs contributions | ⚠️ PARTIAL — via the i18n suite; the built-ins' own behaviour is untested |
| F54 status labels | `apps/admin-e2e/src/content/entry-revisions.spec.ts:38` | a draft save keeps the published version live | ⚠️ PARTIAL — the four-label mapping is never asserted directly |
| F55 save | `content-library.spec.ts:336` | stays on the editor + success toast | ✅ E2E |
| F56 publish flow | `i18n.spec.ts:429,461` | a re-targeted new record creates a **sibling**, never a PATCH on the original | ⚠️ PARTIAL — the create→publish chain's single-refresh behaviour is not asserted |
| F58 shared-save confirm | — | — | ❌ NONE |
| F59 unsaved guard | — | — | ❌ NONE |
| F60 read-only | `entry-read-only.spec.ts:85,94,119,132,154,188,213,231` **and the control case at `:254`** | banner + no save action; text fields `readOnly`; typing refused; popover controls `disabled`; rich text view-only; media without attach/upload; a form submit never saves; axe clean — plus the same editor fully live for a writer | ✅ E2E — the model suite in this package |
| F61 relation sections | `relations.spec.ts:44,213,237` | titled cards; editing an inverse relation from the other side; ungranted targets hidden | ✅ E2E |
| F62 picker | `relations.spec.ts:58,81,115,134,162,178,201,296,314` | single + many assignment, reorder via arrow, open-in-new-tab, search, lazy scroll, inline filter, remove, select-all-then-clear | ✅ E2E — thorough |
| F64 relation deltas | `relations.spec.ts:253` | staged links save as a `relations` delta and are **omitted from `values`** | ✅ E2E |
| F66 revisions | `entry-revisions.spec.ts:38,89` | a draft save keeps the published version live; publishing a version from History makes it live | ⚠️ PARTIAL — no restore, no preview/diff, no 422 path |
| F67 diff refs | — | — | ❌ NONE |
| F68 expanded view | `apps/admin-e2e/src/content/wysiwyg-fields.spec.ts:136,153,183` | takes over the work area with the caret in the text; the chrome stays live; both exits return | ✅ E2E |
| F69 submit seam | `wysiwyg-fields.spec.ts:578` | an overlay's own form never saves the record | ✅ E2E |
| F70 Enter-submits | — | — | ❌ NONE — nothing asserts what Enter in a text field does |
| F71 slots | `i18n.spec.ts` (8 slots), `media-fields.spec.ts` (2), `wysiwyg-fields.spec.ts` (1) | each contributor's own behaviour | ⚠️ PARTIAL — the **contract** is untested: ordering, a `null` from `useItem`, an unknown tab slug, a bad menu group, a throwing contribution, and behaviour with i18n/media/wysiwyg **absent** |
| F73 insights | — | `apps/admin-e2e/src/insights/*` covers the page frame | ❌ NONE for the content widgets themselves |
| F74 command entries | — | — | ❌ NONE |
| F75 overlay slot | `i18n.spec.ts:187` | the locale-switch cover plays and survives the transition | ✅ E2E |
| a11y | `content/a11y.spec.ts:26,32,45,56` + 7 more scans listed in §4A | axe, WCAG 2.1 A/AA, no rules disabled | ⚠️ PARTIAL — see §4A for the eleven unscanned states |

**Coverage tally:** `75 features · 33 ✅ · 24 ⚠️ · 18 ❌`

## 6. 🐞 Potential Bugs

### 🐞 BUG-content-admin-01 — A required field the editor doesn't render is an unfillable, permanent block on save · Severity: High

**Location:** `packages/content/admin/src/lib/presentation/components/ContentEntryView/EntryEditor/index.tsx:279-332,378-387,479-500`
**Category:** ux-state / data-loss (the record can never be saved)

**What the code does:** three field sets are derived from the schema, and they
disagree about which fields exist.

```ts
const visible = schema.fields.filter((field) => !isHidden(field));
const generalFields = visible.filter(
    (field) =>
        field.type !== CONTENT_FIELD_TYPE.Relation &&
        field.type !== CONTENT_FIELD_TYPE.Media
);
```

`validationIgnored` (`:311-314`) contains only ungranted relations and
link-managed relations. So `useEntryForm` — and therefore `form.submit()` —
validates **every** field in `schema.fields`, including (a) fields marked
`admin.hidden`, which `visible` drops, and (b) `media` fields, which
`generalFields` drops and which render only if `@ortha-cms/media-admin` has
contributed an `ENTRY_TAB_SLOT` item. `fieldGate` (`:379-386`) filters on
`visible`, so a hidden required field never even appears in the publish gate.

**Why it is wrong:** the file already recognises this exact failure mode for
ungranted relations and fixes it — "otherwise a *required* one is an
un-satisfiable, invisible block that pins the form shut with no way to fill it"
(`:273-278`) — and again for link-managed relations (`:291-296`). Hidden fields
and media fields fall into the same hole and get no such treatment. `AGENTS.md`
states the editor's contract as "every editable field", and `renderCell`'s
sibling `isHidden` usage shows hidden fields are meant to be inert, not
validated.

**Repro (hidden field):**
1. Give a content type a field with `required: true` and `admin: { hidden: true }`.
2. Open `/workspaces/W/content/<type>/new` and fill everything on screen.
3. Press Save (or Publish).
→ Observed: a toast "Can't save — 1 field needs attention. Start with "<Hidden
Field>"", the tab switches to General, and no control for that field exists
anywhere. The record can never be created from the admin.
Expected: hidden fields are excluded from client validation, exactly like
ungranted relations.

**Repro (media field, no media plugin)** — note the shipped host **does** register
`MediaPlugin()` (`apps/admin/src/main.tsx:36`), so this half needs a host change and
is not reachable in the default configuration; the hidden-field half above needs no
such change and is what carries the High severity:
1. Run the admin **without** `MediaPlugin()` in `apps/admin/src/main.tsx`.
2. Open a type with a required `media` field and press Save.
→ Observed: `announceBlocked` calls `onTabChange(ENTRY_TAB.Media)` (`:488-489`).
`'media'` is a valid `ENTRY_TAB_SLUGS` member and a real route
(`ContentLibraryPage/index.tsx:169-175`), so the URL becomes `…/media` and
`<Tabs value="media">` renders with **no matching trigger and no matching
content** — a blank body under an unselected tab strip.

**Blast radius:** any deployment whose content types use `admin.hidden` on a
required field, and any deployment that omits `media/admin` while a type
declares a required media field. In both cases the record is uncreatable and
un-editable from the admin, with a message pointing at something that isn't
there. Data is not corrupted, but authoring stops.

**Suggested fix:** add hidden fields and (when no `ENTRY_TAB_SLOT` item claims
them) media fields to `validationIgnored`, and clamp `announceBlocked`'s tab
target to a tab that actually exists.

### 🐞 BUG-content-admin-02 — `ENTRY_TAB_SLOT` accepts a slug the router doesn't, and the router accepts a slug no tab renders · Severity: Medium

**Location:** `packages/content/admin/src/lib/domain/constants/index.ts:70-78`,
`packages/content/admin/src/lib/presentation/slots/contentSlots/index.ts:326-339`,
`packages/content/admin/src/lib/presentation/pages/ContentLibraryPage/index.tsx:169-175`
**Category:** correctness (slot contract)

**What the code does:** `ENTRY_TAB` hard-codes four slugs, one of which
(`media`) exists *only* for a plugin that may not be installed:

```ts
export const ENTRY_TAB = {
    General: 'general', Relations: 'relations',
    Media: 'media', History: 'history'
} as const;
export const ENTRY_TAB_SLUGS = Object.values(ENTRY_TAB);
```

The route table maps **every** slug to a route; `entryTabFromPath` accepts every
slug (`domain/entryTab/index.ts:18-20`); but `EntryEditor` only renders a
`TabsTrigger`/`TabsContent` pair for a slug some registered `ENTRY_TAB_SLOT`
item supplies (`EntryEditor/index.tsx:751-760,919-930`). The slot's `slug` is
typed `string` with the constraint expressed only in a doc comment ("MUST be a
known editor tab slug").

**Why it is wrong:** the two halves of the contract are enforced in different
places and neither validates the other. `AGENTS.md` states the rule ("the `slug`
must be a known `ENTRY_TAB_SLUGS` member so the tab router/`entryTabFromPath`
accept it") but nothing checks it, and the reverse direction — a known slug with
no contributor — silently renders an empty editor body.

**Repro:**
1. Register an `ENTRY_TAB_SLOT` item with `slug: 'seo'`.
2. Its trigger renders; click it.
→ Observed: `onTabChange('seo')` navigates to `…/:id/seo`, which matches
`:typeName/:entryId/:tab`, but `entryTabFromPath` doesn't recognise `seo` and
returns `'general'` — so the URL says `seo` and the editor shows General. The tab
is unusable and undeep-linkable, with no error.
3. Now remove the media plugin and open `…/:id/media` directly.
→ Observed: the editor renders with `tab='media'`, no trigger selected, and an
empty panel.

**Blast radius:** plugin authors adding an editor tab; and any deployment that
drops `media/admin`. Silent in both directions.

**Suggested fix:** derive `ENTRY_TAB_SLUGS` (and the route table) from the
built-ins **plus** the registered slot items at boot, and fall back to the
default tab when the resolved tab has no rendered panel.

### 🐞 BUG-content-admin-03 — A failed content-type fetch makes the whole Content sidebar disappear silently · Severity: Medium 🔒

**Location:** `packages/content/admin/src/lib/presentation/components/ContentNavSection/index.tsx:29,50-63`
**Category:** ux-state (BUGBOT: "Error masquerading as empty")

**What the code does:**

```ts
const { data: types, isPending } = useContentTypes(canRead && Boolean(workspaceId));
...
if (!workspaceId || !canRead || !workspace || isPending) return null;
const granted = new Set(workspace.content);
const scopedTypes = (types ?? []).filter((type) => granted.has(type.name));
if (scopedTypes.length === 0) return null;
```

`isError` is never destructured. On a failed `GET /api/content-schema`,
`isPending` is `false` and `types` is `undefined`, so `scopedTypes` is `[]` and
the component returns `null`.

**Why it is wrong:** `.cursor/BUGBOT.md` names this pattern directly —
"Distinguish a failed query from a genuinely empty result. Rendering the empty
state on error hides outages." Here it is worse than an empty state: the section
renders **nothing at all**, so the user loses the navigation, the ⌘K trigger and
any indication that something failed. The sibling that consumes the *same query*
gets it right — `ContentLibraryPage/index.tsx:98-104` renders `ContentLibraryError`
with a retry, and that path is e2e-pinned (`content-library.spec.ts:162`). The
two components disagree about the same failure.

**Repro:**
1. Sign in, open `/workspaces/W/content/blog_post`.
2. Make `GET /api/content-schema` return 500 and reload.
→ Observed: the work area shows "Couldn't load content types" with a Try again
button; the **sidebar's Content section is gone entirely**, with no error and no
retry. The ⌘K shortcut also stops working, because its listener lives in the
unmounted component (`:36-48`).
Expected: the section shows a small error affordance, or at minimum keeps the
search trigger alive.

**Blast radius:** every user during any content-schema outage. Non-destructive,
but the recovery path (⌘K, the nav) vanishes exactly when the user needs it, and
the missing section reads as "this workspace has no content".

**Suggested fix:** destructure `isError` and render a compact error row with a
retry (reusing `ContentLibraryError`'s copy), and hoist the ⌘K listener above the
early returns.

### 🐞 BUG-content-admin-04 — The editor's implicit form submit publishes live, with no confirmation · Severity: Low

**Location:** `packages/content/admin/src/lib/presentation/components/ContentEntryView/EntryEditor/index.tsx:615-639`
**Category:** ux-state / error-prevention

**What the code does:**

```tsx
<form noValidate onSubmit={(event) => {
    event.preventDefault();
    if (event.target !== event.currentTarget) return;
    // Submitting (e.g. Enter) runs the primary action — publish for
    // a publishable type, otherwise a plain save …
    save(publishable)();
}}>
```

`save(true)` → `runSave(true)` → `form.submit(submitWith(true))` →
`flow.submit({ publish: true })`, which saves **and** calls the publish endpoint
(`usePublishEntryFlow/index.ts:161-177`).

**Corrected on verification — when this actually fires is narrower than "any text
field".** The editor's write actions are **not** inside this `<form>`: `EntryActions`
renders through `PageActionsPortal` → `createPortal` into the top bar
(`EntryEditor/index.tsx:648-661`; `shell-admin`'s
`lib/utils/pageChrome/index.tsx:194-197`), and its primary button is explicitly
`type="button"` (`EntryActions/index.tsx:113-114`). Every other `<Button>`/`<button>`
rendered inside the form carries an explicit `type="button"` too — a scan of the
`ContentEntryView` and `EntryFieldInput` trees found no exception, and the
design-system `Button` sets no default type of its own
(`packages/design-system/src/lib/components/ui/button.tsx:43-55`), so the omission
would matter. **The form therefore has no submit button at all.** Under HTML's
implicit-submission rule a form with no submit button submits on Enter only when it
contains **at most one** field that blocks implicit submission (`input` of type
text/number/date/…); with two or more, Enter does nothing. Of the editor's controls
only `text`/`number`/`money` render a native `<input>`
(`EntryFieldInput/index.tsx:500-532`); `richtext`/`json` are `<textarea>`,
`select`/`multiselect`/`boolean`/`date` are buttons or popovers, and inactive Radix
`TabsContent` panels are unmounted. So the hazard is real but reaches only records
whose **active tab renders exactly one** text/number/money input — a one-field
`single` page, or a type whose General tab is one text field plus richtext/select/
date fields. Severity downgraded Medium → Low for that reason.

*Unverified —* the implicit-submission behaviour above is the HTML Standard's rule
and was not exercised in a browser here (no `node_modules`, no dev server). Note the
package's own `AGENTS.md` twice states as fact that "the editor's `<form>` submits on
Enter in a text field", and `EntryEditor/index.tsx:502-504` repeats it — so either
the docs overstate it or a submit button exists that this scan missed. A single
Playwright assertion settles it; see §7.

**Why it is wrong:** every other consequential action in this package is behind
an explicit confirmation — delete (`CollectionRecordsRowActions/index.tsx:324`),
purge (`:343`), restore/publish a version (`RevisionList`), and even a
shared-field *save* on a localized type (`EntryEditor/index.tsx:945-969`).
Publishing — making a draft visible on the public API — is the one that reaches
outside the CMS, and it is the one action a stray keystroke performs. WCAG 3.2.2
(On Input) is explicit that entering data must not change context beyond the
user's expectation. The comment's stated rationale ("it matches the visually
primary button") is a reason for the *button*, not for Enter.

**Repro:**
1. `ADMIN` on a **publishable** type whose General tab renders exactly one
   text/number/money field (e.g. a `single` page with one `title` plus a
   `richtext` body).
2. Open an existing draft record, click into that field, correct a typo, and press
   Enter (a near-universal "commit this field" habit).
→ Observed: the busy cover reads "Publishing…", and the toast reads
"Blog post published." The record is live.
→ On a type with **two or more** text/number inputs on the open tab, Enter is
swallowed by the browser and nothing happens — which is itself worth pinning, since
the two behaviours differ per content type.
Expected: Enter saves a draft, or does nothing, or the publish path confirms.

**Blast radius:** authors on publishable types that meet the one-input condition.
Recoverable (Unpublish exists) but the content was public in the interim, and on a
type with an `ENTRY_MENU_SLOT` "publish all locales" contribution the reach is every
sibling locale. Nothing in the e2e suite asserts what Enter does, so a change either
way — including a future `type="submit"` slipping into the form and widening this to
every type — is unguarded.

**Suggested fix:** make the implicit submit the **draft** path
(`save(false)`), or gate the publish-on-Enter behind the same confirm the
shared-field save already uses.

### 🐞 BUG-content-admin-05 — Deleting a row leaves its id in the selection, so a later bulk action targets a record that no longer exists · Severity: Low

**Location:** `packages/content/admin/src/lib/presentation/components/CollectionRecordsView/LoadedRecordsView/index.tsx:229-248,574-589`
and `CollectionRecordsTable/CollectionRecordsRowActions/index.tsx:334-341`
**Category:** ux-state

**What the code does:** `selectedIds` is a `Set<string>` held in
`LoadedRecordsView` and cleared only by the bar's Clear button
(`clearSelection`, `:248`) or by a **bulk** action completing
(`onDone={clearSelection}`, `:585`). The **row menu's** delete
(`run(actions.remove.mutateAsync, …)`) knows nothing about the selection and
never prunes it, and `refreshEntryCaches` only touches the query cache.

**Why it is wrong:** the selection is deliberately by id and survives paging
("Row selection — by id, persisting across paging", `:228`), which is the right
call — but that design makes pruning on delete mandatory, because the id
outlives the row. The bar then reports a count that includes a deleted record,
and `CollectionRecordsBulkActions` is handed `ids={[...selectedIds]}` verbatim.

**Repro:**
1. Open a collection with 5 rows.
2. Tick rows 1 and 2 → the bar reads "2 selected".
3. Open row 1's ⋯ menu → Delete → confirm.
→ Observed: the row disappears from the table, the bar still reads "2 selected",
and the sr-only region still announces "2 rows selected". Running bulk Delete now
sends the deleted id along with row 2's.
Expected: the bar reads "1 selected" once the list refetches.

**Blast radius:** cosmetic in the common case (the server ignores or 404s the
dead id, and `useBulkEntryActions` surfaces a partial-success shape), but the
count is a lie and a bulk **publish** dry-run will show a `not-found` verdict the
user cannot explain. Low severity because it needs a mixed single/bulk workflow.

**Suggested fix:** intersect `selectedIds` with the ids present in the refreshed
page (or prune on any successful single-row mutation), the same way the column
picker reconciles ids against the live schema.

### 🐞 BUG-content-admin-06 — The ⌘K handler is global and unconditional, so it steals the shortcut from every editor and input · Severity: Low

**Location:** `packages/content/admin/src/lib/presentation/components/ContentNavSection/index.tsx:36-48`
**Category:** correctness / ux-state

**What the code does:**

```ts
const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === SEARCH_SHORTCUT_KEY) {
        event.preventDefault();
        setSearchOpen((open) => !open);
    }
};
window.addEventListener('keydown', onKeyDown);
```

No check of `event.target`, no `event.altKey`/`shiftKey` exclusion, and it
`preventDefault()`s unconditionally. It is registered for the whole time the user
is inside a workspace (the section renders in the app sidebar).

**Corrected on verification — the WYSIWYG conflict this finding originally claimed
does not exist.** `wysiwyg-admin` registers **no** `Mod-k` binding: there is no
`addKeyboardShortcuts` anywhere in `packages/wysiwyg/admin/src`, and its link
affordance is toolbar-driven (`WysiwygToolbar/LinkPopover/index.tsx:64,83`), built on
StarterKit's configured `link` mark
(`infrastructure/editorExtensions/index.ts:33-44`). The repro "press ⌘K to insert a
link" has been **deleted** as unsupported.

**Why it is still wrong:** ⌘K/Ctrl+K is a browser-level binding (Chrome/Edge: search
from the address bar; Firefox: focus the search bar) and the standard "clear line"
binding in terminal-style inputs, and this handler `preventDefault`s it for the whole
time the user is anywhere inside a workspace, from any target — a `<textarea>`, an
`<input>`, a `contenteditable` body. Because it also **toggles**, a second press
meant to dismiss the palette is likewise swallowed. The repo's own convention is that
a global key listener checks its target; nothing here does.

**Repro:**
1. Open any record, click into the rich-text body (or any `<textarea>`).
2. Press ⌘K / Ctrl+K.
→ Observed: the content-type search palette opens over the editor, the browser's own
⌘K is suppressed, and the caret is left where it was.
Expected: a shortcut owned by the focused editable is not intercepted by a sidebar
section.

*Unverified —* whether `@tiptap/extension-link` itself ships a default `Mod-k`
keymap is a vendor contract and `node_modules` is not installed here; the statement
above is only that **this repo** binds none.

**Blast radius:** authors using the rich-text editor; low data risk, high
annoyance. Also note the shortcut is advertised as `⌘K` only
(`♿ A11Y-content-admin-09`).

**Suggested fix:** ignore the event when `event.target` is inside a
`contenteditable`, `<input>` or `<textarea>` — or when the active element opts
out via a data attribute — and prefer open-only over toggle.

### 🐞 BUG-content-admin-07 — Boolean, select and multiselect cells print raw, untranslated wire values · Severity: Low

**Location:** `packages/content/admin/src/lib/presentation/components/CollectionRecordsView/CollectionRecordsTable/renderCell.tsx:36-55`
**Category:** correctness / i18n

**What the code does:**

```tsx
case CONTENT_FIELD_TYPE.Boolean:
    return <Badge variant={value ? 'default' : 'secondary'}>{String(value)}</Badge>;
case CONTENT_FIELD_TYPE.Select:
    return <Badge variant="secondary">{String(value)}</Badge>;
```

**Why it is wrong:** the same boolean field renders "Enabled"/"Disabled" through
localized messages in the **form** (`EntryFieldInput/index.tsx:57-64,262-267`),
so one record reads two ways in the two places a writer looks at it — precisely
the drift `EntryStatusBadge` was created to prevent
(`EntryStatusBadge/index.tsx:105-114`: "the single rendering … so the same record
can't read two different ways"). The Status column was migrated off raw wire
values for this reason; boolean was not. In a non-English locale the cell shows
literal `true` / `false`. (A `select`'s option values are author-defined, so
leaving those raw is defensible — the boolean is not.)
The relation branch at `:78-91` compounds it: it prints `String(first)`, a raw
FK uuid — unreachable from the table (relations route to `RelationCell`,
`CollectionRecordsTable/index.tsx:146-159`) but live wherever else `renderCell`
is used as a formatter.

**Repro:**
1. Make a collection's `active` boolean column visible.
2. Read the cell; then open the record and read the same field.
→ Observed: "true" in the table, "Enabled" in the form. Switch the admin locale:
the table still says "true".
Expected: one localized rendering, shared.

**Blast radius:** cosmetic, every collection with a boolean column, every
non-English deployment.

**Suggested fix:** reuse the form's `enabled`/`disabled` descriptors from a
shared module, as `EntryStatusBadge` does for status.

### 🐞 BUG-content-admin-08 — Every `money` cell is rendered as USD regardless of the field's currency · Severity: Low

**Location:** `packages/content/admin/src/lib/presentation/components/CollectionRecordsView/CollectionRecordsTable/renderCell.tsx:70-74`
**Category:** correctness

**What the code does:**

```tsx
case CONTENT_FIELD_TYPE.Money:
    return intl.formatNumber(Number(value) / 100, {
        style: 'currency', currency: 'USD'
    });
```

Both the minor-unit divisor and the currency are hard-coded, and `ContentField`
carries no currency at all (`domain/types/contentType/index.ts:68-121`).

**Why it is wrong:** the value is presented as a specific currency the schema
never asserted. A price stored as `1999` in a EUR-denominated field reads
"$19.99", which is not a formatting nit — it is a wrong number shown to an author
deciding what to publish. The `/100` assumption also breaks for zero-decimal
currencies (JPY, KRW), where `1999` would be ¥1,999 and renders as ¥19.99 —
off by two orders of magnitude. The editor's control has the mirror-image
problem: `money` renders as a bare `type="number"` input
(`EntryFieldInput/index.tsx:500-532`) with no currency affordance and **no
divisor**, so the author types `19.99` while the table divides by 100 — the two
surfaces disagree about the unit.

**Repro:**
1. Declare a `money` field and store `1999` in it.
2. View the records table, then open the record.
→ Observed: the table reads "$19.99"; the editor's input reads "1999".
Expected: one agreed unit and the field's real currency.

**Blast radius:** any deployment using `money` fields outside USD, or with
zero-decimal currencies. The stored data is fine; the display is wrong on one
side of the same screen.

**Suggested fix:** add a `currency` (and minor-unit) hint to the `money` field
schema in `content/domain`, and make the cell and the input agree on the unit.
Until then, render the raw number rather than asserting a currency.

### Checked and cleared

Behaviours I specifically read and found **correct**, so they are not filed:

- **Pager clamping after a mutation** (BUGBOT's headline admin bug) — implemented
  at `LoadedRecordsView/index.tsx:333-340`, correctly guarded on both `data` (so
  a deep-linked `?page=N` survives the first fetch) and `!isPlaceholderData` (so
  the clamp reads the fresh total, not the `keepPreviousData` one).
- **Error vs empty on the records table and the relation-candidate list** — three
  genuinely distinct branches in both (`LoadedRecordsView/index.tsx:549-571`,
  `RelationCandidateList/index.tsx:73-87`), error first.
- **Over-invalidation** — `refreshEntryCaches` names six workspace-and-type
  scoped prefixes and never `invalidateQueries()` with no key
  (`refreshEntryCaches/index.ts:46-74`). The one broad move (invalidating every
  *other* read-one of the type) is documented and justified by i18n sibling sync.
- **Mapper fallbacks** — `contentMapper.toContentType` copies fields straight
  across with no `??` defaults (`contentMapper/index.ts:22-32`). The one lookup
  that can yield `undefined` is `FIELD_TYPE_BY_WIRE[wire.type]` (`:35-42,63`),
  which fails *visibly* (an unusable filter row) rather than inventing a type.
  `useEntryForm` re-seeds on identity change rather than merging, so no stale
  value is silently preserved.
- **Workspace scoping of query keys** — every entry-scoped key carries
  `workspaceId` (`contentKeys/index.ts:57-152`); the one bare key is the global
  schema catalogue.
- **Relation deltas never replace a set** — `seedRelationValues` deletes
  link-managed keys from the form (`ContentEntryView/index.tsx:117-127`), so the
  whole-set `writeLinks` path is structurally unreachable from the editor.
- **The `<form>` portal guard** — `event.target !== event.currentTarget`
  (`EntryEditor/index.tsx:634`) correctly stops a portalled contribution's submit
  from saving the record, and is e2e-pinned.
- **`getItems()` mutation** — `createSlot` returns its internal array by
  reference (`packages/utils/admin/src/lib/slot/index.ts:34`), but every call
  site in this package copies before sorting (`.filter().sort()` at
  `EntryEditor/index.tsx:338-340`) or only reads. No in-place sort found.
- **Hook-order safety of the hook-style slots** — `useRowsData`, `useFields`,
  `usePresave` and `useItem` are each called unconditionally over the full
  registered list (`LoadedRecordsView/index.tsx:264-266,369-376`,
  `ContentEntryView/index.tsx:212-216`, `EntryMenu/index.tsx:107-111`), with
  filtering applied to the *result*. The boot-frozen guarantee holds.
- **Read-only enforcement** — gated at the single funnel (`runSave`, `:507`) as
  well as on the controls, so the Enter-to-submit path is covered.

**Defect tally:** `8 🐞 · 0 Critical · 1 High · 2 Medium · 5 Low · 1 🔒`
(BUG-04 downgraded Medium → Low on verification; see its own note.)

**Accessibility tally:** `11 ♿ · 0 Supports · 5 Partially Supports · 6 Does Not
Support · 0 Not Applicable` — all 11 confirmed against the code on verification;
none withdrawn.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/admin-e2e` POM + `page.route` | `content/records-pagination.spec.ts` | Seed 21 rows at pageSize 10. Next/Prev move `?page=`; the range and "Page X of Y" readouts; deleting the only row on page 3 lands the user on page 2 with rows 11–20, **not** on an empty page; `?page=99` clamps; `?page=abc` falls back to 1; changing rows-per-page drops `page` | F34, F35, EC-10 to EC-15 |
| 2 | `apps/admin-e2e` | `content/entry-validation.spec.ts` | An invalid field gets `aria-invalid` + `aria-describedby` pointing at a rendered `<FieldError>`; a 422 response maps `issues` onto the right fields; editing a field clears its server error; a required field with `admin.hidden` still blocks the save with no control on screen | F45, F47, `🐞 BUG-content-admin-01` |
| 3 | `apps/admin-e2e` | extend `content/content-library.spec.ts` | With `GET /api/content-schema` failing, the **sidebar** still renders an error affordance and the ⌘K shortcut still opens the palette | `🐞 BUG-content-admin-03`, F4, EC-62 |
| 4 | `apps/admin-e2e` | `content/records-row-actions.spec.ts` | Each row's ⋯ trigger has a **distinct** accessible name; Delete opens the confirm, confirming removes the row and moves focus somewhere sensible; the selection count drops when a selected row is deleted | `♿ A11Y-content-admin-01`, `♿ A11Y-content-admin-02`, `🐞 BUG-content-admin-05`, F25 |
| 5 | `apps/admin-e2e` | extend `content/content-library.spec.ts` | Pressing Enter in the title field of a publishable record does **not** publish (whichever behaviour is chosen, pin it) | `🐞 BUG-content-admin-04`, F70 |
| 6 | `apps/admin-e2e` a11y | extend `content/a11y.spec.ts` | Four new axe scans: the **writable** General tab with errors revealed, the records **error** state, the open delete `ConfirmDialog`, and the History tab + revision preview dialog | §4A's unscanned states |
| 7 | `apps/admin-e2e` keyboard | `content/keyboard.spec.ts` | Tab order across the records toolbar → headers → rows; a refused Publish moves focus to the first invalid control; a tab change moves focus into the destination panel; Esc from the filter panel returns focus to the toggle (already implemented — pin it) | `♿ A11Y-content-admin-06`, `♿ A11Y-content-admin-08`, F28 |
| 8 | `apps/admin-e2e` | `content/publish-gate.spec.ts` | The rail's gate lists each required field, flips a row to passing as it is filled, the header reads blocking → ready, and a required **many** relation gate row appears/clears on staged link changes | F49, F50 |
| 9 | `apps/admin-e2e` | `content/records-trash.spec.ts` | The trash view's title/subtitle, that rows carry no link, Restore returns a row to the live list, Delete-permanently confirms first, and the third empty variant | F26, EC-02 |
| 10 | `apps/admin-e2e` | `content/slots-contract.spec.ts` (a fixture plugin registered after `ContentPlugin()`) | Toolbar/column/sidebar items render in registration order; `useItem` returning `null` renders nothing while its hook still runs; an unknown tab slug is not deep-linkable; a contribution that throws does not blank the app (i.e. an error boundary exists) | F71, `🐞 BUG-content-admin-02` |
| 11 | `apps/admin-e2e` | extend `content/media-fields.spec.ts` | Attaching an asset to a media field prompts for alt text with a decorative option, and the answer survives save + reload + a revision restore | `♿ A11Y-content-admin-11` (504.3 / 504.2.1) |
| 12 | `apps/admin-e2e` | extend `content/content-library.spec.ts` | The records **skeleton** is visible while the first page loads, and the `role="alert"` error card (not the empty state) is shown on a 500 with Retry recovering | F36, EC-61 |
| 13 | `apps/admin-e2e` | `content/bulk-actions.spec.ts` | Driving `BulkPublishDialog` from the **records selection bar** (not via i18n): the dry run's verdicts, publishing only valid drafts, and the partial-success report | F24 |
| 14 | `apps/admin-e2e` | extend `content/entry-revisions.spec.ts` | Restore re-applies a snapshot as a **new** version; the preview dialog renders relation and media refs by title/thumbnail rather than uuid; a 422 on publish-a-version surfaces an error toast | F66, F67 |
| 15 | `apps/admin-e2e` | extend `content/content-library.spec.ts` | Dirtying a field then clicking "Back to records" prompts; discarding leaves; the prompt does **not** fire in read-only mode; a staged-relation-only edit still prompts | F59, EC-59 |

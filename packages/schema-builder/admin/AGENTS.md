# @orthacms/schema-builder-admin

The schema builder's **admin page**
([ADR-0020](../../../docs/adr/0020-schema-builder-writes-code.md)): the content
model at `/content-model`, one type per URL (`/content-model/:typeName`), in
the global sidebar's `directory` group. Global, because content types are code
and the same in every workspace. Gated on `content:read` — the permission the
document route needs. The dossier is
[`docs/artifacts/schema-builder.md`](../../../docs/artifacts/schema-builder.md).

Layout: **layered (ADR-0003)**, mirroring `@orthacms/users-admin`.

```
domain/
  schemaGateway/       the PORT (type) — infrastructure implements it
  builtInTab/          which entry-editor tab a field lands on
  generalTabLayout/    General as the editor draws it: loose fields by rank, then groups
  fieldFacts/          what a field row says besides its name and type
  fieldDrop/           what a dragged field's drop does: reorder, regroup, or refused
  moveGroup/           a group dragged to where another one is
  selectOptions/       a select's options edited, the default carried along
infrastructure/
  httpSchemaGateway/   the impl — the ONLY apiClient user
  schemaKeys/          query keys
application/
  queries/useSchemaDocument/
  useSchemaDraft/ useApplyFlow/ waitForOperation/ waitForRestart/
presentation/
  pages/ContentModelPage/   four states: no access · loading · error · loaded
  components/               chrome, layout, skeletons, rail, type editor, notices
utils/schemaBuilderPlugin/  the AdminPlugin factory
```

## Decisions

- **No mapper.** The envelope is `@orthacms/schema-builder-domain`'s own
  contract, shared with the server, so the wire shape and the view shape are
  one type.
- **One form; groups are accordions in it.** The field list is drawn the way
  the entry editor's one **Content** form draws it
  ([ADR-0022](../../../docs/adr/0022-entry-editor-one-form-properties-on-demand.md)):
  relations and media are fields like any other, no longer blocks of their
  own (`builtInTab` maps every field to the one tab). The loose fields follow
  `orderGeneralTab` from `@orthacms/content-domain`, the same table
  `EntryFieldSections` uses; inside a group the declared order holds. Nothing
  on this page suggests a schema can add a tab.
- **States never mix.** No access sends no request; loading is one
  `SkeletonRegion`; an error is an alert with a retry, never an empty rail; an
  app with no types is its own empty state.
- **Two panes over the whole work area.** `ContentModelChrome flush` hands the
  body the work area; `ContentModelLayout` draws the rail as a column the
  height of the work area, ruled off on the right (its list scrolls on its
  own, "New content type" pinned to its foot), and the editor beside it. The
  open type is the page's `<h1>` (`TypeHeader`, a `ContainerHeader`); with no
  type open it is "Content Model" (`ContentModelHeader`). The draft's account —
  unsaved count, problems, Discard, Review changes — goes to the top bar
  through `PageActionsPortal`, beside the crumb Content Model › the type.
- **Skeletons share the chrome and the grid.** `ContentModelChrome` and
  `ContentModelLayout` are used by the page, by `ContentModelSkeleton` and by
  the lazy route's `ContentModelPageSkeleton`; the skeleton draws a real
  `<h1>` where the type's will be, so neither the chunk boundary nor the query
  boundary moves it. No access, an error and an app with no types keep the
  page measure under the page's own header.
- **Read-only, and says why.** The page-wide notice gives the server's reason
  (`production`, `disabled`, `no-source-tree`). On a server that could edit, a
  hand-written type says it is read-only because the builder owns only files
  carrying `// @orthacms-generated`, and how to hand one over.
- One component per file; a component with one consumer nests under it.
  Messages are co-located, ids `schemaBuilder.<area>.<key>`.

## Editing

When the server can edit (`capabilities.editable`) and the person holds
`schema:manage` (`useBuilderAccess`), a type the builder owns becomes a form.
Hand-written types stay read-only and say how to hand them over.

- **The draft** is `useSchemaDraft`: a reducer over the served document
  (`domain/schemaDraft`, one handler folder per action — the handler table is
  typed exhaustively), the diff against the served document, and the kernel's
  `checkTypes` issues (`domain/draftIssues`). A new served document (after a
  restart) resets it. Every edit lands in the draft as it is made — the sheets
  hold no copy that could drift from what the review shows.
- **Keys, not names.** A field keeps its key through a rename, so the diff
  reports a rename rather than a remove plus an add. A new field's key is
  `new:<random>` (`newFieldKey`).
- **The type page is fields first.** `TypeHeader` says what you need to know
  in one line under the `<h1>` — machine name, kind, the flags that are on as
  pills, path, field count — and keeps label, description and the flags in a
  Settings sheet (`TypeSettingsSheet`); its ⋯ (`TypeMenu`) removes the type. A
  field row is label first, machine name under it in mono, badges only for
  what changes behaviour (Required, Localized, Hidden, Multiple), the type in
  words on the right with its detail (options, a relation's target). Groups
  are section headers inside the same list; "Add field" and "+ Group" close it.
- **Adding a field is two steps**: a kind picker (`AddFieldDialog`, "Add a
  field to {Type}", the catalog in `FIELD_KIND_GROUPS` sections, searchable by
  name and example, Enter or a double-click continues), then the **same
  panel** that edits a field (`FieldSheet` with `adding`: Another kind / Add
  field). `AddFieldFlow` holds the field aside through `useNewField` — the same
  `FieldEditor` contract the panel edits through, over local state — and it
  joins the draft only on "Add field", so leaving at either step leaves
  nothing half-made. It replaced the three-step `?addField` page. The machine
  name follows the label until typed by hand; the schema rules run on the
  field as it would land, before it can be added.
- **The panel previews the field** (`FieldPreview`): label, required mark,
  locale globe, the control its kind draws, placeholder or default, help text
  — redrawn from the spec on every keystroke. A drawing, not a form: its
  control is `aria-hidden` and takes no focus, so no second "Title" field
  competes with the real ones below.
- **A new type is one dialog** (`NewTypeDialog`): name and machine name, the
  kind as two cards with an example of each, Start from — Blank or a template
  (`TYPE_TEMPLATES`: Article, Event, FAQ; DSL fields only, fresh keys every
  use, each pinned by a spec as accepted by the schema rules) — and Features
  as checkboxes (draft & publish and trash on by default). What becomes fixed
  once applied is said once, at the foot.
- **The catalog is choices, not types** (`FIELD_CATALOG`, keyed by `id`). Each
  is a DSL type or a **preset** of one: "Long text" is `richtext` with the
  `textarea` widget, the DSL's own way to say a plain box of text. Every kind
  says what it is for — JSON names the article's Metadata — so the big text
  types are findable by what they hold.
- **Nothing the DSL lacks** (ADR-0020 §5). `FIELD_CAPABILITIES` decides, per
  field type, which Validation editors exist and whether group and width apply
  (not to relations or media — they have their own tab). Clearing an input
  drops the option (`fieldPatch`), so it falls back to the DSL default; unknown
  `admin` keys survive.
- **A select's options are a basic, not a rule.** They sit on General — the
  "Basics" step when adding — above the default that is picked from them, so
  the default can be chosen as soon as the options exist. Renaming the option
  the default names carries the default along; removing it clears it
  (`selectOptions`).
- **Fewer knobs than the DSL, on purpose.** There is no control picker — the
  kind is the control (`kindOf`: long text is a textarea, rich text the
  editor) — and no row key: two adjacent half-width fields share a line in the
  entry editor on their own. A `widget` or `row` a schema already carries is
  kept as it is.
- **Flags.** A new type sets all three; an existing one may only turn the trash
  on (`canChangeFlag`) — every other flip needs a data migration. Judged
  against the **served** type, so a flag the draft changed can always be
  switched back before an apply.
- **Order and groups by drag.** Each list (loose fields, each group) is its
  own sortable context, but the lists share one
  `SortableFieldScope`, so a field is dragged into a group — an empty one is a
  drop target of its own — and back out to the loose fields (`field.regroup`
  sets or clears `admin.group`). Mid-drag the scope keeps its own order of
  the lists (`DragOrderContext`): over another list's row the field moves into
  that list there, so its rows make room as they do for a reorder. The list it
  left closes up and slides the row it was put before under it, so it is
  pinned there until dragged past that row's middle (by keyboard, until the
  next arrow key). `fieldDrop` decides a drop: inside one list a reorder that
  `canMoveField` refuses across ranks above the groups, because the entry
  editor would re-sort it; into another list always allowed, landing where
  the drag drew it. The groups are a second sortable context in the same
  scope, dragged by their own handle (`moveGroup`); collisions and keyboard
  steps are filtered by kind, so a group never lands on a field. A group is
  over the farthest group whose middle its leading edge has passed, not the
  nearest center: blocks differ in height, and by centers a group taller than
  the first could never be put first.
  Dragging
  works from the handle by keyboard too; dnd-kit's announcements are replaced
  with ones that name fields and lists.
- **Groups** are edited in `GeneralGroupsSheet` (the list's "+ Group") —
  groups on General, never sections of their own or tabs — or one at a time
  from the group's own menu
  (`GroupSheet`: title, description, starts folded, remove). An empty one is
  flagged: the schema refuses it. Removing one keeps its fields, loose.
- **Leaving** the page with a draft asks first (`useUnsavedChanges`). The rail
  is marked `data-keeps-unsaved-changes`, so moving between types does not.

## Review and apply

`useApplyFlow` (application) runs review → confirm → apply → restart → grant.

- **The review is one page** (`ChangesReview`): the changes grouped by type
  (`ChangeGroup` — the type, New collection / Removed, its riskiest verdict;
  a card that deletes data drawn in the destructive tone), each destructive
  change confirmed on its own; the files and SQL folded under "Technical
  details"; and `ApplyBar`, held at the foot of the page, with what still
  blocks Apply, the migration name and "Apply N changes". After Apply the page
  becomes the progress, then the outcome. It is a **state of the content
  model page** (`?review`), not a route: the same element stays mounted, so
  the draft it reviews is the editor's, and Back — "Back to editing" in the
  top bar, or the browser's — returns to it untouched. Programmatic
  navigation is not intercepted by the unsaved-changes guard, and the back
  link is marked `data-keeps-unsaved-changes`. It replaced a three-step
  wizard.
- **The plan is the server's.** Opening the review asks `POST
/schema-builder/plan` with the draft and the fingerprint it started from
  (also when the page is reached by Back/Forward); `ChangesSkeleton` covers
  the seconds drizzle-kit takes. A `409` is a stale page — the only way on is
  a reload.
- **Apply is disabled with a reason** (`applyReadiness`, the UX mirror of the
  server's checks): a blocked change, every destructive change confirmed by
  its own checkbox — there is no "confirm all" — and a migration name drizzle-kit
  accepts (`MIGRATION_NAME`, suggested from the changes).
- **Following an apply** is two polls with an injected `sleep`
  (`waitForOperation`, then `waitForRestart`). A `200` from the document route
  is not the restart — the old process answers until it is replaced — the new
  `bootId` is. On `restart: 'manual'` the second wait is long and the progress
  says to restart the server. Once the new process answers, the document is put
  in the cache and every registry-derived query is invalidated (`isRegistryKey`).
  The draft resets on the new boot id even when the document is equal.
- **Progress is the server's steps, timed here.** `waitForOperation` reports
  every running answer; `useApplyFlow` folds them into `domain/applyProgress`
  (generate → migrate → publish, then the restart and ready). A step's time is
  what this tab saw between two polls; a step that ran between them is done
  with no time — never a made-up zero. `ApplyProgress` draws them as a stepper
  in one `role="status"`, not a skeleton.
- **A failure keeps the draft**, stops at its step, and says so.
- **The outcome is a page, and the next decision is on it.** `AppliedSummary`:
  what was applied (changes, the migration file, the restart's time), then —
  for a created type — the grant card, then Open {Type} in the model.
- **New types are granted to no workspace** (invariant 11). `GrantNewTypes`
  offers the active workspaces through `POST /workspaces/:id/content` inline
  on the applied page, not in a modal over it, with "Not now" as an equal
  answer; either answer leaves a line saying what happened. A search appears
  past six workspaces.

## Commands

- `npx nx test @orthacms/schema-builder-admin` (vitest, jsdom)
- `npx nx run-many -t typecheck lint -p @orthacms/schema-builder-admin`
- Browser suites: `apps/admin-e2e/src/content-model/` (`npx nx e2e admin-e2e -- src/content-model`)

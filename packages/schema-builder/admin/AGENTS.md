# @orthacms/schema-builder-admin

The schema builder's **admin page**
([ADR-0020](../../../docs/adr/0020-schema-builder-writes-code.md)): the content
model at `/content-model`, one type per URL (`/content-model/:typeName`), in
the global sidebar's `directory` group. Global, because content types are code
and the same in every workspace. Gated on `content:read` — the permission the
document route needs. The design is in
[`docs/design/schema-builder.md`](../../../docs/design/schema-builder.md).

Layout: **layered (ADR-0003)**, mirroring `@orthacms/users-admin`.

```
domain/
  schemaGateway/       the PORT (type) — infrastructure implements it
  builtInTab/          which entry-editor tab a field lands on
  generalTabLayout/    General as the editor draws it: loose fields by rank, then groups
  fieldFacts/          what a field row says besides its name and type
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
- **Tabs are built in; groups are accordions on General.** The field list is
  drawn under the entry editor's tabs — General, Relations, Media — and a tab
  with nothing on it is left out, as the editor leaves it out. General's loose
  fields follow `orderGeneralTab` from `@orthacms/content-domain`, the same
  table `EntryFieldSections` uses; inside a group the declared order holds.
  Nothing on this page suggests a schema can add a tab.
- **States never mix.** No access sends no request; loading is one
  `SkeletonRegion`; an error is an alert with a retry, never an empty rail; an
  app with no types is its own empty state.
- **Skeletons share the chrome and the grid.** `ContentModelChrome` (top bar +
  `<h1>`) and `ContentModelLayout` (the two-pane grid) are used by the page,
  by `ContentModelSkeleton` and by the lazy route's `ContentModelPageSkeleton`,
  so neither the chunk boundary nor the query boundary moves anything.
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
- **Nothing the DSL lacks** (ADR-0020 §5). `FIELD_CAPABILITIES` decides, per
  field type, which Validation editors exist, whether group/width/row apply
  (not to relations or media — they have their own tab) and which widgets the
  stock admin understands. Clearing an input drops the option (`fieldPatch`),
  so it falls back to the DSL default; unknown `admin` keys survive.
- **Flags.** A new type sets all three; an existing one may only turn the trash
  on (`canChangeFlag`) — every other flip needs a data migration.
- **Order.** Each list (loose fields, each group, Relations, Media) is its own
  sortable context; `canMoveField` refuses a drop across ranks above the groups,
  because the entry editor would re-sort it. Reordering works from the handle
  by keyboard; dnd-kit's announcements are replaced with ones that name fields.
- **Groups** are edited in `GeneralGroupsSheet` — accordion blocks on General,
  never sections or tabs. An empty one is flagged: the schema refuses it.
- **Leaving** the page with a draft asks first (`useUnsavedChanges`). The rail
  is marked `data-keeps-unsaved-changes`, so moving between types does not.

## Review and apply

`useApplyFlow` (application) runs review → confirm → apply → restart → grant.

- **The review is a page with steps** (`ChangesReview`), in the shape of the
  other wizards — new workspace, invitation: a stepper rail and one step card.
  Changes (verdicts, the per-change confirmation) → files and SQL → the
  migration name and Apply; after Apply the card becomes the progress, then
  the outcome. It is a **state of the content model page** (`?review`), not a
  route: the same element stays mounted, so the draft it reviews is the
  editor's, and Back — the link or the browser's — returns to it untouched.
  Programmatic navigation is not intercepted by the unsaved-changes guard,
  and the back link sits in a `data-keeps-unsaved-changes` region.
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
- **A failure keeps the draft**, and says so. `ApplyProgress` is real progress,
  one `role="status"`, not a skeleton.
- **New types are granted to no workspace** (invariant 11). `GrantNewTypeDialog`
  offers the active workspaces through `POST /workspaces/:id/content`, with
  "Not now" as an equal answer; it is mounted only when there is something to
  grant, because it reads the workspace list.

## Commands

- `npx nx test @orthacms/schema-builder-admin` (vitest, jsdom)
- `npx nx run-many -t typecheck lint -p @orthacms/schema-builder-admin`
- Browser suites: `apps/admin-e2e/src/content-model/` (`npx nx e2e admin-e2e -- src/content-model`)

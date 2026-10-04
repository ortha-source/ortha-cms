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

## Commands

- `npx nx test @orthacms/schema-builder-admin` (vitest, jsdom)
- `npx nx run-many -t typecheck lint -p @orthacms/schema-builder-admin`
- Browser suites: `apps/admin-e2e/src/content-model/` (`npx nx e2e admin-e2e -- src/content-model`)

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

## Commands

- `npx nx test @orthacms/schema-builder-admin` (vitest, jsdom)
- `npx nx run-many -t typecheck lint -p @orthacms/schema-builder-admin`
- Browser suites: `apps/admin-e2e/src/content-model/` (`npx nx e2e admin-e2e -- src/content-model`)

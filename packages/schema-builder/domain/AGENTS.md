# @orthacms/schema-builder-domain

The schema builder's **framework-free kernel**
([ADR-0020](../../../docs/adr/0020-schema-builder-writes-code.md)). Pure
TypeScript whose only dependency is the content kernel
(`@orthacms/content-domain`, itself dependency-free) — the CLI, the server
plugin and the admin import it alike. No framework, no Node-only API. The design is in
[`docs/design/schema-builder.md`](../../../docs/design/schema-builder.md).

## What lives here

- **The content manifest** (`lib/manifest/`) — `renderManifest(entries)`
  writes `src/content/index.ts`: the `contentTypes` array plus a top-level
  export for every main table, every many-relation join table and the revision
  store (drizzle-kit diffs **top-level** exports only). Deterministic —
  collections before pages, each by name — and already formatted the way
  prettier leaves it, so a re-sync never appears in a diff on its own. Export
  names (`articleTable`, `articleTagsJoinTable`, `contentEntryRevisionsTable`)
  match what hand-written manifests used. `orthacms content sync` and the Nx
  `content:sync` target scan the type files and call it; the schema builder
  will render it from its document.

- **The document** (`lib/document/`) — `SchemaDocument`, the content model as
  the builder edits it: types (`TypeDoc`, with its `origin` — `builder`, `code`
  or `new`), groups (accordions on the General tab — tabs are built in), and an
  ordered list of `FieldEntry` `{ key, name, spec }`. A `FieldDoc` is the DSL's
  options for one field type as JSON; nothing in it lacks a DSL option.
  `SchemaDocumentEnvelope` is what the server answers: the document, its
  `fingerprint`, the process `bootId` and the editing capabilities.
- **The diff** (`lib/diff/`) — `diffDocuments` → `SchemaChange[]`. Types match
  by name, fields by **key**, so a rename is a `field.rename` rather than a
  remove plus an add, and a retype reports nothing else about the field. One
  file per part (`diff-type-meta`, `diff-type-flags`, `diff-fields`,
  `diff-field-order`), composed by `diffType`. Equality is canonical JSON:
  key order and `undefined` keys never count as a change.
- **The fingerprint** (`lib/fingerprint/`) — two FNV-1a passes over the
  canonical JSON. The optimistic-concurrency token on plan and apply: no crypto
  dependency, the same value in the browser and on the server.
- **The adapters** (`lib/adapters/`) — `toRuleType` turns a document type into
  the kernel's `RuleType` with the DSL's defaults filled in, so
  `checkTypes(types.map(toRuleType))` is the verdict boot would reach.

- **The classification** (`lib/classify/`) — `classify(changes, { after,
facts })` gives every change a `safety` (`safe`, `data`, `destructive`,
  `blocked`), a `reason` key and whether it needs a migration. One classifier
  per change kind; `CLASSIFIERS` is typed exhaustively over `ChangeKind`, so a
  new kind does not compile until it is classified. The domain never queries:
  row counts, grants and references arrive as `ChangeFacts` from the server.
- **The code generator** (`lib/codegen/`) — `renderTypeModule` /
  `renderAll` write a type's module the way a person would: the marker banner,
  the DSL import, one import per related type, then `collection()` /
  `single()` with the DSL's defaults left out and relation targets as
  annotated thunks. Output is valid but one-line; the server runs prettier
  over it. Small functions all the way down — `emitValue`, `objectLiteral`,
  `fieldOptions`, `renderField`, `renderRelationField`, `renderImports`.
- **The apply phases** (`lib/phases/`) — `withoutAdditions` builds the
  removals-only document generated first, so no drizzle-kit diff holds a drop
  and a create on one table (the case where it asks about a rename).

## Conventions

- One responsibility and one main export per file; a file over ~60 lines is a
  signal to split it.
- The first line of every generated file is `MANIFEST_MARKER`
  (`// @orthacms-generated`).
- Test builders live in `src/testing/`, excluded from the library build.

## Commands

- `npx nx test @orthacms/schema-builder-domain`
- `npx nx run-many -t typecheck lint -p @orthacms/schema-builder-domain`

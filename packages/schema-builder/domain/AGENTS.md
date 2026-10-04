# @orthacms/schema-builder-domain

The schema builder's **framework-free kernel**
([ADR-0020](../../../docs/adr/0020-schema-builder-writes-code.md)). Pure
TypeScript with no dependencies at all — the CLI, the server plugin and the
admin import it alike. The design is in
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

## Conventions

- One responsibility and one main export per file; a file over ~60 lines is a
  signal to split it.
- The first line of every generated file is `MANIFEST_MARKER`
  (`// @orthacms-generated`).

## Commands

- `npx nx test @orthacms/schema-builder-domain`
- `npx nx run-many -t typecheck lint -p @orthacms/schema-builder-domain`

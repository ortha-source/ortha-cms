# @orthacms/schema-builder-server

The **schema builder plugin**
([ADR-0020](../../../docs/adr/0020-schema-builder-writes-code.md)). It turns the
running content registry into the editable document the admin page renders,
and — in later steps — plans and applies a change by writing TypeScript under
the host's `src/content/` and a drizzle-kit migration. The design is in
[`docs/design/schema-builder.md`](../../../docs/design/schema-builder.md).

Layout: **layered (ADR-0003)** — `domain / application / infrastructure / http`.
A thin context: no aggregates and no tables. The document, the diff, the
classification and the code generator are framework-free and live in
`@orthacms/schema-builder-domain`; this package is the Nest wiring around them.

## What it serves today

`GET /api/schema-builder/document` (`content:read`, global — no workspace
header) answers a `SchemaDocumentEnvelope`:

- **`document`** — every registered type, in registration order, read from the
  **raw** registry specs (`application/to-document/`). The serializer is the
  wrong source: it reports a computed `localeSync` where the declaration says
  `syncAcrossLocales`, and the document must regenerate the declaration. DSL
  defaults are left implicit (`onDelete` matching `required`, a label equal to
  the name, money's `integer`), so generating code from it writes the same call.
- **`origin`** per type — `builder` when the file at the conventional path
  (`collections/<name>.ts`, `pages/<name>.ts`) starts with
  `// @orthacms-generated`, `code` otherwise, including when there is no file.
  Ownership is part of the document and so of the **fingerprint**: handing a
  file over invalidates a plan made before it.
- **`capabilities`** — `editable`, else a `reason`, in this order: `production`
  (wins over the flag), `disabled` (`SCHEMA_BUILDER` is not `true`),
  `no-source-tree` (no `src/content/index.ts` under `projectRoot`). Plus the
  restart mode the page waits on.
- **`bootId`** — bound per application (`BOOT_ID`), so a restart, and only a
  restart, changes it. The admin polls for that after an apply.

## Configuration

`SchemaBuilderPluginConfig` — `enabled`, `production`, `projectRoot`
(**absolute**; the factory refuses a relative one, because the working
directory is not the app), `contentDir` (default `src/content`, must stay
inside the root) and `restart`. The host resolves `SCHEMA_BUILDER_ROOT`
(default `apps/server`) against the working directory every dev entry point
starts from.

## Rules

- The disk is reached only through the `SourceTree` port. `NodeSourceTree`
  resolves every path inside `projectRoot` and refuses one that escapes it.
- Registered after `ContentPlugin`, whose `CONTENT_REGISTRY` it reads.
- Owns no tables and ships no migrations.

## Commands

- `npx nx test @orthacms/schema-builder-server`
- `npx nx run-many -t typecheck lint -p @orthacms/schema-builder-server`
- The e2e suite: `apps/server-e2e/src/server/schema-builder/`
- The round trip over the reference types (design invariant 9):
  `apps/server/src/content/round-trip.spec.ts`

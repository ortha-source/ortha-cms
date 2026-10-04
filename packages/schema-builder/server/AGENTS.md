# @orthacms/schema-builder-server

The **schema builder plugin**
([ADR-0020](../../../docs/adr/0020-schema-builder-writes-code.md)). It turns the
running content registry into the editable document the admin page renders,
and plans and applies a change by writing TypeScript under
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

## Planning a change

`POST /api/schema-builder/plan` (`schema:manage`, behind `EditableGuard`)
answers a `SchemaPlan` — what an apply of the draft would do — and writes
nothing the app reads:

1. `assertShape` — the body is shaped like a document (400 with every problem).
2. `ChangePlanner` — **fresh** (409 on another fingerprint), **valid** (the
   kernel's `checkTypes`, 422), **owned** (no change to a hand-written type, and
   no draft that relabels one, 422), then **classified** against
   `ContentStats` (row counts, trash included, and workspace grants, read once).
3. A blocked draft is answered, not refused: `blocked: true`, no files, no SQL.
4. Otherwise `StageWriter` mirrors `src/content/` into
   `.orthacms/plan/<uuid>/content`, writes what the builder owns (formatted by
   the app's prettier), deletes removed builder types, and reports the files
   that differ.
5. `PreviewMigration` copies the migrations folder and runs drizzle-kit there
   — the **removals first** (`withoutAdditions`), then the draft — so no diff
   holds a drop and a create on one table.
6. The plan's folder is removed in a `finally`.

## Applying a change

`POST /api/schema-builder/apply` (`schema:manage`, `EditableGuard`) takes the
draft, the plan's fingerprint, a `migrationName` (`^[a-z][a-z0-9_]{0,59}$` — it
ends up in a file name) and `confirmed`, the id of **every** destructive change.
`ApplySchemaUseCase` decides synchronously, under the lock:

- `FileApplyLock` — `.orthacms/apply.lock`, created exclusively, holding the
  owner's pid. A live owner (this process included) → 409 `busy`; a dead one
  (crash, restart mid-apply) is taken over.
- the planner's checks, then `assertNotBlocked` (422 `blocked`) and
  `assertConfirmed` (422 `unconfirmed`, listing exactly what is missing — there
  is no "confirm all").

It answers **202** `{ operationId, bootId }` and `ApplyJob` runs the rest, in
`.orthacms/apply/<id>/`:

1. stage the draft; back up `migrations/` and `src/content/`;
2. **generate** into the real migrations folder through `MigrationPhases` (the
   same two-phase code the plan uses; the removals migration is
   `<name>_removals`);
3. **migrate** — drizzle's migrator on the host's folder and tracking table
   (`migrationsTable`, default `__drizzle_migrations_content`), every pending
   migration in **one transaction**;
4. record `schema.applied` through the outbox (its own unit of work: drizzle's
   migrator commits on its own connection, so the event follows the commit; a
   failure here is logged, not fatal — the schema did change);
5. **publish** — `StagePublisher` writes the changed files into `src/content/`,
   once, last. The dev watcher restarts the server.

A failure before publish puts `migrations/` back from the backup; the database
never moved or rolled back. A failure **during** publish (the database is
ahead of the code) keeps `.orthacms/apply/<id>/backup` and says so
(`publish-failed`). The lock is released in a `finally`.

`GET /api/schema-builder/operations/:id` (`schema:manage`, not behind the
editable guard) reads `.orthacms/operations/<id>.json` — on disk because the
process asked is usually the one the apply restarted into. A `running`
operation recorded by another boot reads as `interrupted`.

### drizzle-kit, read from what it wrote

drizzle-kit 0.31 **exits 0** on a refused rename prompt (no TTY) and on a
schema that does not compile alike, so `readOutcome` decides from the new
`.sql` files and the output, never the exit code. The prompt's wording is
pinned by `drizzle-kit.generator.spec.ts` against the locked version. The run
gets the schema and folder as flags (no config file is written), from the
project root, with a deadline (`generateTimeoutMs`, default 60 s).

prettier and drizzle-kit are resolved from the **app** first
(`resolvePackageBin`), so its versions write its files, and run as child
processes: prettier's CommonJS entry is an `import()` shim.

## Configuration

`SchemaBuilderPluginConfig` — `enabled`, `production`, `projectRoot`
(**absolute**; the factory refuses a relative one, because the working
directory is not the app), `contentDir` (default `src/content`, must stay
inside the root), `migrationsDir` (default `migrations`), `restart` and
`generateTimeoutMs`. Editing also needs the manifest to be the generated one:
a hand-written `src/content/index.ts` reads as `hand-written-manifest`. The host resolves `SCHEMA_BUILDER_ROOT`
(default `apps/server`) against the working directory every dev entry point
starts from.

## Rules

- The disk is reached only through the `SourceTree` port. `NodeSourceTree`
  resolves every path inside `projectRoot` and refuses one that escapes it.
- Registered after `ContentPlugin`, whose `CONTENT_REGISTRY` it reads.
- Owns no tables and ships no migrations.
- Nothing is written under `src/` by a plan, and by an apply only in its last
  step. Scratch work lives in `.orthacms/` (gitignored).
- Type files may import the DSL, packages and each other — nothing else
  relative: the stage is a copy of `src/content/` alone.

## Commands

- `npx nx test @orthacms/schema-builder-server`
- `npx nx run-many -t typecheck lint -p @orthacms/schema-builder-server`
- The e2e suites: `apps/server-e2e/src/server/schema-builder/` — the plan and
  apply suites build real project trees from the harness's types
  (`support/schema-builder.ts`); apply runs real migrations, each scenario in a
  tree and tracking table of its own, and drops what it created
- The round trip over the reference types (design invariant 9):
  `apps/server/src/content/round-trip.spec.ts`

# Schema builder

`@orthacms/schema-builder-domain` · `@orthacms/schema-builder-server` · `@orthacms/schema-builder-admin`

A visual editor for content types that **writes code**. In development it edits the
TypeScript DSL under `src/content/`, has drizzle-kit generate the migration, applies it,
and waits for the dev watcher to restart the server. In production the same page is a
read-only map of the content model.

Decision record: [ADR-0020](../adr/0020-schema-builder-writes-code.md). Design:
[`docs/design/schema-builder.md`](../design/schema-builder.md). Package notes:
[`domain`](../../packages/schema-builder/domain/AGENTS.md),
[`server`](../../packages/schema-builder/server/AGENTS.md),
[`admin`](../../packages/schema-builder/admin/AGENTS.md).

## Contents

- [01. Business description](#01-business-description)
- [02. Composition of the package group](#02-composition-of-the-package-group)
- [03. Roles and permissions](#03-roles-and-permissions)
- [04. Data model — the document, and what lives on disk](#04-data-model--the-document-and-what-lives-on-disk)
- [05. Change classification](#05-change-classification)
- [06. Lifecycle of an apply](#06-lifecycle-of-an-apply)
- [07. Scenarios — how it works step by step](#07-scenarios--how-it-works-step-by-step)
- [08. HTTP API](#08-http-api)
- [09. The admin UI](#09-the-admin-ui)
- [10. Configuration](#10-configuration)
- [11. Security and resilience](#11-security-and-resilience)
- [12. Invariants](#12-invariants)
- [13. Testing checklist](#13-testing-checklist)
- [14. Boundaries of responsibility](#14-boundaries-of-responsibility)
- [15. Where the code and the documentation diverge](#15-where-the-code-and-the-documentation-diverge)

## 01. Business description

### The problem it solves

Content types in Ortha CMS are code (`content:I-01`): a `collection(...)` or `single(...)`
per file, aggregated by a manifest, diffed by drizzle-kit into migrations the host commits.
That keeps the model reviewable, versioned and identical in every environment — and makes the
first hour with a new app a TypeScript exercise: learn the DSL, add a file, run `content sync`,
run `generate`, run `migrate`, restart.

The builder does that hour's typing. An author adds a type or a field through a form, reviews
what will change — the verdict per change, the files, the exact SQL — and applies. What lands
in the repository is what a person would have written by hand: a formatted type module, a
regenerated manifest and a drizzle-kit migration, ready to commit.

### Three properties carry the design

1. **Code stays the source of truth.** The builder has no table of its own and no runtime
   registry. It renders files and lets the ordinary machinery — `ContentPlugin`, drizzle-kit,
   the migrator — do the rest. Delete the builder and every type it made keeps working.
2. **Development only.** Editing needs `SCHEMA_BUILDER=true`, a non-production `NODE_ENV`,
   and the source tree on disk. A deployed server has none of the three and answers `403`.
3. **All or nothing.** The migration runs in one transaction; `src/` is written once, after
   it commits. A failure before that point leaves the database, the migrations folder and the
   source exactly as they were.

### Who sees it

| Who                          | What they get                                                          |
| ---------------------------- | ---------------------------------------------------------------------- |
| Anyone with `content:read`   | `/content-model`: every type, its fields under the entry editor's tabs |
| Administrators (development) | The same page as an editor, plus review, apply and the grant offer     |
| The deployed app             | The read-only page, with "editing is off in production" as the reason  |

### What the builder is not

- **Not a runtime schema.** Nothing changes until the process restarts on the new code.
- **Not a migration tool for data.** Renames, retypes, toggling `i18n`/`publishable` and
  turning the trash off need a data migration; the builder refuses them rather than guessing
  (§05). The author writes those by hand.
- **Not an owner of hand-written code.** It edits only files whose first line is
  `// @orthacms-generated`. A hand-written type is shown, never rewritten.
- **Not a grant.** A new type is granted to no workspace; the admin offers the grant
  afterwards (I-11).
- **Not a form designer.** Tabs are built in (General, Relations, Media, plus plugin tabs);
  a type's `groups` are accordion blocks on General. There is no form preview.

## 02. Composition of the package group

| Package                 | Role                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema-builder-domain` | Framework-free kernel: the `SchemaDocument`, the diff, the fingerprint, change classification, code generation, the two-phase split, the manifest renderer |
| `schema-builder-server` | The plugin: document / plan / apply / operations routes, the source tree, drizzle-kit and prettier as child processes, the lock, the operation log         |
| `schema-builder-admin`  | The `/content-model` page: type rail, field list, field sheet, groups sheet, review drawer, apply progress, grant dialog                                   |

`@orthacms/content-domain` holds the **schema rules** (one rule per file, `checkTypes`) and the
General-tab ordering table. The DSL, the builder server and the builder admin all run that
one rule set (I-10). `@orthacms/cli`'s `content sync` renders the manifest with the domain
package, so a hand-run sync and an apply produce byte-identical files.

### The server package's layout

Layered (ADR-0003). `domain/` holds the ports (`SourceTree`, `CodeFormatter`,
`MigrationGenerator`, `ContentStats`, `ApplyLock`, `OperationLog`, `MigrationRunner`,
`SchemaAudit`) and the error classes, each with a stable `code`. `application/` holds the use
cases (`LoadDocument`, `PlanSchema`, `ApplySchema`, `ReadOperation`), the guards
(`assertShape`, `assertFresh`, `assertValid`, `assertOwned`, `assertNotBlocked`,
`assertConfirmed`), the `ChangePlanner`, the `StageWriter` and the `ApplyJob`.
`infrastructure/` holds the adapters; `http/` the four controllers, the DTOs,
`EditableGuard` and `SchemaBuilderErrorFilter` — one table from an error code to a status.

### What it depends on, and why registration order matters

The server plugin reads the running `ContentTypeRegistry` (content-server), counts rows through
the registry's tables and grants through `workspace_content` (workspaces-server), runs the
host's content migrations through `@orthacms/database`, and gates on identity's
`PermissionsGuard`. It owns **no tables**, so its position in `plugins.ts` decides nothing
about migrations; it is registered after `content-graphql` to sit with the other content
consumers.

## 03. Roles and permissions

| Permission      | Granted to       | What it opens                                                                                                   |
| --------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `content:read`  | every stock role | `GET /schema-builder/document` and the read-only page                                                           |
| `schema:manage` | `admin` only     | `POST /schema-builder/plan`, `POST /schema-builder/apply`, `GET /schema-builder/operations/:id`, and the editor |

`schema:manage` is new with this package (identity's catalogue grew to 37). It is
administrator-only because an apply changes every workspace at once, runs DDL, and writes the
repository.

Permission is necessary, not sufficient. `EditableGuard` runs after `PermissionsGuard` on plan
and apply and refuses with `403 schema-builder.disabled` whenever the capabilities say the
server may not edit — whatever the caller's role (I-01). The admin mirrors both: without
`schema:manage` the page says what editing needs; on a non-editable server it gives the
server's reason.

## 04. Data model — the document, and what lives on disk

The builder owns no database table. Its state is the **source tree** and a scratch folder.

### The document

`SchemaDocument` (`schema-builder-domain`) is the content model as data:
`{ version: 1, types: TypeDoc[] }`. A `TypeDoc` carries `name`, `kind`
(`collection` | `single`), `path` (singles), `label`, `description`, the three flags
(`publishable`, `paranoid`, `i18n`), `groups` and `fields`, plus `origin`:

| `origin`  | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `builder` | The type's file starts with `// @orthacms-generated` — the builder owns it |
| `code`    | Hand-written, or not at the conventional path — shown, never rewritten     |
| `new`     | Added in the draft, not on disk yet                                        |

A field is a `FieldEntry { key, name, spec }`. The **key** is stable through a rename
(`<type>.<name>` for a loaded field, `new:<random>` for a draft one), which is what lets the
diff report a rename rather than a remove plus an add. `spec` is exactly what the DSL's
`*FieldOptions` take; unknown `admin` keys are carried through untouched (I-13).

The envelope `GET /document` answers adds `fingerprint` (16 hex characters over the canonical
document), `bootId` (one per process) and `capabilities` (`editable`, `reason`, `restart`).

### On disk

| Path (relative to the host app)     | Owner                    | Notes                                                                                    |
| ----------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| `src/content/collections/<name>.ts` | builder or author        | Builder-owned files start with the marker; prettier-formatted                            |
| `src/content/pages/<name>.ts`       | builder or author        | Singles                                                                                  |
| `src/content/index.ts`              | builder / `content sync` | The manifest; a hand-written one makes the server non-editable (`hand-written-manifest`) |
| `migrations/` + `migrations/meta/`  | drizzle-kit              | The host's content migrations, tracked in `__drizzle_migrations_content`                 |
| `.orthacms/plan/<uuid>/`            | builder                  | A plan's stage and its drizzle-kit dry run; removed when the plan answers                |
| `.orthacms/apply/<uuid>/`           | builder                  | An apply's stage and backup (`backup/migrations`, `backup/content`)                      |
| `.orthacms/apply.lock`              | builder                  | `{ pid, at }`, created with `wx`                                                         |
| `.orthacms/operations/<uuid>.json`  | builder                  | The operation log the admin polls                                                        |

`.orthacms/` is gitignored and never under `src/` — a write there would restart the server
mid-operation.

### The outbox event

One `schema.applied` per successful apply, aggregate `schema` / the operation id, payload
`{ operationId, actorId, changes: string[], migrations: string[], files: string[] }`. Written
in its own unit of work after the migration commits (drizzle's `migrate()` opens its own
transaction and cannot nest in one).

## 05. Change classification

Every change in the diff gets a verdict and a reason (`classify`, one classifier per change
kind). `storage: false` means no migration is generated for it.

| Change                                                         | Verdict       | Reason                      | Storage |
| -------------------------------------------------------------- | ------------- | --------------------------- | ------- |
| New type                                                       | `safe`        | `new-type`                  | yes     |
| Label, description, page path, groups, field order             | `safe`        | `code-only`                 | no      |
| Field added (optional, or on a publishable type, or a boolean) | `safe`        | `nullable-column`           | yes     |
| Trash turned on                                                | `safe`        | `trash-column`              | yes     |
| Field display options                                          | `safe`        | `code-only`                 | no      |
| Validation rule changed (`min…`, `pattern`, `options`, …)      | `data`        | `constraint-tightened`      | no      |
| `required` changed on a non-publishable type                   | `data`        | `not-null-toggle`           | yes     |
| Relation target, cardinality, `unique`, `onDelete`, inverse    | `data`        | `relation-constraint`       | yes     |
| Field removed                                                  | `destructive` | `drops-data`                | yes     |
| Type removed, unused                                           | `destructive` | `drops-data`                | yes     |
| Type removed while granted or referenced                       | `blocked`     | `type-in-use`               | yes     |
| Required field added to a non-publishable type that has rows   | `blocked`     | `required-on-live-type`     | yes     |
| Field renamed                                                  | `blocked`     | `rename-unsupported`        | yes     |
| Field retyped                                                  | `blocked`     | `retype-unsupported`        | yes     |
| `i18n` or `publishable` toggled, trash turned off              | `blocked`     | `flag-needs-data-migration` | yes     |

"Live" means non-publishable: there `required` is `NOT NULL` (`content:I-07`), so a required
column added to a table with rows would fail the `ALTER` — and the DSL has no default value.

A blocked plan is **answered**, not thrown: the review shows why, files and SQL stay empty.
An apply re-plans and refuses a blocked one with `422 schema-builder.blocked`.

### Two migrations, never a prompt

drizzle-kit asks interactively whether a dropped-and-added column is a rename, and without a
TTY that prompt fails with exit code **0**. So removals are generated first, as their own
migration (`<name>_removals`, from the current model minus what the draft removes), and
everything else second. Neither run can contain both a drop and an add, so neither can ask.
The outcome is read from the new `.sql` files and the output, never from the exit code.

## 06. Lifecycle of an apply

```
POST /apply ──► lock ──► re-plan + checks ──► operation saved (running, generate) ──► 202
                                                 │
                               ApplyJob (after the response)
                                                 ▼
 stage files ─► back up migrations/ + src/content/ ─► generate removals, then the rest
   ─► step: migrate ─► migrate() in one transaction ─► step: publish ─► schema.applied
   ─► copy the stage into src/content/ ─► succeeded ─► scratch folder removed ─► lock released
                                                 │
                         the watcher restarts the process on the new src/
```

| Status        | When                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `running`     | Accepted; `step` is `generate`, `migrate` or `publish`                                                      |
| `succeeded`   | Everything written; `files` and `migrations` list what changed                                              |
| `failed`      | `error: { code, message }`; the migrations folder was restored unless the publish was what failed           |
| `interrupted` | Read as such when a `running` operation was recorded by another process (a crash, or a restart mid-publish) |

A failed **publish** is the one failure after the database moved: the backup is kept under
`.orthacms/apply/<id>/backup` and the error names it, so the author can put `src/content/`
right by hand.

## 07. Scenarios — how it works step by step

### 7.1 An author opens the page

`GET /document`. `LoadDocumentUseCase` turns the running registry into a document, reads each
type file's first line for `origin`, and reads the capabilities: production wins over the
flag; no manifest means no source tree; a manifest without the marker is hand-written. The
admin draws the rail, one type per URL (`/content-model/:typeName`), and its fields under the
built-in tabs, General in the order the entry editor uses (`orderGeneralTab`).

### 7.2 An author adds a type and a field

Every edit is an action on a reducer over the served document (`useSchemaDraft`); the diff
and `checkTypes` run on every change, so a broken rule shows under the field as it is typed,
in the DSL's own words. The rail marks a changed type; leaving the page asks first, moving
between types does not.

### 7.3 Review

`POST /plan` with the draft and the fingerprint it started from. The server checks shape,
freshness (`409 schema-builder.stale` if the model moved), the rules (`422 invalid`) and
ownership (`422 not-owned`); classifies with live facts (row counts, grants, references);
renders every file into `.orthacms/plan/<uuid>/`, prettier-formats it, and runs drizzle-kit
against a copy of the migrations folder to get the SQL. The admin shows a skeleton for those
seconds, then three tabs: changes, files (before/after), SQL.

### 7.4 Apply

Apply stays disabled, with the reason on screen, until nothing is blocked, every destructive
change is ticked on its own, and the migration name matches `^[a-z][a-z0-9_]{0,59}$`. The
server re-runs every check under the lock, saves the operation and answers `202
{ operationId, bootId }`. The admin polls the operation, then the document route until the
**boot id** changes — a `200` from the old process is not the restart. Then it puts the new
document in the cache, invalidates every query derived from the registry, and the draft
starts over from it.

### 7.5 The grant offer

A type the apply created is offered to the active workspaces (`POST /workspaces/:id/content`),
with "Not now" as an equal answer. Nothing is granted implicitly (I-11).

### 7.6 A second apply, or a stale tab

A second apply while one holds the lock gets `409 schema-builder.busy`. A plan or apply from a
tab opened before the last apply gets `409 schema-builder.stale`; the admin's only way on is a
reload, which loses that draft.

### 7.7 A hand-written type

Shown with "hand-written" and how to hand it over (add the marker line). A draft that touches
it is refused with `422 schema-builder.not-owned`. A type file's marker is all ownership is.

## 08. HTTP API

All under the host's `/api` prefix.

| Method & path                        | Guard                             | Input                                                       | Success                                      |
| ------------------------------------ | --------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `GET /schema-builder/document`       | `content:read`                    | —                                                           | `200` envelope                               |
| `POST /schema-builder/plan`          | `schema:manage` + `EditableGuard` | `{ document, baseFingerprint }`                             | `200` `SchemaPlan` (a blocked plan included) |
| `POST /schema-builder/apply`         | `schema:manage` + `EditableGuard` | `{ document, baseFingerprint, migrationName, confirmed[] }` | `202 { operationId, bootId }`                |
| `GET /schema-builder/operations/:id` | `schema:manage`                   | uuid (`ParseUUIDPipe`)                                      | `200` `ApplyOperation`; `404` unknown        |

Errors carry `{ statusCode, code, message, details? }`:

| Code                                 | Status | When                                                        |
| ------------------------------------ | ------ | ----------------------------------------------------------- |
| `schema-builder.disabled`            | 403    | Production, flag off, no source tree, hand-written manifest |
| `schema-builder.invalid-document`    | 400    | The document is malformed                                   |
| `schema-builder.stale`               | 409    | The fingerprint is not the running model's                  |
| `schema-builder.busy`                | 409    | Another apply holds the lock                                |
| `schema-builder.invalid`             | 422    | A schema rule fails                                         |
| `schema-builder.not-owned`           | 422    | The draft changes a hand-written type                       |
| `schema-builder.blocked`             | 422    | Apply of a blocked plan                                     |
| `schema-builder.unconfirmed`         | 422    | A destructive change without its own confirmation           |
| `schema-builder.migration-ambiguous` | 422    | drizzle-kit wanted to ask a question anyway                 |
| `schema-builder.migration-failed`    | 500    | drizzle-kit failed or timed out                             |
| `schema-builder.publish-failed`      | 500    | Writing `src/content/` failed after the migration           |

`baseFingerprint` must be 16 hex characters; `confirmed` holds at most 500 ids.

## 09. The admin UI

`/content-model` and `/content-model/:typeName`, in the global sidebar's directory group
(order 50), gated on `content:read`. Global because types are the same in every workspace.

| Element        | What it does                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Header         | "N unsaved changes", Discard, Review changes (off while the draft breaks a rule)                                                 |
| Type rail      | Every type, its origin, a dot for a changed one; New content type                                                                |
| Type editor    | Settings and flags, the issues, the field list under General (loose fields by rank, then group accordions), Relations, Media     |
| Field sheet    | General (label, machine name, required, localized, lang, relation settings), Validation (only the rules the type takes), Display |
| Groups sheet   | General's accordion blocks — never sections, never tabs                                                                          |
| Review drawer  | Changes / Files / SQL, the per-change confirmation, the migration name, Apply                                                    |
| Apply progress | Three steps in one `role="status"`; a failure is an alert that says the draft is kept                                            |
| Grant dialog   | Active workspaces, Grant / Not now                                                                                               |

### States

No access sends no request. Loading is one `SkeletonRegion` in the page's own chrome and grid
(I-14). An error is an alert with a retry, never an empty rail. An app with no types and no
editing is its own empty state. A read-only server says why in one notice.

### Accessibility details worth keeping

- Reordering works from the handle by keyboard; dnd-kit's announcements are replaced with ones
  that name fields, and a drop on itself says nothing.
- A drop across ranks above the groups is refused (`canMoveField`): the entry editor would
  re-sort it, so the builder will not pretend.
- Apply's disabled state is explained by text tied to the button with `aria-describedby`.
- The modal sheets hide the page from assistive tech; the rail is marked
  `data-keeps-unsaved-changes`, so moving between types is not "leaving".

### Cache keys

`['schema-builder', 'document']`. After an apply the new document is written there and every
query whose key starts with a registry-derived segment (`content-schema`,
`content-schema-list`, `content-filter-fields`, `content-types`) is invalidated
(`isRegistryKey`).

## 10. Configuration

`apps/server/config/schema-builder.ts`:

| Variable                 | Default       | Meaning                                                                |
| ------------------------ | ------------- | ---------------------------------------------------------------------- |
| `SCHEMA_BUILDER`         | `false`       | Ask for editing. Still refused in production and without a source tree |
| `SCHEMA_BUILDER_ROOT`    | `apps/server` | The host app, resolved against the working directory                   |
| `SCHEMA_BUILDER_RESTART` | `watch`       | `manual` when nothing restarts the process on a change to `src/`       |

Plugin config also takes `contentDir` (`src/content`), `migrationsDir` (`migrations`),
`migrationsTable` (`__drizzle_migrations_content`) and `generateTimeoutMs` (60 s). The
factory refuses a relative `projectRoot`.

prettier and drizzle-kit are dependencies of the server package and are run as child
processes, their bins resolved from the host app.

## 11. Security and resilience

- **Production is decided by the server, not the client.** `EditableGuard` reads the same
  capabilities the document reports; the admin's read-only state is a courtesy.
- **No path from the request reaches the file system.** File paths come from type names the
  rules have already validated (`^[a-z][a-z0-9_]*$`) and fixed folders.
- **drizzle-kit cannot hang a request** (I-12): a timeout kills it.
- **The lock survives a crash.** A lock whose `pid` is gone, or that cannot be read, is taken
  over.
- **A restart mid-apply** reads as `interrupted`, not as a `running` forever.
- **Secrets.** Neither drizzle-kit run needs a database: generation diffs snapshots.

## 12. Invariants

The numbering is the design document's; specs that pin one say so in their title
(`[schema-builder:I-05]`).

- **I-01** — With `NODE_ENV=production`, editing off, no source tree or a hand-written
  manifest, plan and apply answer `403` and touch neither files nor the database.
- **I-02** — The builder writes only files carrying `@orthacms-generated`, and the manifest.
- **I-03** — An apply is all-or-nothing: a failure before the publish restores the migrations
  folder, and the migrator's transaction rolls the database back.
- **I-04** — `src/` is written once, after a successful migration, by one step.
- **I-05** — One apply at a time, across processes; a second gets `409 busy`.
- **I-06** — A plan or apply against a stale fingerprint gets `409 stale`.
- **I-07** — Every destructive change is confirmed by its own id; there is no "confirm all".
- **I-08** — SQL is always generated by drizzle-kit, never written by the builder.
- **I-09** — Generating code from the registry's document and loading it again reproduces the
  same serialized schema for every reference type (`apps/server/src/content/round-trip.spec.ts`).
- **I-10** — The admin, the builder server and the DSL validate with one rule set.
- **I-11** — A new type is granted to no workspace implicitly.
- **I-12** — A drizzle-kit run cannot hang a request.
- **I-13** — The builder offers no option the DSL lacks, and preserves unknown `admin` keys.
- **I-14** — Every loading state renders a skeleton in the content's own grid, inside one named
  `role="status"`; error and no-access are separate states.

## 13. Testing checklist

### The gate

- `SCHEMA_BUILDER` unset → the page is read-only with "editing is turned off"; `POST /plan` → `403`.
- `NODE_ENV=production` with `SCHEMA_BUILDER=true` → still `403`.
- An editor without `schema:manage` → `403`; the page says what editing needs.

### Plan

- New type → one `safe` change, a new file, `CREATE TABLE`.
- Remove a field → `destructive`; the SQL drops the column, in a `_removals` migration.
- Rename a field → `blocked`, no files, no SQL.
- Remove a granted type → `blocked` (`type-in-use`).
- Required field on a non-publishable type with rows → `blocked`.
- Draft from before another apply → `409 stale`.
- Draft that touches a hand-written type → `422 not-owned`.

### Apply

- Happy path → `202`; the operation goes `generate → migrate → publish → succeeded`; the
  server restarts; the new type is in the registry and the rail; one `schema.applied` row.
- Destructive change not in `confirmed` → `422 unconfirmed`, nothing written.
- Two applies at once → the second `409 busy`.
- A migration that fails (e.g. the table exists) → `failed`, migrations folder unchanged,
  `src/content/` unchanged, no outbox row.
- Kill the server mid-apply → the operation reads `interrupted` after the restart; the lock is
  taken over.

### The admin

- Loading, error and no-access states are distinct; the skeleton sits in the page's grid.
- Keyboard reorder announces field names; a cross-rank move is refused.
- Apply is disabled with a reason until confirmations and the name are right.
- After an apply the draft is empty, the rail shows the new type, the grant dialog offers only
  active workspaces, and "Not now" grants nothing.

## 14. Boundaries of responsibility

### What this package owns

The document format, the diff and its verdicts, the code generator, the plan and apply
routes, the scratch folder, the lock and the operation log, and the `/content-model` page.

### What it deliberately does not own

- **The content model at runtime** — `ContentTypeRegistry` (content-server).
- **The rules** — `content-domain`'s schema rules, shared with the DSL.
- **Migrations** — drizzle-kit writes them, `@orthacms/database`'s migrator runs them.
- **Grants** — workspaces-server's `workspace_content`; the admin only calls its route.
- **Restarting** — the dev watcher (`npm run dev` / `orthacms dev`).

### What is missing, and why

- Renames, retypes and flag changes beyond the trash: each needs a data migration the builder
  would have to guess.
- Default values, option labels, uniqueness of a scalar, conditional fields: not in the DSL
  yet (I-13 — the DSL first).
- A form preview: the entry editor is the preview.

## 15. Where the code and the documentation diverge

- **`data` verdicts carry no counts.** The design says the review "shows how many" existing
  entries a tightened rule may affect; the plan has row counts for classification but does not
  return them, and the review shows the verdict and reason only.
- **An interrupted publish reads as a failure.** If the watcher restarts the process between
  writing `src/content/` and saving `succeeded` — unlikely, since the rebuild takes seconds —
  the operation reads `interrupted` and the admin reports the apply as stopped, although the
  database and the source moved. Reloading the page shows the truth.
- **A failure between the migration and the publish step restores the migrations folder** even
  though the database already moved — only a failure _of_ the publish keeps the backup. The
  window is one operation-log write.
- **`schema.applied` has no activity mapping.** The event is written to the outbox, but the
  activity log does not render it yet.

# @ortha-cms/content-server

The content-modeling **plugin** for the Ortha CMS server. It turns
**code-defined** content types into physical Postgres tables, holds them in a
runtime **registry**, serves that schema to the admin, and validates entry
values against it. It owns **no database connection and no migrations of its
own** — the HOST owns the generated tables and their migrations (see below).

## The DSL (`collection()` / `single()` + `field.*`)

Content types are declared in code, in the host app (collections in
`apps/server/src/collections`, pages/singles in `apps/server/src/pages`):

```typescript
export const post = collection('post', {
    label: 'Blog posts',
    fields: {
        title: field.text({ required: true, minLength: 3 }),
        author: field.relation({ to: () => author, required: true, onDelete: 'restrict' }),
        tags: field.relation({ to: () => tag, many: true })
    }
});
```

- `collection()` (multi-entry) and `single()` (one entry, routed at `path`)
  normalize options, run `assertName` + `assertFields`, build the tables, and
  return a typed `ContentType`.
- `field.*` field builders (`text`/`richtext`/`number`/`money`/`boolean`/`date`/
  `datetime`/`select`/`multiselect`/`json`/`relation`) each return a JSON-serializable
  `FieldSpec` carrying its value type as a phantom generic (for `InferEntry`).
- `relation({ to })` takes a **lazy thunk** so mutually-referencing collection
  files can import each other. `onDelete` defaults to `'cascade'` when
  `required`, else `'set null'`. A **required single relation with
  `onDelete: 'set null'` is rejected** at define time — a NOT NULL FK can't be
  nulled on delete. `unique: true` makes a single relation **one-to-one** — a
  `UNIQUE` constraint on the `<field>_id` FK (nullable-unique, so unrelated rows
  don't collide); combining it with `many: true` is rejected (a join table has
  no column to constrain).

### Two-way relations (`relationInverse`)

`field.relationInverse({ of: () => owner, field: 'x' })` declares the **inverse**
(back-reference) side of a relation whose storage lives on `owner.x`. It emits
**no column or join table** — reads/writes reuse the owning side's FK/join table
(source/target swapped), so editing either side mutates the same links and they
can't drift. The registry validates the pairing at boot (the referenced field
must be a storage-owning relation on `owner` that points back). Because it's
virtual, adding one produces **no migration**. Defaults to to-many. Two files
referencing each other create a TS *inference* cycle — annotate one thunk's
return `: AnyContentType` to break it (see `apps/server/src/collections/tag.ts`).

### Relation cardinalities

The two storage forms cover all four cardinalities. **many-to-one** is a plain
single relation (`field.relation({ to })`); its inverse is **one-to-many**,
which carries no storage of its own — model it as the single relation on the
"many" side (e.g. `comment.article`). **one-to-one** is a single relation with
`unique: true`. **many-to-many** is `many: true` (the generated join table). See
the reference collections in `apps/server/src/collections` (`article` wires up
`author`, `seo_meta`, `tag`, and `comment`).

### Metadata flags (`publishable` / `paranoid`)

Two optional booleans on `collection()` / `single()` add platform-owned envelope
columns:

- `publishable: true` → a `status` (`draft`/`published`, `DEFAULT 'draft'`)
  **and** a nullable `published_at` (timestamptz) column — the two halves of the
  publish workflow. A **non-publishable** type has neither: it carries no publish
  state and every row is simply live.
- `paranoid: true` → a nullable `deleted_at` (timestamptz) column (soft delete).

`published_at`/`deleted_at` are **nullable with no default** (null = "not yet
published" / "not deleted"; the service layer stamps them). `status`,
`published_at`, and `deleted_at` are
**reserved unconditionally** — an author cannot define a field that maps to them
(rejected by `assertFields`), and a client cannot set them (they aren't in
`type.fields`, so `EntryValidationService` rejects them as unknown keys). The
flags are carried on `ContentType` and serialized in the schema summary.

## Generated storage (`buildTables`)

One `content_<name>` table per type; one `content_<name>_<field>` join table per
**many-relation**. Every table carries the base envelope: `id`, `workspace_id`
(plain uuid, no FK — the `workspaces` table is identity-owned; entries are
scoped to it in the app layer, see HTTP surface), `created_at`, `updated_at`.
A `publishable` type additionally gets `status` (`draft`/`published`) +
`published_at`; a `paranoid` type gets `deleted_at`. The list index is
`(workspace_id, status)` for publishable types, else `(workspace_id)`.
A required `boolean` gets `DEFAULT false`. Field/column collisions (two fields
snake-casing to the same column, a field clashing with a relation's `<field>_id`,
or a reserved envelope column) are rejected by `assertFields`.

**Required ⇒ NOT NULL only for non-publishable types.** A publishable type has a
draft stage, so its required fields stay **nullable** columns — "required" means
"required *to publish*", enforced by `EntryValidationService` at publish time, not
the DB (else an incomplete draft couldn't be saved). A non-publishable type is
always live, so its required fields are `NOT NULL`. `EntryWriterService` mirrors
this: create/update validate eagerly only for non-publishable types; publish
re-validates the stored row for publishable ones.

## The `/define` vs main-barrel split — IMPORTANT

Collection files and the host's drizzle-kit schema entry MUST import from
`@ortha-cms/content-server/define`, **not** the main barrel. drizzle-kit bundles
the schema's whole import graph with plain esbuild, which rejects the NestJS
decorators the main barrel pulls in via its controllers. `/define` re-exports
only the decorator-free DSL (`collection`, `single`, `field`, `joinTableOf`, types).

## Migrations are HOST-owned

This package emits no migrations. The HOST (`apps/server`) re-exports every
generated table from `src/content.ts` (use `joinTableOf(type, field)`
for join tables — it throws if a many-relation was renamed, instead of silently
dropping the table from the diff), runs `db:generate` against its own
`drizzle.config.ts`, and commits the SQL. `ContentPlugin({ types, migrations })`
carries a `migrations` descriptor (`__drizzle_migrations_content`) so the
standard `db:migrate` applies them with every other plugin's.

## HTTP surface (`/api/content-schema`, `/api/content`)

**Every `/content/:typeName…` entry route is workspace-scoped.** Each carries
identity's `WorkspaceGuard` (after `OriginGuard`/`PermissionsGuard`, so a request
rejected for CSRF or lacking permission never incurs the membership DB probe): it reads
the `X-Workspace-Id` header (400 if missing/malformed), 403s a caller who isn't a
member of that workspace, and exposes the id via `@CurrentWorkspace()`. The
entries services thread it through — `create` stamps `workspace_id`, and the
list + every read/write/bulk op filters by it — so an entry never leaks across
workspaces and an id from another workspace reads as a 404. The
`/content-schema` routes are **not** scoped (content types are code-defined and
global).

- `GET /content-schema` — summaries of every type (wizard-compatible).
- `GET /content-schema/:name` — the full field schema (types, validation, admin
  props); 404 if unknown.
- `GET /content/:typeName` — one page of a collection's entries
  (`?search=&filter=&sort=&page=&pageSize=&deleted=` → `{ items, total, page, pageSize }`).
  Resolves `:typeName` via the registry (404 if unknown), then runs the **generic**
  pipeline in `entries/` (`EntriesService`): an ILIKE search over text-like
  columns, the query-builder `?filter=` tree (translated against a `FilterSchema`
  **derived per-request** from the type's fields by `buildEntryFilterSchema`), a
  whitelisted sort with an `id` tiebreaker, and `LIMIT/OFFSET`. `status` is
  searchable/filterable/sortable and returned **only on publishable types**;
  paranoid types exclude soft-deleted rows by default, or list **only** them with
  `?deleted=only` (the trash view). A malformed filter → 400.
- **Entry writes** (`EntryWriterService`, generic over the type like the reader;
  `entry-row.ts` holds the shared row↔record mappers). All validate via
  `EntryValidationService` — a failure is **422** with `{ message, issues:
  [{ field, message }] }`. Each resolves `:typeName` (404), guards state-changing
  requests with `OriginGuard` (CSRF), and is permission-gated:
    - `POST /content/:typeName` — create a draft (`content:create`). The insert
      runs in a transaction that first takes the workspace's **shared** advisory
      lock (`lockWorkspaceShared` from identity), coordinating with the workspace
      delete / content-revoke emptiness guards (which take it exclusively) so a
      new entry can't be orphaned by a concurrent delete/revoke.
    - `GET /content/:typeName/:id` — read one live entry (`content:read`).
    - `PATCH /content/:typeName/:id` — replace values (`content:update`).
    - `POST /content/:typeName/:id/publish` · `/unpublish` — stamp/clear
      `status`+`published_at`; publish **re-validates the stored row**; 400 on a
      non-publishable type (`content:publish`).
    - `DELETE /content/:typeName/:id` — soft delete (paranoid) or hard delete;
      `POST .../restore` + `DELETE .../permanent` for paranoid types
      (`content:delete`).
    - `POST /content/:typeName/bulk/{publish/preview,publish,unpublish,delete,restore,purge}` —
      `{ ids }` batch ops; `publish/preview` is a dry run returning a per-entry
      verdict (will-publish / already-published / blocked+issues / not-found),
      and `publish` re-validates and publishes only the valid drafts.
- **Routing order matters:** `BulkEntriesController` is registered **before** the
  single-item controllers in `ContentModule.forRoot` so the literal `bulk`
  segment wins over `:id` (single-item `:id` also carries `ParseUUIDPipe` as a
  backstop). Many-relation values aren't persisted yet (skipped by `toColumns`,
  matching the reader) — relation writes land with the relations UI.
- Reads gated `@RequirePermissions(PERMISSIONS.CONTENT_READ)`; writes on the
  matching `content:create`/`update`/`publish`/`delete` (admin holds all,
  contributor create/update/publish, viewer read-only).

## Architecture

- `ContentModule.forRoot(registry)` is **global** and exports the
  `CONTENT_REGISTRY` token + `EntryValidationService`. `ContentPlugin({ types })`
  builds the registry **eagerly** — duplicate names and unresolvable relation
  targets throw at construction, failing boot rather than the first request.
- It **binds identity's ports** to the registry: `CONTENT_CATALOG` (the type
  catalogue, so `GET /api/content-types` + the workspace-grant flow see the real
  code-defined types) and `CONTENT_ENTRY_COUNTER` (an `EntryCounterService`
  counting a type's rows in a workspace — and the workspace's total across all
  types — so identity's "revoke a content grant only when empty" and "delete a
  workspace only when it holds no content" checks see the real stored entries).
  Same inversion as `ACTIVITY_RECORDER` — identity owns the port, this plugin
  binds it.
- Register **after** `DatabasePlugin` + `IdentityPlugin` (it uses identity's
  `PermissionsGuard` and, for the entries list, the shared Drizzle client).
  Depends on `@ortha-cms/identity-server` (guards), `@ortha-cms/bootstrap-server`,
  `@ortha-cms/database` (`@InjectDatabase()` in `EntriesService`), and
  `@ortha-cms/utils-server` (the `?filter=` engine).
- `EntryValidationService` is the server-side authority for entry values (the
  admin renders the same rules as a courtesy). `EntryWriterService` calls it on
  every create/update and re-checks the stored row before any publish, so nothing
  invalid is written or published.
- Follows the `server-plugin` skill: feature-then-kind layout, thin controllers,
  permission-by-constant, JSDoc on exports, `interface` for contracts.

## Commands

- `npx nx typecheck @ortha-cms/content-server` / `npx nx lint @ortha-cms/content-server`
- Migrations are generated on the **host**: `npx nx run server:db:generate --name=<change>`

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
  nulled on delete.

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
(plain uuid, no FK until workspace scoping lands), `created_at`, `updated_at`.
A `publishable` type additionally gets `status` (`draft`/`published`) +
`published_at`; a `paranoid` type gets `deleted_at`. The list index is
`(workspace_id, status)` for publishable types, else `(workspace_id)`.
A required `boolean` gets `DEFAULT false`. Field/column collisions (two fields
snake-casing to the same column, a field clashing with a relation's `<field>_id`,
or a reserved envelope column) are rejected by `assertFields`.

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

- `GET /content-schema` — summaries of every type (wizard-compatible).
- `GET /content-schema/:name` — the full field schema (types, validation, admin
  props); 404 if unknown.
- `GET /content/:typeName` — one page of a collection's entries
  (`?search=&filter=&sort=&page=&pageSize=` → `{ items, total, page, pageSize }`).
  Resolves `:typeName` via the registry (404 if unknown), then runs the **generic**
  pipeline in `entries/` (`EntriesService`): an ILIKE search over text-like
  columns, the query-builder `?filter=` tree (translated against a `FilterSchema`
  **derived per-request** from the type's fields by `buildEntryFilterSchema`), a
  whitelisted sort with an `id` tiebreaker, and `LIMIT/OFFSET`. `status` is
  searchable/filterable/sortable and returned **only on publishable types**;
  paranoid types exclude soft-deleted rows. A malformed filter → 400.
- All gated `@RequirePermissions(PERMISSIONS.CONTENT_READ)` (`content:read`,
  granted to all three system roles).

## Architecture

- `ContentModule.forRoot(registry)` is **global** and exports the
  `CONTENT_REGISTRY` token + `EntryValidationService`. `ContentPlugin({ types })`
  builds the registry **eagerly** — duplicate names and unresolvable relation
  targets throw at construction, failing boot rather than the first request.
- Register **after** `DatabasePlugin` + `IdentityPlugin` (it uses identity's
  `PermissionsGuard` and, for the entries list, the shared Drizzle client).
  Depends on `@ortha-cms/identity-server` (guards), `@ortha-cms/bootstrap-server`,
  `@ortha-cms/database` (`@InjectDatabase()` in `EntriesService`), and
  `@ortha-cms/utils-server` (the `?filter=` engine).
- `EntryValidationService` is the server-side authority for entry values (the
  admin renders the same rules as a courtesy). It is exported but not yet wired
  to a write controller — that lands with the entry CRUD milestone.
- Follows the `server-plugin` skill: feature-then-kind layout, thin controllers,
  permission-by-constant, JSDoc on exports, `interface` for contracts.

## Commands

- `npx nx typecheck @ortha-cms/content-server` / `npx nx lint @ortha-cms/content-server`
- Migrations are generated on the **host**: `npx nx run server:db:generate --name=<change>`

# @ortha-cms/content-server

The content-modeling **plugin** for the Ortha CMS server. It turns
**code-defined** content types into physical Postgres tables, holds them in a
runtime **registry**, serves that schema to the admin, and validates entry
values against it. It owns **no database connection and no migrations of its
own** — the HOST owns the generated tables and their migrations (see below).

## The DSL (`collection()` / `single()` + `f.*`)

Content types are declared in code, in the host app (`apps/server/src/collections`):

```typescript
export const post = collection('post', {
    label: 'Blog posts',
    fields: {
        title: f.text({ required: true, minLength: 3 }),
        author: f.relation({ to: () => author, required: true, onDelete: 'restrict' }),
        tags: f.relation({ to: () => tag, many: true })
    }
});
```

- `collection()` (multi-entry) and `single()` (one entry, routed at `path`)
  normalize options, run `assertName` + `assertFields`, build the tables, and
  return a typed `ContentType`.
- `f.*` field builders (`text`/`richtext`/`number`/`money`/`boolean`/`date`/
  `datetime`/`select`/`json`/`media`/`relation`) each return a JSON-serializable
  `FieldSpec` carrying its value type as a phantom generic (for `InferEntry`).
- `relation({ to })` takes a **lazy thunk** so mutually-referencing collection
  files can import each other. `onDelete` defaults to `'cascade'` when
  `required`, else `'set null'`. A **required single relation with
  `onDelete: 'set null'` is rejected** at define time — a NOT NULL FK can't be
  nulled on delete.

## Generated storage (`buildTables`)

One `content_<name>` table per type; one `content_<name>_<field>` join table per
**many-relation**. Every table carries the envelope: `id`, `workspace_id`
(plain uuid, no FK until workspace scoping lands), `status` (`draft`/`published`),
`created_at`, `updated_at`, plus a `(workspace_id, status)` index. A required
`boolean` gets `DEFAULT false`. Field/column collisions (two fields snake-casing
to the same column, or a field clashing with a relation's `<field>_id` or an
envelope column) are rejected by `assertFields`.

## The `/define` vs main-barrel split — IMPORTANT

Collection files and the host's drizzle-kit schema entry MUST import from
`@ortha-cms/content-server/define`, **not** the main barrel. drizzle-kit bundles
the schema's whole import graph with plain esbuild, which rejects the NestJS
decorators the main barrel pulls in via its controllers. `/define` re-exports
only the decorator-free DSL (`collection`, `single`, `f`, `joinTableOf`, types).

## Migrations are HOST-owned

This package emits no migrations. The HOST (`apps/server`) re-exports every
generated table from `src/collections/schema.ts` (use `joinTableOf(type, field)`
for join tables — it throws if a many-relation was renamed, instead of silently
dropping the table from the diff), runs `db:generate` against its own
`drizzle.config.ts`, and commits the SQL. `ContentPlugin({ types, migrations })`
carries a `migrations` descriptor (`__drizzle_migrations_content`) so the
standard `db:migrate` applies them with every other plugin's.

## HTTP surface (`/api/content-schema`)

- `GET /content-schema` — summaries of every type (wizard-compatible).
- `GET /content-schema/:name` — the full field schema (types, validation, admin
  props); 404 if unknown.
- Both gated `@RequirePermissions(PERMISSIONS.CONTENT_READ)` (`content:read`,
  granted to all three system roles).

## Architecture

- `ContentModule.forRoot(registry)` is **global** and exports the
  `CONTENT_REGISTRY` token + `EntryValidationService`. `ContentPlugin({ types })`
  builds the registry **eagerly** — duplicate names and unresolvable relation
  targets throw at construction, failing boot rather than the first request.
- Register **after** `DatabasePlugin` + `IdentityPlugin` (it uses identity's
  `PermissionsGuard`). Depends on `@ortha-cms/identity-server` (guards) and
  `@ortha-cms/bootstrap-server`; owns no `@ortha-cms/database` dependency.
- `EntryValidationService` is the server-side authority for entry values (the
  admin renders the same rules as a courtesy). It is exported but not yet wired
  to a write controller — that lands with the entry CRUD milestone.
- Follows the `server-plugin` skill: feature-then-kind layout, thin controllers,
  permission-by-constant, JSDoc on exports, `interface` for contracts.

## Commands

- `npx nx typecheck @ortha-cms/content-server` / `npx nx lint @ortha-cms/content-server`
- Migrations are generated on the **host**: `npx nx run server:db:generate --name=<change>`

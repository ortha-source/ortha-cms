# apps/server

The **API** — a NestJS application. Like the admin app, this is a thin entry
point: it holds almost no logic. It assembles the product by handing a list of
**server plugins** to the `@ortha-cms/bootstrap-server` host.

## What's here

- `src/plugins.ts` — the **plugin registry**. Adding a feature to the API means
  registering its `ServerPlugin` here, in order (the `database` plugin must come
  first — it opens the connection in `onPluginInit`). This is the file you edit
  most.
- `ortha.config.ts` — host config. This project is the migration host: the
  inferred `db:migrate` target applies every plugin's pending migrations.
- `src/content/` — the host's **code-defined content types** (see below).

## Content types (`src/content/`)

The host defines its content model here — the collections and pages the
`ContentPlugin` serves, and whose generated tables the host owns.

- `src/content/index.ts` — the **one aggregation point**. It exports the
  `contentTypes` array (which `plugins.ts` registers with `ContentPlugin`) and
  **re-exports every generated table** for drizzle-kit to diff.
- `src/content/collections/` — one file per collection (a `collection(...)`).
- `src/content/pages/` — one file per single page (a `single(...)`).

**Adding a type:** create a file under `content/collections/` or
`content/pages/`, then in `content/index.ts` add it to `contentTypes` **and**
re-export its table(s). drizzle-kit only diffs **top-level table exports**, so a
table not re-exported from `index.ts` is silently absent from migrations
(many-relation join tables via `joinTableOf` included). Then
`npx nx run server:db:generate --name=<change>` and commit the SQL —
`drizzle.config.ts` points `schema` at `src/content/index.ts`.

## How it fits

- The host (`createServer({ plugins })`) runs each plugin's `onPluginInit`,
  imports its NestJS module, and applies the global `/api` prefix + a
  `ValidationPipe`.
- Cross-cutting guards are global: `AuthGuard` (session), `PermissionsGuard`
  (RBAC), `OriginGuard` (CSRF on state-changing POSTs).
- Each plugin owns its Drizzle schema + migrations; the shared
  `@ortha-cms/database` plugin owns the single connection.

## Working here

- Authoring or changing a server plugin is governed by the **`server-plugin`**
  skill (`ServerPlugin` factory + dynamic module, feature-then-kind layout,
  `@InjectDatabase()` DI, schema/migrations descriptor, and the authorization /
  data-integrity invariants).
- Migrations: `npx nx run <plugin>:db:generate --name=<name>` to generate,
  `npx nx run server:db:migrate` to apply. Commit emitted SQL.
- E2E coverage lives in `apps/server-e2e` (testcontainer + supertest) — see the
  **`server-e2e`** skill.
- Common back-end traps: `.cursor/BUGBOT.md` (Server section).

See [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) for the full picture.

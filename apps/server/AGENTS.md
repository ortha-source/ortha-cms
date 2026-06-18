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

# @ortha-cms/identity-server

The identity **plugin** for the Ortha CMS server. It is the foundational
package: it answers *"who is this person?"* (authentication) and *"what are they
allowed to do?"* (roles & access control). Invite-only by design — there is no
public registration.

It currently defines its **persistence model** — the Drizzle schema in
`src/lib/schema` (workspaces, users, roles, permissions, memberships, sessions,
tokens) — and **ships its migrations** (`drizzle.config.ts` + committed
`migrations/`, applied by `@ortha-cms/nx`'s `db:migrate`). It also **seeds the
system roles** (`admin`/`contributor`/`viewer`) idempotently on boot and
protects them from deletion (RBAC, FR-6). Behaviour is still partly pending:
auth, sessions, tokens, user management, the `can()` check, and first-admin
bootstrap land in later tickets (epic #3).

## Package

- Name: `@ortha-cms/identity-server`
- Import: `import { IdentityPlugin } from '@ortha-cms/identity-server'`
- Grouped package (`packages/identity/server`), server-only. Consumed from
  source like the other workspace packages (`exports` → `./src/index.ts`,
  `customConditions: ["@ortha-cms/source"]`).

## Conventions

- Uses `interface` for type contracts (not `type`)
- All exported symbols have JSDoc comments
- No `.js` extensions in TypeScript imports
- Plain functions go in `src/lib/utils/`; the NestJS module in `src/lib/`;
  types in `src/lib/types/`; RBAC policy (the system-roles constant, seeder,
  `RolesService`, errors) is grouped under `src/lib/rbac/`
- Always import types with the `type` keyword
- `experimentalDecorators` and `emitDecoratorMetadata` are enabled

## Key exports

- `IdentityPlugin(config, deps)` — factory returning a `ServerPlugin`; register
  it **after** `DatabasePlugin` (identity is DB-backed). `deps.getDb` supplies
  the Drizzle client (§5). Seeds system roles in `onPluginInit`.
- `IdentityPluginConfig` — secrets + session/token settings (public contract)
- `IdentityPluginDeps` — `{ getDb }`, the host-supplied client accessor
- `IdentityServerPlugin` — the plugin shape, with `identityConfig` attached
- `IdentityModule` — global NestJS module; provides config, the db client, and
  `RolesService`
- `SYSTEM_ROLES` / `PERMISSION_KEYS` — the v1 role↔permission matrix; the single
  source `seedSystemRoles`, `can()`, and tests all read from
- `seedSystemRoles(db)` — idempotent seeder run from `onPluginInit`
- `RolesService` — role operations; rejects deletion of `isSystem` roles

## Architecture

- **Plugin, not an app.** Mirrors `@ortha-cms/database`: exposes
  `IdentityPlugin(config)` returning the standard
  [`ServerPlugin`](../../bootstrap/server/src/lib/types/server-plugin.ts) shape,
  wired by the host in `apps/server/src/main.ts`.
- **Global DI.** `IdentityModule.forRoot(config, deps)` is `global: true`, so
  identity services are injectable from any plugin module without an import. The
  resolved config and the Drizzle client are provided under internal
  `IDENTITY_CONFIG` / `IDENTITY_DB` tokens (kept out of the public surface until
  a consumer outside this package injects them).
- **Lifecycle.** `onPluginInit` idempotently seeds the system roles. It runs
  after `DatabasePlugin.onPluginInit` (plugins run in array order), so the
  connection is live. Idempotent first-admin bootstrap (FR-10) attaches here
  once #16 lands.
- **RBAC seeding.** `seedSystemRoles` writes the permission catalogue, the three
  roles, and their grants in one transaction, each via `ON CONFLICT DO NOTHING`
  — so it is idempotent and concurrency-safe across simultaneously booting
  instances. Admin holds the **enumerated** full permission set (no wildcard, by
  decision); a new permission is a two-line edit to `SYSTEM_ROLES`. Deletion of
  `isSystem` roles is blocked in `RolesService` via an `is_system = false` SQL
  guard (atomic, not check-then-act).

## Decisions (recorded for the epic)

- **DB-client acquisition (§5).** Identity depends only on the Drizzle **client
  type** (`NodePgDatabase`), never on `@ortha-cms/database`. Chosen and now
  **implemented**: identity defines its own `IDENTITY_DB` token, and the host
  passes a `getDb` accessor via `IdentityPluginDeps` (see
  `apps/server/src/plugins.ts`, which supplies `() => getDatabase()`). Rejected:
  reusing `DATABASE_TOKEN` (runtime coupling to the database *plugin*, violating
  §5).
- **Cross-origin cookies (deferred to #8).** Admin (`:4200`) and API (`:3000`)
  are different origins, and `createServer` configures no CORS. The
  `cookieSameSite` default (`lax`) assumes a **same-origin deployment or a dev
  proxy** (preferred — proxy `/api` → `:3000` in `apps/admin/vite.config.ts`).
  The alternative is separate origins with CORS — if taken, a `cors` option
  belongs on `createServer` (host transport concern), not here. The login ticket
  (#8) owns this decision.
- **Secrets.** `sessionSecret` and `tokenSecret` are kept **distinct** by
  design. They may be empty at boot in this scaffold (no signing yet);
  **fail-fast validation must be added when signing is introduced** (#8/#10).

## Not owned here

- **DB connection / migration *execution*** — receives a Drizzle client; owns
  neither the connection nor the apply step (the host + `@ortha-cms/nx`'s
  `db:migrate` do that). Identity **does** own its schema and migration *files*
  (`src/lib/schema`, `drizzle.config.ts`, the committed `migrations/`), which
  `db:generate` produces.
- **Email / SMTP** — identity emits events / exposes a port; the host delivers
  (#11).
- **CLI** — `bootstrapFirstAdmin(...)` will be a plain method taking the DB
  client; no argv, prompts, or console output (#16).

## Configuration

Config flows from `apps/server/ortha.config.ts` (`plugins.identity`, env-sourced)
into the plugin:

```typescript
// apps/server/src/main.ts
createServer({
    plugins: [
        DatabasePlugin({ connectionString: config.database.url }),
        IdentityPlugin(config.plugins.identity)
    ]
});
```

## Commands

- `npm exec nx typecheck @ortha-cms/identity-server`
- `npm exec nx lint @ortha-cms/identity-server`

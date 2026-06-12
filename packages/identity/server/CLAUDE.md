# @ortha-cms/identity-server

The identity **plugin** for the Ortha CMS server. It is the foundational
package: it answers _"who is this person?"_ (authentication) and _"what are they
allowed to do?"_ (roles & access control). Invite-only by design — there is no
public registration.

It currently defines its **persistence model** — the Drizzle schema in
`src/lib/schema` (workspaces, workspace_content, users, roles, permissions, memberships, sessions,
tokens) — and **ships its migrations** (`drizzle.config.ts` + committed
`migrations/`, applied by `@ortha-cms/nx`'s `db:migrate`). It also **seeds the
system roles** (`admin`/`contributor`/`viewer`) idempotently on boot and
protects them from deletion (RBAC, FR-6). It also handles **email/password
login & logout**: the `auth/` feature (`LoginController`, `MeController`,
`LogoutController`, plus `AuthService` / `SessionService` / `CookieService`)
verifies credentials with bcrypt and opens a DB-backed, revocable session
delivered as an `httpOnly` cookie (#8); logout revokes the presented session
(per-device, idempotent) and clears the cookie. It also **provisions the root
admin** on boot from host config (`root-admin/`, FR-10): when `rootAdmin` is
set, `RootAdminService` (driven by `RootAdminSeeder`) idempotently ensures one
`active` user holding the `admin` role (non-destructive — an existing email is
left untouched). It **enforces authentication app-wide**: an `AuthGuard` is
registered as the global `APP_GUARD`, so every route requires a valid session
unless marked `@Public()` (login/logout are); it resolves the session cookie to
the user, attaches it, and exposes it to handlers via `@CurrentUser()`. It also
**enforces permissions**: `PermissionsGuard` + `@RequirePermissions('…')` 403 a
route unless the user's role grants every listed permission (resolved by
`PermissionsService.forRole`), and `GET /auth/me` returns the user's permission
keys so the admin can gate UI to match. Behaviour is still partly pending:
tokens and full user management land in later tickets (epic #3).

## Package

- Name: `@ortha-cms/identity-server`
- Import: `import { IdentityPlugin } from '@ortha-cms/identity-server'`
- Grouped package (`packages/identity/server`), server-only. Consumed from
  source like the other workspace packages (`exports` → `./src/index.ts`,
  `customConditions: ["@ortha-cms/source"]`).

## Conventions

- Uses `interface` for type contracts (not `type`) — except a derived/mapped
  type (e.g. a `Pick<typeof users.$inferSelect, …>`), which is a `type`
- All exported symbols have JSDoc comments
- No `.js` extensions in TypeScript imports
- **Group by feature, then by kind within the feature.** Each domain owns one
  folder under `src/lib/`; inside it, files are bucketed by kind into
  `controllers/`, `services/`, `guards/`, `seeders/`, plus `dto/` and `errors/`
  — one class per file. Today:
    - `auth/` — `controllers/` (`login`/`logout`/`me`), `services/` (`AuthService`
      / `SessionService` / `HashingService` / `CookieService`), `guards/`
      (`OriginGuard`, `AuthGuard`), `decorators/` (`@Public()`, `@CurrentUser()`),
      `dto/`, `errors/`.
    - `rbac/` — `services/` (`RolesService`), `seeders/` (`SystemRolesSeeder` +
      its `seedSystemRoles` helper), `errors/`, and the `system-roles.ts`
      role/permission matrix at the feature root (non-class data).
    - `root-admin/` — `services/` (`RootAdminService`), `seeders/`
      (`RootAdminSeeder`), `errors/`.
    - `workspaces/` — `controllers/` (`create`/`list`/`check-slug`, all on
      `/api/workspaces`), `services/` (`WorkspaceService`), `dto/`, `errors/`.
      Backs the admin create-wizard: creates a workspace + memberships + content
      grants, lists workspaces with members, and checks slug availability. The
      owner comes from the session; the wizard's per-member role is ignored
      (membership is a pure link — see `memberships`).
    - `users/` — `controllers/` (`search` → `GET /api/users?q=`), `services/`
      (`UserService`), `dto/`. The directory the wizard's member typeahead reads.
    - `content/` — a `ListContentTypesController` (`GET /api/content-types`) over
      a **mock** `CONTENT_TYPES` registry at the feature root. Placeholder until
      a real content-modeling plugin ships; also the source the workspace create
      flow expands an "all content" grant against.
  Non-class feature **data** (e.g. the role matrix) stays at the feature root,
  not in a kind-folder. `src/lib/utils/` is for **package-level** cross-cutting
  only (the plugin factory); the NestJS module + tokens sit at `src/lib/`;
  shared types in `src/lib/types/`. Full rationale lives in the `server-plugin`
  skill.
- Always import types with the `type` keyword
- `experimentalDecorators` and `emitDecoratorMetadata` are enabled

## Key exports

- `IdentityPlugin(config)` — factory returning a `ServerPlugin`; register it
  **after** `DatabasePlugin` (identity injects the db from that plugin's global
  module)
- `IdentityPluginConfig` — secrets + session/token settings (public contract)
- `IdentityServerPlugin` — the plugin shape, with `identityConfig` attached
- `IdentityModule` — global NestJS module; provides config and the RBAC services
  (`RolesService`, `SystemRolesSeeder`)
- `SYSTEM_ROLES` / `PERMISSION_KEYS` — the v1 role↔permission matrix; the single
  source `seedSystemRoles`, `can()`, and tests all read from
- `seedSystemRoles(db)` — idempotent seeder, invoked by `SystemRolesSeeder`
- `RolesService` — role operations; rejects deletion of `isSystem` roles
- `RootAdminService` — idempotent, non-destructive root-admin bootstrap (FR-10):
  `ensure(email, password, name?)` returns `'created' | 'exists'`;
  `bootstrapFromConfig()` reads `config.rootAdmin` and is invoked by
  `RootAdminSeeder` on boot. `name` is stored only when the row is first created.
  `IdentityRootAdminConfig` is its host-config contract.

## Architecture

- **Plugin, not an app.** Mirrors `@ortha-cms/database`: exposes
  `IdentityPlugin(config)` returning the standard
  [`ServerPlugin`](../../bootstrap/server/src/lib/types/server-plugin.ts) shape,
  wired by the host in `apps/server/src/main.ts`.
- **Global DI.** `IdentityModule.forRoot(config)` is `global: true`, so identity
  services are injectable from any plugin module without an import. The config is
  provided under an internal `IDENTITY_CONFIG` token (in a dependency-free
  `identity.tokens.ts`). The Drizzle client is injected straight from
  `@ortha-cms/database`'s global `DatabaseModule` with `@InjectDatabase()` —
  identity registers no db provider of its own. Annotate the injected client as
  `Database` (re-exported from `@ortha-cms/database`), not `NodePgDatabase`, so a
  dialect change stays a one-line edit in that package.
- **Lifecycle.** Seeding runs from `SystemRolesSeeder`, a provider implementing
  NestJS `OnApplicationBootstrap`, so the Drizzle client is **injected** rather
  than pulled from a pre-app hook. The hook fires inside `app.init()` — after
  every module is wired, before the server listens — so seeding finishes before
  any request is served and a failure aborts boot. `RootAdminSeeder` follows the
  same pattern (FR-10), declared **after** `SystemRolesSeeder` so the `admin`
  role exists when it runs. (`onPluginInit` is intentionally unused by identity
  now — it predates the DI graph.)
- **RBAC seeding.** `seedSystemRoles` writes the permission catalogue, the three
  roles, and their grants in one transaction, each via `ON CONFLICT DO NOTHING`
  — so it is idempotent and concurrency-safe across simultaneously booting
  instances. Admin holds the **enumerated** full permission set (no wildcard, by
  decision); a new permission is a two-line edit to `SYSTEM_ROLES`. Deletion of
  `isSystem` roles is blocked in `RolesService` via an `is_system = false` SQL
  guard (atomic, not check-then-act).

## Decisions (recorded for the epic)

- **DB-client acquisition (§5 — superseded).** The original scaffold decided
  identity must never import `@ortha-cms/database`, depending only on the Drizzle
  client _type_. **Retired:** identity now depends on `@ortha-cms/database` and
  injects the client with `@InjectDatabase()` — the consumption pattern that
  plugin documents. Rationale for the reversal: the decoupling only paid off if
  identity ran against a _different_ db provider, which is not a goal — the
  database plugin is the sole provider, and the ORM is fixed (Drizzle).
  Dialect-portability is instead handled narrowly: consumers annotate with the
  `Database` alias (owned by `@ortha-cms/database`), so a dialect change is a
  one-line edit there, not a sweep. (Inherently dialect-bound bits remain: the
  `pg-core` schema and pg-specific query methods like `onConflictDoNothing`.)
- **Cross-origin cookies (settled in #8 — same-origin dev proxy).** Admin
  (`:4200`) and API (`:3000`) are different origins, and `createServer`
  configures no CORS. #8 took the **dev-proxy** path: `apps/admin/vite.config.mts`
  proxies `/api` → `:3000`, so the browser sees one origin and the session
  cookie (`httpOnly`, `SameSite=lax`) is first-party with no CORS. The rejected
  alternative was separate origins with CORS + `SameSite=none` — if ever taken,
  a `cors` option belongs on `createServer` (host transport concern), not here.
- **Session cookie is unsigned, token hashed at rest (#8).** The cookie carries
  only the opaque 256-bit random token; every request re-validates it against
  the DB (`revokedAt`/`expiresAt`), so there is nothing to forge and no signing
  is needed. Consequently `sessionSecret` stays **unconsumed** for now — its
  fail-fast validation moves to whichever ticket first signs something (tokens,
  #10). The `sessions` PK stores the **SHA-256 of** the token, not the token, so
  a read-only DB/backup leak yields no usable sessions (`SessionService` hashes
  on write and on lookup; no migration — the column is still `text`).
- **Login hardening (#8).** `/auth/login` is guarded by `ThrottlerGuard`
  (10/min, in-memory — per-instance; needs a shared store + Express `trust
proxy` at scale) against brute-force and bcrypt CPU-DoS, and by `OriginGuard`,
  which rejects browser requests whose `Origin` is not in
  `config.allowedOrigins` (login-CSRF defense; missing-`Origin` non-browser
  clients pass). Still **deferred**: a CSRF token for higher-value mutations,
  `helmet` security headers (host concern), and expired-session pruning.
- **Secrets.** `sessionSecret` and `tokenSecret` are kept **distinct** by
  design. They may be empty at boot today (sessions are unsigned, see above);
  **fail-fast validation must be added when signing is introduced** (#10).

## Not owned here

- **DB connection / migration _execution_** — injects the Drizzle client from
  `@ortha-cms/database`; owns neither the connection nor the apply step (that
  plugin + `@ortha-cms/nx`'s `db:migrate` do that). Identity **does** own its
  schema and migration _files_
  (`src/lib/schema`, `drizzle.config.ts`, the committed `migrations/`), which
  `db:generate` produces.
- **Email / SMTP** — identity emits events / exposes a port; the host delivers
  (#11).
- **CLI** — root-admin bootstrap is env/config-driven (`RootAdminService.ensure`
  takes no argv/prompts/console output, run by `RootAdminSeeder` on boot). An
  interactive CLI / break-glass command is not provided here.

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

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

> **Layered per ADR-0003 (tactical DDD inside plugins).** This is Wave 2 of the
> migration — the foundational, highest-blast-radius context. Because **108
> import sites** across the repo pin identity's public barrel (`src/index.ts`),
> the migration is deliberately **conservative**: the barrel is preserved
> **byte-identical** and every public symbol keeps its name, type, and
> signature. The invariant-bearing core is extracted into
> `domain / application / infrastructure`; the stable public/composition surface
> (`auth/`, `rbac/`, `root-admin/`, `activity/`, `schema/`) keeps its
> feature-then-kind layout so the barrel paths never move.

## Layered layout (the invariant core)

New tactical-DDD layers under `src/lib/`, alongside the retained feature folders:

```
domain/          # framework-free core — the one hard rule below
  user-account.ts                  # UserAccount aggregate (status lifecycle + credential)
  user-account.repository.ts       # UserAccountRepository PORT + USER_ACCOUNT_REPOSITORY
  session.ts                       # Session entity (validity, framework-free)
  session-policy.ts                # SessionPolicy (expiry + lastUsedAt throttle rules)
  session.repository.ts            # SessionRepository PORT + SESSION_REPOSITORY
  access-policy.ts                 # AccessPolicy domain service — the pure RBAC decision
  value-objects/                   # UserId, Email, PasswordHash, UserAccountStatus, Permission
  events/identity-events.ts        # domain-event factory + kinds (user.* / auth.*)
  errors/                          # transport-agnostic domain errors
application/     # orchestration — one use case per state change
  use-cases/                       # login / logout / refresh-session / change-password
infrastructure/  # adapters — the only layer that knows Drizzle/pg
  persistence/  # DrizzleUserAccountRepository, UserAccountMapper, DrizzleSessionRepository
  queries/      # UserLookupQuery (thin auth/credentials read side)
```

### The one hard rule

**`domain/` imports NOTHING from `@nestjs/*`, `drizzle-orm`, `class-validator`,
or `infrastructure/`.** It may use `@ortha-cms/database`'s framework-free
`createDomainEvent`/`DomainEvent` and node built-ins only. The layer-boundary
lint isn't wired yet — self-enforce it.

### The aggregate, entity, and policies

- **`UserAccount`** is the aggregate root — a person who can authenticate,
  mapping to identity's `users` row (an `Email`, a `UserAccountStatus`, and an
  optional `PasswordHash`). Its guarded methods own the lifecycle invariants:
  `activate` (pending → active, setting the first credential), `disable`
  (active → disabled), `enable` (disabled → active), and `changeCredential`
  (any non-disabled account); each raises a `user.*` domain event. Cross-account
  rules (last-admin protection) and self-action guards need knowledge the
  aggregate doesn't hold, so the **users** context owns those flows — identity's
  aggregate models the single-account lifecycle only.
- **`Session`** is an entity + **`SessionPolicy`** holds the expiry and
  `lastUsedAt`-refresh-throttle rules lifted out of the old session service into
  a pure, DB-free object (constructed with the configured TTL).
- **`AccessPolicy`** is the pure RBAC decision — `can(actor, permission, scope?)`
  / `canAll(...)` — unit-tested without Nest or Postgres. `PermissionsGuard`
  resolves the actor's grants via `PermissionsService.forRole` and **delegates
  the decision to `AccessPolicy`**; both keep their exact public signatures
  (`PERMISSIONS` / `PermissionsService` / the guard's `canActivate` are
  unchanged). `AccessPolicy` is exported from the global module so a consuming
  plugin's `@UseGuards(PermissionsGuard)` can resolve it (same reason
  `PermissionsService` is exported).

### Ports & adapters

- `UserAccountRepository` (`USER_ACCOUNT_REPOSITORY`) → `DrizzleUserAccountRepository`
  over the `users` table; `UserAccountMapper` is the row ⇄ aggregate ACL.
- `SessionRepository` (`SESSION_REPOSITORY`) → `DrizzleSessionRepository` over the
  `sessions` table — the SHA-256-hashed-token store the old `SessionService`
  was, now behind a port and using `SessionPolicy` for expiry.

### Unit of work + outbox + the audit transition

Each state-changing use case runs inside `UnitOfWork.run` (one transaction) over
the repository ports + `OutboxWriter`. Login/logout keep their exact behavior —
the timing-flat credential check, the same generic `InvalidCredentialsError`,
the per-device idempotent revoke — and still record their `user.signed_in` /
`user.signed_out` **audit** rows **in-band** through the `ACTIVITY_RECORDER`
token, so the log stays correct and gap-free. They **also** now emit
`auth.signed_in` / `auth.signed_out` (and the aggregate emits `user.*`) to the
transactional outbox; with no subscriber yet those auto-mark dispatched
(harmless). **Do NOT double-record.** Wave 3 moves auditing onto an outbox
subscriber and drops the in-band `recorder.record(...)` calls. Like the users
context, the domain-event kinds (`auth.*` / `user.*`) are kept **distinct** from
the in-band audit kinds, so that move maps between the two catalogues.

`ACTIVITY_RECORDER` (the emit-side port identity **owns**) is **unchanged** — same
symbol, `ActivityRecorder` / `ActivityRecordInput` / `ActivityExecutor` types,
and `@Optional()` injection. `root-admin/` is untouched (a service + boot seeder);
the bootstrap path is not on the DDD critical path.

### Barrel-stability guarantee

`src/index.ts` is **byte-identical** to before this refactor — including
`export * from './lib/schema'`. `schema/` stays at `src/lib/schema/` (owned by
identity, migrated by `@ortha-cms/nx`) precisely to keep that re-export verbatim;
conceptually it is identity's persistence layer. Every guard, decorator, service,
error, and type the barrel exports keeps its path, so no consumer import moved.

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
    - `workspaces/` — `controllers/` (`create`/`list`/`check-slug`/`update`/
      `set-status` (archive+unarchive)/`delete`/`add-member`/`remove-member`/
      `add-content`/`remove-content`, all on `/api/workspaces`), `services/`
      (`WorkspaceService` + granular `SlugService`/`MembershipService`/
      `ContentGrantService`), `guards/` (`WorkspaceGuard`), `decorators/`
      (`@CurrentWorkspace()`), `dto/`, `errors/`. Backs the admin create-wizard
      **and the settings page**: creates a workspace + memberships + content
      grants, lists workspaces with members, checks slug availability, and edits
      an existing workspace — `PATCH /:id` (name/description/color,
      `workspaces:update`), `POST /:id/archive` + `/unarchive` (status,
      `workspaces:update`), `DELETE /:id` (permanent, `workspaces:delete`;
      **409s while the workspace still holds any content entries**, so a delete
      never orphans records — the emptiness check and the delete run in one
      transaction under an **exclusive per-workspace advisory lock** that entry
      creates take in shared mode, closing the count-then-write race),
      `POST`/`DELETE /:id/members[/:userId]`, and
      `POST /:id/content` + `DELETE /:id/content/:slug` (grant/revoke a content
      type; revoke **409s unless the type is empty in the workspace**, checked
      via the `CONTENT_ENTRY_COUNTER` port). Two read-only pre-check endpoints
      back the admin's block-before-you-act dialogs:
      `GET /:id/content/:slug/entry-count` (per-type, `workspaces:update`) and
      `GET /:id/entry-count` (whole-workspace total, `workspaces:delete`). Each
      mutation records its own
      `workspace.*` audit event. There is **no per-workspace owner** — access is
      purely the global role's permissions, and membership is a pure link with
      no role (the creator is just the first member; any member is removable with
      `workspaces:update`). It also
      provides the **workspace-scoping** primitives other plugins reuse:
      `WorkspaceGuard` reads the `X-Workspace-Id` header, 400s a missing/malformed
      id and 403s a non-member (`MembershipService.isMember`), then exposes the id
      via `@CurrentWorkspace()`. Both are exported from the barrel and the guard
      is provided in the global module (like `PermissionsGuard`), so a feature
      plugin (e.g. content) guards its workspace-owned routes with
      `@UseGuards(WorkspaceGuard)` + `@CurrentWorkspace()`.
    - `users/` — `controllers/` (`search` → `GET /api/users?q=`), `services/`
      (`UserService`), `dto/`. The directory the wizard's member typeahead reads.
    - `content/` — a `ListContentTypesController` (`GET /api/content-types`) and
      two **ports**: `CONTENT_CATALOG` (`content-catalog.ts`, what types exist)
      and `CONTENT_ENTRY_COUNTER` (`content-entry-counter.ts`, how many entries
      of a type a workspace holds). The controller and the workspace create flow
      (an "all content" grant) resolve the catalogue against whatever binds it —
      `@ortha-cms/content-server`'s code-defined registry in the assembled app —
      falling back to the `CONTENT_TYPES` mock at the feature root when no
      content plugin is present. The counter backs the "revoke a content grant
      only when empty" rule (a missing binding means zero entries, so the type
      reads as empty). Same inversion as `ACTIVITY_RECORDER`: identity owns the
      ports, the plugin binds them, so the package graph stays acyclic.
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

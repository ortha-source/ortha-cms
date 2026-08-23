# @orthacms/identity-server

The identity **plugin** for the Ortha CMS server. It is the foundational
package: it answers _"who is this person?"_ (authentication) and _"what are they
allowed to do?"_ (roles & access control). Invite-only by design — there is no
public registration; the only route into an account is an admin's invite,
redeemed through the accept pair below.

It currently defines its **persistence model** — the Drizzle schema in
`src/lib/schema` (workspaces, workspace_content, users, roles, permissions, memberships, sessions,
tokens) — and **ships its migrations** (`drizzle.config.ts` + committed
`migrations/`, applied by `@orthacms/nx`'s `db:migrate`). It also **seeds the
system roles** (`admin`/`contributor`/`viewer`) idempotently on boot and
protects them from deletion (RBAC, FR-6). It also handles **email/password
login & logout**: the `auth/` feature (`LoginController`, `MeController`,
`LogoutController`, plus `AuthService` / `SessionService` / `CookieService`)
verifies credentials with bcrypt and opens a DB-backed, revocable session
delivered as an `httpOnly` cookie (#8); logout revokes the presented session
(per-device, idempotent) and clears the cookie. It also handles **invite acceptance** — the pair that turns a `pending` row into
an account that can sign in: `GET /auth/invite/:token` describes who a link is
for (read-only, so opening it twice is fine) and `POST /auth/invite/accept` sets
the first credential, activates the account, and returns a session cookie. Both
are `@Public()` + throttled; accept also passes `OriginGuard`. **Only a password
is collected** — the email, name, and role were fixed by the inviting admin, and
the DTO's `forbidNonWhitelisted` rejects any attempt to smuggle a different one.
Every failure mode (unknown / expired / already-accepted / revoked) raises the
same `InvalidInviteTokenError` and renders as one bare 404, so the endpoints
cannot be used to probe for live invites. The one-time guarantee is a
**conditional** `consumedAt` write in `DrizzleInviteRepository.consume` — of two
concurrent accepts exactly one gets a row back, so a link can never activate an
account twice. Issuing invites stays with the users context; identity owns the
`tokens` table and the redemption. It also handles **password reset** — the redemption half of the
admin-driven flow (`users-server` mints the link): `GET /auth/reset/:token`
names the account a link opens (read-only, so opening it twice is fine) and
`POST /auth/reset` sets the new credential and revokes **every** live session
the account holds. Both are `@Public()` + throttled; the redemption also passes
`OriginGuard`. It deliberately issues **no** session — the caller has proven
only that they hold a link, so they finish at the sign-in form — and it accepts
only an `active` account: a `pending` one has no credential to rotate (that is
the invite flow) and a `disabled` one is locked out by design, so resetting it
would quietly reopen a path an admin closed. Every failure mode raises the same
`InvalidResetTokenError` and renders as one bare 404. The one-time guarantee is
the same conditional `consumedAt` write the invite path uses, and the `reset`
rows of `tokens` are reached through their own `PasswordResetRepository` port
whose `type = 'reset'` predicate is load-bearing: an invite token must never
open the reset path. It also **provisions the root
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
  invite.repository.ts             # InviteRepository PORT + INVITE_REPOSITORY (find + burn)
  password-reset.repository.ts     # PasswordResetRepository PORT + PASSWORD_RESET_REPOSITORY
  session.ts                       # Session entity (validity, framework-free)
  session-policy.ts                # SessionPolicy (expiry + lastUsedAt throttle rules)
  session.repository.ts            # SessionRepository PORT + SESSION_REPOSITORY
  access-policy.ts                 # AccessPolicy domain service — the pure RBAC decision
  value-objects/                   # UserId, Email, PasswordHash, UserAccountStatus, Permission
  events/identity-events.ts        # domain-event factory + kinds (user.* / auth.*)
  errors/                          # transport-agnostic domain errors
application/     # orchestration — one use case per state change
  use-cases/                       # login / logout / refresh-session / change-password
                                   # + describe-invite / accept-invite
                                   # + describe-password-reset / reset-password
infrastructure/  # adapters — the only layer that knows Drizzle/pg
  persistence/  # DrizzleUserAccountRepository, UserAccountMapper, DrizzleSessionRepository,
                # DrizzleInviteRepository, DrizzlePasswordResetRepository
  queries/      # UserLookupQuery (thin auth/credentials read side)
```

### The one hard rule

**`domain/` imports NOTHING from `@nestjs/*`, `drizzle-orm`, `class-validator`,
or `infrastructure/`.** It may use `@orthacms/database`'s framework-free
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
- **Credential rotation revokes sessions.** `ChangePasswordUseCase` writes the
  new hash **and** revokes the account's live sessions in the same unit of work,
  because a session is a bearer credential the *old* password opened and it
  outlives that password by its full TTL — so changing a phished password
  without this would leave every session the attacker holds signed in for up to
  a week. `keepSessionId` spares the caller's own device. The
  `user.password_changed` event carries the actor and the eviction count, and
  the activity plugin's audit subscriber maps it to a `user.password_changed`
  row. `ResetPasswordUseCase` applies the same rule from the reset link, and
  spares **nothing** — there is no "caller's own device" when the caller is
  unauthenticated. `ChangePasswordUseCase` itself still has no HTTP route (the
  self-service change lands later); `apps/server-e2e/.../change-password.spec.ts`
  drives it out of DI so the flow is not left unexercised until one appears.
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
- `PasswordResetRepository` (`PASSWORD_RESET_REPOSITORY`) →
  `DrizzlePasswordResetRepository` over the `reset` rows of `tokens`. The same
  two operations as the invite port, kept separate because the two flows
  collapse to different errors and because the `type` predicate is the thing
  stopping an invite token from redeeming as a reset. `ResetPasswordUseCase`
  reads the token **before** opening its transaction and again inside it: bcrypt
  costs ~250ms, so hashing under the transaction would hold a write lock for it,
  and hashing before looking at the token would let anyone spend that CPU with a
  junk link. The pre-read is advisory — the conditional `consume` is still what
  makes the link one-time.
- `InviteRepository` (`INVITE_REPOSITORY`) → `DrizzleInviteRepository` over the
  `invite` rows of `tokens`. Two operations, both on the accept path:
  `findPendingByTokenHash` (unconsumed **and** unexpired, joined to the user) and
  `consume` — a single conditional `UPDATE … WHERE consumed_at IS NULL
RETURNING`, never a read-then-write. The raw token never reaches the port;
  callers hash it first, like sessions and API tokens.

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
identity, migrated by `@orthacms/nx`) precisely to keep that re-export verbatim;
conceptually it is identity's persistence layer. Every guard, decorator, service,
error, and type the barrel exports keeps its path, so no consumer import moved.

## Package

- Name: `@orthacms/identity-server`
- Import: `import { IdentityPlugin } from '@orthacms/identity-server'`
- Grouped package (`packages/identity/server`), server-only. Consumed from
  source like the other workspace packages (`exports` → `./src/index.ts`,
  `customConditions: ["@orthacms/source"]`).

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
    - `api-tokens/` — the **external-API bearer tokens** (layered, not
      feature-then-kind): `domain/` (the `read`/`full` scope → permission-set
      map), `application/` (`ApiTokenService` — mint/verify/list/revoke),
      `infrastructure/persistence/` (`DrizzleApiTokenRepository` over
      `api_tokens` + `api_token_workspaces`), `http/` (`ApiTokensController` +
      `dto/`). Only the
      **SHA-256 hash** of a token is stored (same `HashingService.hashToken`
      primitive as sessions) plus a non-secret `lookupPrefix` for display; the
      plaintext is returned by `mint` **once** and never again. A token is
      scoped to a **bucket of workspaces**, not one: `api_token_workspaces` is
      the join (PK `(token_id, workspace_id)`, cascading on the token, no
      cross-plugin FK on the workspace), the create body takes `workspaceIds`
      (at least one; duplicates collapsed), and every read returns the row and
      its bucket together as an `ApiTokenRecord` — so no caller can observe a
      token scoped to nothing. Because there is no FK, the ids are checked
      against the `WORKSPACE_DIRECTORY` **port** (identity owns it, the
      workspaces plugin binds `WorkspaceExistenceQuery` — the `ACTIVITY_RECORDER`
      inversion, keeping the graph acyclic): a bucket naming a workspace that
      does not exist 400s instead of minting a row that points at nothing. The
      check is **existence, not status** — an archived workspace is a legitimate
      scope — and it is skipped when nothing binds the port, since with no
      workspaces plugin there is no directory to consult. `?workspaceId=` on the list is a bucket-membership
      test, so a multi-workspace token appears under each of its workspaces
      (once each). The management
      routes `POST`/`GET`/`DELETE /api/api-tokens` are **session**-authenticated
      and gated on `tokens:create|read|delete`, which only `admin` holds — they
      are not reachable with a bearer token. Mint and revoke each run in a
      **unit of work** and append an `api_token.created` / `api_token.revoked`
      domain event, which the activity plugin maps to a `token.created` /
      `token.revoked` audit row: a long-lived key to workspace content has to be
      accountable, and a token that existed while its audit row did not would be
      exactly the credential nobody can explain. The event payload carries the
      name, scope, bucket and the non-secret `lookupPrefix` — **never** the
      secret or its hash, since `api_tokens` stores only a SHA-256 precisely so
      no other table yields a usable credential. A replayed (idempotent) revoke
      appends nothing, because only the call that actually killed a live token
      is an event. `verify` rejects unknown, revoked,
      and expired tokens identically (no enumeration signal) and refreshes
      `last_used_at` fire-and-forget on a 60s throttle. The guard that
      authenticates `Authorization: Bearer` ships with the public content API it
      protects — `@orthacms/content-server`'s `public-api/`, which consumes
      `ApiTokenService` plus the RBAC primitives this barrel exports
      (`PERMISSIONS_KEY`, `Permission`, `AccessPolicy`, `Actor`) so its scope
      check *is* the same decision the session `PermissionsGuard` makes.
    - `users/` — `controllers/` (`search` → `GET /api/users?q=`), `services/`
      (`UserService`), `dto/`. The directory the wizard's member typeahead reads.
    - `content/` — a `ListContentTypesController` (`GET /api/content-types`) and
      two **ports**: `CONTENT_CATALOG` (`content-catalog.ts`, what types exist)
      and `CONTENT_ENTRY_COUNTER` (`content-entry-counter.ts`, how many entries
      of a type a workspace holds). The controller and the workspace create flow
      (an "all content" grant) resolve the catalogue against whatever binds it —
      `@orthacms/content-server`'s code-defined registry in the assembled app —
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
  module). Its `docs` contribution declares the API's two security schemes —
  `session` (the `ortha_session` cookie) and `apiToken` (bearer) — which the
  host merges into the OpenAPI document; identity owns authentication, so it
  owns their description too
- `IdentityPluginConfig` — secrets + session/token settings (public contract)
- `IDENTITY_CONFIG` / `InjectIdentityConfig()` — the config token, exported
  because `users-server`'s invite issuer reads `token.inviteTtlSeconds` from it
  (it previously hard-coded 7 days, silently ignoring the host's setting)
- `MIN_PASSWORD_LENGTH` / `MAX_PASSWORD_LENGTH` / `passwordByteLength` — the
  credential-length rule (12 … 72). The two bounds are counted in **different
  units on purpose**: the floor in characters, the ceiling in **UTF-8 bytes**,
  because 72 bytes is bcrypt's truncation point and we reject rather than
  silently truncate, so what the user typed is what protects them. Enforce the
  ceiling with `@MaxByteLength`, never `class-validator`'s `@MaxLength` — that
  counts UTF-16 code units, so it waves through `'é'.repeat(72)` (72 characters,
  **144 bytes**) and bcrypt then hashes only the first half of the passphrase.
  `HashingService.hashPassword` throws `PasswordTooLongError` as the backstop for
  the paths that have no DTO (`ChangePasswordUseCase`, the root-admin bootstrap
  reading `ORTHA_ROOT_ADMIN_PASSWORD`)
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

- **Plugin, not an app.** Mirrors `@orthacms/database`: exposes
  `IdentityPlugin(config)` returning the standard
  [`ServerPlugin`](../../bootstrap/server/src/lib/types/server-plugin.ts) shape,
  wired by the host in `apps/server/src/main.ts`.
- **Global DI.** `IdentityModule.forRoot(config)` is `global: true`, so identity
  services are injectable from any plugin module without an import. The config is
  provided under an internal `IDENTITY_CONFIG` token (in a dependency-free
  `identity.tokens.ts`). The Drizzle client is injected straight from
  `@orthacms/database`'s global `DatabaseModule` with `@InjectDatabase()` —
  identity registers no db provider of its own. Annotate the injected client as
  `Database` (re-exported from `@orthacms/database`), not `NodePgDatabase`, so a
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
  identity must never import `@orthacms/database`, depending only on the Drizzle
  client _type_. **Retired:** identity now depends on `@orthacms/database` and
  injects the client with `@InjectDatabase()` — the consumption pattern that
  plugin documents. Rationale for the reversal: the decoupling only paid off if
  identity ran against a _different_ db provider, which is not a goal — the
  database plugin is the sole provider, and the ORM is fixed (Drizzle).
  Dialect-portability is instead handled narrowly: consumers annotate with the
  `Database` alias (owned by `@orthacms/database`), so a dialect change is a
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
  is needed. The `sessions` PK stores the **SHA-256 of** the token, not the
  token, so a read-only DB/backup leak yields no usable sessions
  (`SessionService` hashes on write and on lookup; no migration — the column is
  still `text`).
- **Account status is checked on every request, not just at login.** A suspended
  member is locked out at three points: `LoginUseCase` refuses to open a session
  for a non-`active` account, users-server's disable revokes their live sessions
  in the same transaction, and `AuthService.currentUser` resolves a session
  **only** to an `active` user. The third is defense in depth for the window
  where a session outlives the suspension — a login committing concurrently with
  a disable inserts its row after that revoke's snapshot — and for any future
  path that flips `status` without revoking. All of it reads as a plain `401`,
  so a suspended account is indistinguishable from an expired session.
- **Login hardening (#8).** `/auth/login` is guarded by `ThrottlerGuard`
  (10/min, in-memory — per-instance; needs a shared store at scale) against
  brute-force and bcrypt CPU-DoS, and by `OriginGuard`,
  which rejects browser requests whose `Origin` is not in
  `config.allowedOrigins` (login-CSRF defense; missing-`Origin` non-browser
  clients pass). The throttle buckets on `req.ip`, which is only the **client's**
  address if the host set Express `trust proxy` — `createServer`'s `trustProxy`
  option, sourced from `TRUST_PROXY`. It is a host concern (identity never sees
  the adapter), but it is identity's failure when it is missing: behind a proxy
  every caller reports the same address, so the deployment shares one bucket and
  one attacker's ten requests a minute lock every user out of login. Covered by
  `apps/server-e2e/src/server/auth/login-throttle.spec.ts`, which boots the app
  both ways. Still **deferred**: a CSRF token for higher-value mutations,
  `helmet` security headers (host concern), and expired-session pruning.
- **There is no signing secret, and none is missing (ORT-149).** Sessions
  (`drizzle-session.repository.ts`, `login.use-case.ts`) and API tokens
  (`api-token.service.ts`) are `randomBytes(32)` checked against a row. 256 bits
  of CSPRNG output validated against stored state is a sound design — arguably
  better than an HMAC, because revocation is a `DELETE` rather than a key
  rotation that invalidates everyone.

  `IdentityPluginConfig` used to require `sessionSecret` and `tokenSecret`,
  documented as signing session cookies and one-time tokens. **Nothing read
  either.** Measured: booting with both empty issues a working session, and a
  cookie minted under the previous "real" secret is still accepted after the
  reboot — the tell that the secret was never part of the answer. Both are now
  gone from the config type, the host's `ortha.config.ts`, `.env.example` and
  the scaffolder.

  The defect was never the mechanism; it was a configuration surface describing
  a different one. An operator would generate two high-entropy values, store
  them in a secret manager, and put "rotate the session secret" in their
  incident runbook — all inert. On a real incident they would rotate, see live
  sessions survive, and reasonably conclude the rotation had failed. **If
  signing is ever introduced** (e.g. storing only a keyed hash so a database
  read cannot replay a session), the key comes back as a real field *with*
  boot-time validation, since an empty one would then be a genuine
  vulnerability.

## Not owned here

- **DB connection / migration _execution_** — injects the Drizzle client from
  `@orthacms/database`; owns neither the connection nor the apply step (that
  plugin + `@orthacms/nx`'s `db:migrate` do that). Identity **does** own its
  schema and migration _files_
  (`src/lib/schema`, `drizzle.config.ts`, the committed `migrations/`), which
  `db:generate` produces.
- **Email / SMTP** — identity emits events / exposes a port; the host delivers
  (#11). Until then nothing sends an invite **or reset** link: `users-server`
  returns the raw token from the mint endpoints and the admin hands the link
  over. This is also why there is no self-service "forgot password" route — a
  public form that mints a link has nowhere to send it, and returning the token
  to whoever asked would hand any anonymous caller a takeover link for any email
  they can name. The recovery path therefore runs through an admin, who can be
  asked to vouch for the person, until a mailer exists.
- **CLI** — root-admin bootstrap is env/config-driven (`RootAdminService.ensure`
  takes no argv/prompts/console output, run by `RootAdminSeeder` on boot). An
  interactive CLI / break-glass command is not provided here.

## Single sign-on (the seam)

Identity also **authenticates against an external identity provider**. The port
itself lives in `@orthacms/identity-domain` so an adapter can depend on it
without depending on this package; what lives here is everything that turns a
verified profile into an Ortha session
([ADR-0012](../../../docs/adr/0012-sso-provider-port.md)).

Three routes, all `@Public()` and rate-limited:

| Route | Does |
| --- | --- |
| `GET /api/auth/sso` | The registered providers, for the sign-in page's buttons. `[]` when none — an answer, not a 404. |
| `GET /api/auth/sso/:provider/start` | Opens an attempt, sets the attempt cookie, 302s to the provider. |
| `GET /api/auth/sso/:provider/callback` | Verifies, resolves the account, opens a session, 302s into the admin. |

Two tables, both shipped in this package's `migrations/`: `sso_identities` (the
link, unique on `(provider, subject)` and on `(provider, user_id)`) and
`sso_auth_requests` (one in-flight attempt).

### Five things here that are decisions, not details

- **The core mints `state`, `nonce` and the PKCE verifier**, never the adapter.
  CSRF and replay defence is one rule, implemented once where it is tested once.
- **Attempt state is a row, not a signed cookie.** This plugin documents the
  absence of a signing secret as a decision (see `IdentityPluginConfig`), and
  handshake state was not going to be the thing that reintroduces one. `id` is
  the SHA-256 of the browser's opaque token, exactly like `sessions.id`.
- **`OriginGuard` is absent from the callback, deliberately.** It is a top-level
  GET from a third party with no `Origin` header. The attempt cookie plus the
  echoed `state` are what protect it.
- **The attempt is burned *before* the token exchange**, and the exchange runs
  outside any transaction. Burning after would let a replay drive a second
  exchange; exchanging inside a transaction would hold a write lock across a
  call to a third party. `CompleteSsoUseCase`'s doc comment reads the ordering
  as one sequence, and it is worth reading before changing any of it.
- **Every refusal is one `SsoLoginFailedError`**, rendered as one redirect to
  `?error=sso`. The caller is anonymous and the provider is not: told apart,
  these failures would let anyone who can authenticate at a public provider
  discover which addresses hold accounts here.

### What it will not do

It signs in accounts that **already exist and are `active`**. It creates none,
and it changes nobody's role. A first sign-in may claim an existing account only
when the provider asserts the email is **verified**; a `pending` or `disabled`
account is refused exactly as it is on the password path. Just-in-time
provisioning and group-to-role mapping are the next phase, opt-in, and behind a
required email-domain allow-list.

### Registering a provider

At the composition root, in `IdentityPlugin`'s **second** argument — config holds
the typed view of the environment, and an adapter instance is not an environment
value:

```typescript
IdentityPlugin(config.plugins.identity, {
    sso: {
        providers: [{ name: 'google', provider: createGoogleProvider({ … }) }]
    }
});
```

The name appears in the route and in every link row, so renaming a registration
orphans the links naming it. `ssoCallbackUrl(config, name)` builds the exact
callback URL to register with the provider — exact because most providers match
that string byte for byte, and a trailing slash is a different URL to them.

`IdentityPlugin` **refuses to boot** with providers registered and
`session.cookieSameSite: 'strict'`: a strict cookie is not sent on the
provider's cross-site redirect back, so every sign-in would fail with a generic
error and nothing in the response would say why.

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

- `npm exec nx typecheck @orthacms/identity-server`
- `npm exec nx lint @orthacms/identity-server`

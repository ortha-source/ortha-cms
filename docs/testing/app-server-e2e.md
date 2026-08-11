# server-e2e — Test Artifact

> **Unit:** `apps/server-e2e` · **Package:** `@ortha-cms/server-e2e` (private) · **Kind:** app (test harness)
> **Source of truth:** `apps/server-e2e/AGENTS.md`, `.agents/skills/server-e2e/SKILL.md`
> **Findings verified:** 2026-08-11 — 15 confirmed · 0 deleted · 8 corrected · 2 unverified
> **Generated:** 2026-08-11

> **This artifact tests the tests.** The unit under audit is the in-process testcontainer +
> supertest harness that 851 API test cases run on. A defect here does not break one endpoint;
> it makes every suite that depends on it dishonest. Findings are graded by *how much false
> confidence they manufacture*. Unlike its front-end sibling, this harness boots the **real**
> NestJS app against a **real** Postgres — so its risk profile is not mock drift but
> **isolation, lifecycle and seeding fidelity**.

---

## 1. Scope & Preconditions

### What this unit owns

- The Jest project config, including the serialisation policy (`jest.config.cts`).
- **Container lifecycle** — one `postgres:16-alpine` testcontainer per run, and the per-plugin
  migration loop (`src/support/global-setup.ts`, `global-teardown.ts`).
- **The connection-string handoff** between Jest's main process and its worker
  (`src/support/db-url.ts`).
- **App boot** — `createTestApp` / `closeTestApp` (`src/support/test-app.ts`), which mirrors
  `createServer` and stops at `app.init()`.
- **The plugin list and its order** (`src/support/plugins.ts`) — the e2e analogue of the host's
  `buildPlugins`, differing only in content (e2e-owned types + migrations) and media (in-memory
  storage).
- **The host config under test** (`src/support/test-config.ts`) and the per-suite override
  surface (`TestConfigOverrides`).
- **Seeding through DI** (`src/support/seed.ts`, 627 lines) and `resetDb()`.
- **The e2e-owned content model** (`src/support/content/*`, 7 types) and its committed
  migrations (`migrations/content/0000-0007`).
- **The copilot harness** — a stable delegating fake-provider facade and its fixture tools
  (`src/support/copilot.ts`, `copilot-fixture-tools.ts`).
- **In-memory media storage** (`src/support/media-storage.ts`).
- **SSE parsing helpers** (`src/support/sse.ts`).
- 51 spec files / 851 test cases (`apps/server-e2e/TESTS.md:7`) and the generated catalog.

### What it explicitly does **not** own

- **`apps/server`'s content collections.** `buildTestPlugins` registers `testContentTypes`
  and points the migration descriptor at `apps/server-e2e/migrations/content`
  (`src/support/plugins.ts:37-47`) precisely so renaming an app collection cannot break these
  tests. The corollary: **the app's real collections are never migrated or exercised here.**
- **The API reference / OpenAPI document.** `createTestApp` deliberately never calls
  `setupApiDocs` (`src/support/test-config.ts:68-72`) — see `🐞 BUG-server-e2e-09`.
- **Any browser, any rendering, any accessibility of a UI.** That is `apps/admin-e2e`.
- **Real model providers or real object storage.** Only the scripted `fake` copilot provider
  (`plugins.ts:78`) and an in-memory `memory` storage provider (`:69`) are registered.
- **Cross-suite parallelism.** `maxWorkers: 1` (`jest.config.cts:46`) is a deliberate,
  documented constraint, not an oversight.

### Entry points

| Kind | Entry point | Where |
| --- | --- | --- |
| Runner config | default export | `apps/server-e2e/jest.config.cts:11` |
| Global setup / teardown | `module.exports` | `src/support/global-setup.ts:21`, `global-teardown.ts:5` |
| App boot | `createTestApp(overrides?)`, `closeTestApp(harness)` | `src/support/test-app.ts:27`, `:62` |
| Config | `buildTestConfig(url, overrides?)`, `TestConfigOverrides` | `src/support/test-config.ts:60`, `:30` |
| Plugins | `buildTestPlugins(config)` | `src/support/plugins.ts:36` |
| Isolation | `resetDb()` | `src/support/seed.ts:392` |
| Seeding | 24 exported `seed*`/`get*`/`count*` helpers | `src/support/seed.ts` |
| Copilot | `scriptCopilot`, `copilotCalls`, `registerCopilotTools` | `src/support/copilot.ts:53`, `:64`, `:76` |
| SSE | `parseSse`, `streamSse`, `framesOfType`, `assembledText` | `src/support/sse.ts:29`, `:52`, `:93`, `:104` |
| Nx targets | `e2e`, `lint`, `typecheck`, `catalog`, `catalog:check`, `db:generate` | `apps/server-e2e/package.json`, `drizzle.config.ts` |

### Runtime prerequisites

| Requirement | Detail |
| --- | --- |
| Node + npm workspaces | `npm ci` at the repo root. `node_modules` is absent in a fresh checkout. |
| **Docker daemon** | Required by default — `PostgreSqlContainer('postgres:16-alpine')` (`global-setup.ts:41`). The image is pulled on first run. |
| `E2E_DATABASE_URL` | **Optional escape hatch.** Points the run at an existing Postgres and skips the container (`global-setup.ts:31-43`). **The database it names is TRUNCATEd between every test.** No guard prevents you naming your working DB — verified, the variable is compared with nothing anywhere. See `🐞 BUG-server-e2e-04`. |
| `.env` / `DATABASE_URL` | **Not read.** `buildTestConfig` supplies every value (`test-config.ts:64-151`); `DATABASE_URL` is *written* by `publishDatabaseUrl` (`db-url.ts:18`), never read from the developer's env. |
| Migrations | Applied by `global-setup`, per plugin, in `buildTestPlugins` order (`global-setup.ts:52-59`). |
| Seed data | None persists. `app.init()` runs the `SystemRolesSeeder` (`test-app.ts:22`); everything else is per-test. |
| A logged-in role | Real. `seedActiveUser` + `POST /api/auth/login` — the auth suites pass the raw `Set-Cookie` back by hand, other suites use `request.agent(...)`. |
| Feature flags | `mcp.enabled` defaults **true** here (host default is false, `test-config.ts:145-149`); `copilot.enabled` is **true** with the `fake` provider (`:107-118`); `docs.enabled` is **false**. |

### How to exercise it manually

```bash
npm ci
docker info                      # the daemon must be up

# Whole suite
npx nx e2e server-e2e

# One suite
npx nx e2e server-e2e -- src/server/auth/login.spec.ts

# One case, with the container's logs visible
npx nx e2e server-e2e -- -t 'sets an httpOnly session cookie'

# Without Docker — point at a THROWAWAY database
E2E_DATABASE_URL=postgres://user@127.0.0.1:5432/ortha_e2e npx nx e2e server-e2e

# Static checks — no Docker needed
npx nx run-many -t typecheck lint -p server-e2e
npx nx catalog:check server-e2e

# Regenerate the harness's own content migrations after editing src/support/content/*
npx nx run server-e2e:db:generate --name=<name>
```

**Debugging a suite locally.** The app is booted with `logger: false`
(`test-app.ts:41`), so Nest logs nothing — including the outbox dispatcher's delivery
failures. To see them, temporarily remove that option. To inspect the database mid-run, print
the container URI (it is logged by `global-setup.ts:66` only as "database ready"; add a
`console.log(connectionString)` or run with `E2E_DATABASE_URL` so you already know it) and
attach `psql` while a `--runInBand -t <name>` run is paused at a breakpoint. Jest's
`testTimeout` is 30 s (`jest.config.cts:43`), so a debugger session needs `--testTimeout=0`.

### Dependencies that must be healthy for the tests to mean anything

1. **Every plugin's committed migrations.** `global-setup` applies the *real* shipped
   descriptors (`{ dir, table }`), so a bad migration fails the whole run — correctly.
2. **`buildTestPlugins` order.** Cross-plugin FKs make it load-bearing and nothing asserts it
   (`🐞 BUG-server-e2e-14`).
3. **`resetDb`'s table list staying in sync with the schema.** It is a hand-maintained
   `TRUNCATE` string (`seed.ts:392-401`); a new table with no FK to `users`/`workspaces` is
   silently never cleaned. This has already happened once — see `🐞 BUG-server-e2e-03`.
4. **`apps/admin-e2e` covering what this suite cannot** (rendering, focus, announcements).

---

## 2. Feature Inventory

Harness capabilities, not product features.

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Postgres testcontainer lifecycle | `src/support/global-setup.ts:33-43`, `global-teardown.ts:5-13` | 🐞 `BUG-server-e2e-02` |
| F2 | Docker-less mode (`E2E_DATABASE_URL`) | `src/support/global-setup.ts:31-38` | 🐞 `BUG-server-e2e-04` |
| F3 | Per-plugin migration loop (real descriptors) | `src/support/global-setup.ts:48-62` | ⚠️ PARTIAL |
| F4 | Cross-plugin migration ordering | `src/support/plugins.ts:48-90` | 🐞 `BUG-server-e2e-14` |
| F5 | Connection-string handoff (env + temp-file fallback) | `src/support/db-url.ts:14-41` | 🐞 `BUG-server-e2e-05` |
| F6 | In-process app boot mirroring `createServer` | `src/support/test-app.ts:27-54` | 🐞 `BUG-server-e2e-09` |
| F7 | Per-file module registry / app / pool / throttler | `jest.config.cts:46` + `test-app.ts:56-65` | 🐞 `BUG-server-e2e-08` |
| F8 | Serial execution (`maxWorkers: 1`) | `jest.config.cts:44-46` | ✅ E2E (documented, correct) |
| F9 | Raised test timeout for cold boot + bcrypt | `jest.config.cts:42-43` | ✅ E2E |
| F10 | SWC transform + `@scalar` ESM exception | `jest.config.cts:21-29` | ✅ E2E |
| F11 | Source-resolution module mapping | `jest.config.cts:32-39` | ✅ E2E |
| F12 | Deterministic host config | `src/support/test-config.ts:60-151` | ⚠️ PARTIAL |
| F13 | Per-suite rate-limit override | `test-config.ts:32` + `auth/login-throttle.spec.ts:22-24` | ✅ E2E (no leak — see EC-20) |
| F14 | Per-suite origin / root-admin / GraphQL-limit / docs / MCP overrides | `test-config.ts:34-57` | ✅ E2E |
| F15 | Cookie config (`cookieSecure`, `cookieSameSite`) | `test-config.ts:80-84` | 🐞 `BUG-server-e2e-11` |
| F16 | `resetDb()` truncation | `src/support/seed.ts:392-401` | 🐞 `BUG-server-e2e-03` |
| F17 | User seeding through the real `HashingService` | `src/support/seed.ts:64-104` | ✅ E2E |
| F18 | Permission-less principal (`seedUserWithEmptyRole`) | `src/support/seed.ts:113-135` | 🐞 `BUG-server-e2e-06` |
| F19 | Workspace / membership / content-grant seeding | `seed.ts:149-196` | 🐞 `BUG-server-e2e-10` |
| F20 | Content-entry seeding (articles, authors, tags, pages, landing, joins) | `seed.ts:489-627` | 🐞 `BUG-server-e2e-10` |
| F21 | Out-of-band state helpers (`expireUserSessions`, `revokeUserSessions`, `setUserStatus`, `expireApiToken`, `expireInviteTokens`, `softDeleteAuthors`) | `seed.ts:210-251`, `:321`, `:578` | ✅ E2E (deliberate, documented) |
| F22 | Read-back helpers (`countUserSessions`, `getActivityRows`, `getInviteTokenHashes`, `countMediaAssets`, …) | `seed.ts:284-378`, `:469` | ✅ E2E |
| F23 | Root-admin provisioning through DI | `seed.ts:295-300` | ✅ E2E |
| F24 | Media seeding + in-memory blob store | `seed.ts:412-466`, `media-storage.ts:25-52` | 🐞 `BUG-server-e2e-07` |
| F25 | E2e-owned content model (7 types, every field & cardinality) | `src/support/content/*.ts` | ✅ E2E |
| F26 | E2e-owned content migrations + `db:generate` | `migrations/content/`, `drizzle.config.ts` | ✅ E2E |
| F27 | Copilot fake-provider facade + scripting | `src/support/copilot.ts:24-54` | 🐞 `BUG-server-e2e-13` |
| F28 | Copilot call log (`copilotCalls`) — the ADR-0005 negative-path target | `src/support/copilot.ts:64-66` | ✅ E2E |
| F29 | Copilot fixture tools (propose/apply) | `src/support/copilot-fixture-tools.ts` | ✅ E2E |
| F30 | Runtime tool registration through DI | `src/support/copilot.ts:76-80` | ✅ E2E |
| F31 | Buffered SSE parsing (`parseSse`) | `src/support/sse.ts:29-34` | 🐞 `BUG-server-e2e-15` |
| F32 | **Incremental** SSE streaming (`streamSse`) for the permission-park flow | `src/support/sse.ts:52-90` | ✅ E2E |
| F33 | Cookie/session flows — raw `Set-Cookie` handling in the auth suites, `request.agent(...)` elsewhere (e.g. `api-tokens/public-graphql-api.spec.ts:78`) | `auth/login.spec.ts:57`, `logout.spec.ts:55-65` | ✅ E2E |
| F34 | Generated catalog + drift gate | `tools/generate-test-catalog.mjs` | 🐞 `BUG-server-e2e-01` |
| F35 | CI execution of the suite | *(none)* | ❌ NONE — `BUG-server-e2e-01` |

**Cleared on inspection** (checked, no defect found): no `it.skip` / `describe.skip` /
`.only` / `xit` anywhere in `src/` (verified by grep across all 51 specs); all seven
`seedUserWithEmptyRole` `roleKey` values are distinct across the whole run (seven
call sites in six spec files); the copilot
facade's `current` is module-scoped and Jest isolates module registries per file, so no script
or call log crosses a file boundary (`copilot.ts:28-32`); `initDatabase` is idempotent
(`packages/database/src/lib/utils/db.ts:13-20`) so a second `createTestApp` in a file reuses
one pool rather than leaking a second; the two files that boot a second app already avoid
`closeTestApp` on it by hand (`mcp.spec.ts:923`, `root-admin.spec.ts:122-130`); per-suite
rate-limit overrides genuinely cannot leak (per-file app, in-memory throttler, `maxWorkers: 1`).

---

## 3. Manual Test Plan

### F1 — Testcontainer lifecycle

**Preconditions:** Docker running, no `E2E_DATABASE_URL` set.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `docker ps -a --filter ancestor=postgres:16-alpine` | Note the current container count. |
| 2 | `npx nx e2e server-e2e -- src/server/server.spec.ts` | Console prints `[e2e] starting Postgres testcontainer…`, then `[e2e] migrating "<plugin>"…` once per migrating plugin, then `[e2e] database ready (testcontainer).` |
| 3 | After the run, repeat step 1 | Count is unchanged — `global-teardown.ts:10` stopped it, printing `[e2e] testcontainer stopped.` |
| 4 | **Failure path.** Introduce a syntax error into any plugin's newest `.sql` migration, re-run | `global-setup` throws; Jest aborts before any suite. |
| 5 | Repeat step 1 | **Observed:** one extra running `postgres:16-alpine` container, orphaned. `global-teardown` never sees it because `__PG_CONTAINER__` is assigned *after* the migration loop (`global-setup.ts:65`). See `🐞 BUG-server-e2e-02`. Clean up with `docker rm -f`. |

### F2 — Docker-less mode

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `createdb ortha_e2e_scratch` | An empty, disposable database. |
| 2 | `E2E_DATABASE_URL=postgres://…/ortha_e2e_scratch npx nx e2e server-e2e -- src/server/auth` | Prints `[e2e] using E2E_DATABASE_URL (no testcontainer)…`, migrates, runs. |
| 3 | `psql ortha_e2e_scratch -c '\dt'` afterwards | Every plugin's tables plus the per-plugin `__drizzle_migrations_*` journals. |
| 4 | **Danger path.** Set `E2E_DATABASE_URL` to the same URL as your `.env` `DATABASE_URL` | **Observed:** the suite runs and TRUNCATEs your working database between every test. Nothing warns. See `🐞 BUG-server-e2e-04`. **Do not actually perform this step on a database you care about.** |

### F3 — Per-plugin migration loop

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Run any suite and read the `[e2e] migrating "…"` lines | One per plugin with a `migrations` descriptor, in `buildTestPlugins` order. |
| 2 | `psql <uri> -c "\dt __drizzle_migrations*"` | Distinct journal tables — e.g. `__drizzle_migrations_identity`, `__drizzle_migrations_content` (`plugins.ts:45`). Each plugin tracks its own history. |
| 3 | Re-run with the same `E2E_DATABASE_URL` | Migrations are no-ops; the journal is consulted. Confirms replay safety. |

### F4 — Cross-plugin migration ordering

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read `src/support/plugins.ts:48-90` and the comment at `:32-34` | Order is database → identity → workspaces → activity → users → content → graphql → media → i18n → copilot → mcp. |
| 2 | Move `CopilotPlugin({...})` above `WorkspacesPlugin()` in a scratch branch and run | **Observed:** `global-setup` dies with a raw Postgres error — `relation "workspaces" does not exist` — because `copilot_conversations` FKs `workspaces` (`packages/copilot/server/migrations/*.sql`). No harness-level message explains that order was the cause. See `🐞 BUG-server-e2e-14`. |

### F5 — Connection-string handoff

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `ls "$TMPDIR/ortha-server-e2e/database-url"` during a run | The file exists and holds the URI (`db-url.ts:14,20`). |
| 2 | After the run | The directory is gone (`clearDatabaseUrl`, `db-url.ts:39-41`). |
| 3 | Start two runs concurrently in two terminals | **Observed:** both write the same fixed path; whichever finishes first `rmSync`s the shared directory out from under the other. The env path usually saves it — the file is the *fallback*, used exactly when env inheritance failed. See `🐞 BUG-server-e2e-05`. |

### F6 — In-process app boot

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/server.spec.ts` | `GET /api/does-not-exist` → 404, proving the global `api` prefix is applied (`test-app.ts:43`). |
| 2 | `npx nx e2e server-e2e -- -t 'rejects an unknown extra field'` | 400 with a message naming `role` — proves `forbidNonWhitelisted: true` (`test-app.ts:46`) matches production (`create-server.ts:31`). |
| 3 | Diff `test-app.ts:27-53` against `packages/bootstrap/server/src/lib/create-server.ts:13-43` | The **only** omissions are `setupApiDocs(app, plugins, docs, globalPrefix)` (`create-server.ts:38`), `app.listen`, and the default logger. See `🐞 BUG-server-e2e-09`. |
| 4 | `curl` the reference | Impossible — there is no listening port, and no reference is mounted. |

### F7/F8 — Per-file registry, serial execution

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- --maxWorkers=4` | Jest's CLI flag overrides the config; suites now race on `resetDb` and fail unpredictably (typically a foreign-key violation or a count assertion off by another suite's rows). This is why `jest.config.cts:46` pins `1`. |
| 2 | Confirm the throttler cannot leak | `login-throttle.spec.ts` boots its own app (`:22`); `ThrottlerGuard` state is in-memory per module registry, and Jest gives each *file* its own registry. Run the whole suite and confirm `login.spec.ts` (13 login requests) never 429s. |

### F9-F11 — Jest transform/mapping

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/server.spec.ts` | Boots without an ESM `export {` SyntaxError, proving the `@scalar/` transform exception (`jest.config.cts:29`) still matches. |
| 2 | Remove a `moduleNameMapper` entry and re-run | Module-resolution failure at import time — the workspace resolves from source and Jest needs the mapping (`jest.config.cts:32-39`). |

### F12/F14 — Deterministic config and per-suite overrides

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/mcp/mcp.spec.ts` | MCP responds — `mcp.enabled` defaults `true` here (`test-config.ts:146`). |
| 2 | Same file, `-t 'unmounts the endpoint when disabled'` | A second app booted with `{ mcpEnabled: false }` (`mcp.spec.ts:900`) 404s the MCP path. |
| 3 | `npx nx e2e server-e2e -- src/server/api-tokens/public-graphql-playground.spec.ts` | The playground is reachable only with `{ docsEnabled: true }` (`test-config.ts:52-57`, `plugins.ts:64`). |
| 4 | `npx nx e2e server-e2e -- src/server/auth/root-admin.spec.ts` | `{ rootAdmin }` provisions on boot; the misconfiguration case asserts the boot **rejects** (`root-admin.spec.ts:124-130`). |

### F13 — Rate-limit override

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/auth/login-throttle.spec.ts` | Three 401s then a 429 (`login-throttle.spec.ts:45-48`), with `limit: 3`. |
| 2 | `npx nx e2e server-e2e -- src/server/auth` | The full auth folder passes; the relaxed limit (`ttl 60, limit 1000`, `test-config.ts:24-27`) keeps `login.spec.ts` from self-throttling. |

### F15 — Cookie configuration

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- -t 'cookie carries the configured attributes'` | Passes. Asserts `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=604800`, and **`not Secure`** (`login.spec.ts:83-88`). |
| 2 | Try to boot with `cookieSecure: true` | Not possible — `TestConfigOverrides` (`test-config.ts:30-58`) has no `session` key and `:82` hard-codes `false`. See `🐞 BUG-server-e2e-11`. |

### F16 — `resetDb()`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read `src/support/seed.ts:392-401` | 13 tables are truncated `RESTART IDENTITY CASCADE`. |
| 2 | Cross-check against the schema: `grep -rhiE "^CREATE TABLE" packages apps --include=*.sql` | 48 tables exist. Not truncated and **not reachable by cascade**: `outbox_events` (no FK at all). Not truncated but reachable by cascade from `users`/`workspaces`: `sessions`, `tokens`, `memberships`, `workspace_content`, `api_tokens`, `api_token_workspaces`, `user_preferences`, all six `copilot_*`, `content_test_article_{tags,contributors}`. Deliberately preserved: `roles`, `permissions`, `role_permissions`. |
| 3 | Prove the outbox gap: after a full run, `psql <uri> -c 'SELECT count(*), count(dispatched_at) FROM outbox_events'` | A non-zero total accumulated across the entire run. See `🐞 BUG-server-e2e-03`. |

### F17/F23 — Seeding through DI

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read `seed.ts:74-76` | `await app.get(HashingService).hashPassword(...)` — the same provider instance login verifies against, reached via a relative path (`seed.ts:33`) because the class is not re-exported. |
| 2 | `npx nx e2e server-e2e -- src/server/auth/login.spec.ts` | Seeded credentials authenticate, proving the hash algorithm/cost match. |
| 3 | Omit the password: `seedUser(app, { email, role, status: 'active' })` | `passwordHash: null` — the invite-pending state; login 401s (`login.spec.ts:161-173`). |

### F18 — Permission-less principal

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/content/list-entries.spec.ts -t 'permission'` | A user under a fresh role with no `role_permissions` rows is refused — proving the route requires a *permission*, not merely a session. |
| 2 | Re-run the same single test twice in one Jest invocation (`--repeat-each=2`, or a `jest.retryTimes` policy) | **Observed:** the second attempt fails on a unique violation for `roles.key`, because `roles` survives `resetDb`. See `🐞 BUG-server-e2e-06`. |

### F19/F20 — Workspace and content seeding

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/workspaces/workspace-access.spec.ts` | Membership scoping is asserted against seeded rows. |
| 2 | Read `seed.ts:149-170` and compare with `CreateWorkspaceUseCase.execute` (`packages/workspaces/server/…/create-workspace.use-case.ts:47-70`) | The seeder writes a bare `workspaces` row. The endpoint additionally validates the slug and colour, asserts slug uniqueness, resolves members, resolves grants against the registry, adds the **creator as a member**, and appends domain events. None of that happens when seeding. See `🐞 BUG-server-e2e-10`. |
| 3 | Read `seed.ts:502-508` | `.values(rows.map(...) as never)` — a raw Drizzle insert with no field validation, no `required` check, no `minLength`/`max`/`options` enforcement. |

### F21/F22 — Out-of-band state and read-backs

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/auth/me.spec.ts` | `setUserStatus(id,'disabled')` (`seed.ts:243`) without revoking sessions proves the `AuthService` status predicate is real defence in depth, not dead code. |
| 2 | `npx nx e2e server-e2e -- src/server/users/manage-invites.spec.ts` | `getInviteTokenHashes` (`seed.ts:307`) shows a resend **rotates** the hash — exactly one row, different value. |
| 3 | Read the JSDoc at `seed.ts:237-242` | It states plainly that the API never performs this transition. Good practice: every bypass is labelled. |

### F24 — Media seeding + blob store

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/media/media-assets.spec.ts` | Upload → download round-trips through the in-memory `Map` (`media-storage.ts:26`). |
| 2 | Read `seed.ts:428-433` | A *seeded* asset writes no blob; its `storage_key` points at nothing. Downloading it throws (`media-storage.ts:41`). Documented. |
| 3 | Try to assert "delete removed the bytes" | Not possible — the `Map` is closed over and never exported. See `🐞 BUG-server-e2e-07`. |

### F25/F26 — E2e-owned content model and migrations

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Read `src/support/content/test-article.ts:26-182` | Every scalar field type, all four relation cardinalities, `publishable` + `paranoid` + `i18n`, plus the `syncAcrossLocales: false` opt-out. This is the strongest single asset in the harness. |
| 2 | Edit a field and run `npx nx run server-e2e:db:generate --name=my_change` | A new SQL file appears in `migrations/content/` with a journal entry; commit it. |
| 3 | Re-run the suite | `global-setup` applies it via the standard loop (`plugins.ts:43-46`). |

### F27/F28/F29/F30 — Copilot harness

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/copilot/copilot-chat.spec.ts` | Scripted turns drive the real run engine; no network call is made. |
| 2 | Script one turn but trigger two model calls | The fake **throws** rather than inventing an answer (`copilot.ts:47-50`) — the test fails loudly. |
| 3 | `-t 'write tools'` | `copilotCalls()[0].tools` proves a viewer is never *offered* a write tool — the ADR-0005 negative path, asserted about the offer rather than the outcome (`copilot.ts:57-63`). |
| 4 | Read `copilot-fixture-tools.ts` | Supplies propose/apply tools so that assertion is not vacuous — without them "a viewer is offered no write tools" would pass because *nobody* has any. |
| 5 | Delete a nested `beforeEach(() => scriptCopilot(...))` (e.g. `copilot-chat.spec.ts:189`) | Tests in that block silently inherit the previous block's script and call log. See `🐞 BUG-server-e2e-13`. |

### F31/F32 — SSE helpers

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/copilot/copilot-chat.spec.ts -t 'stream'` | `parseSse(res.text)` yields the frame sequence; comment frames (`: open`, `: ping`) are skipped (`sse.ts:12`). |
| 2 | `-t 'permission'` | `streamSse` answers `POST /runs/:runId/permission` from inside `onFrame` **while the response is open** (`sse.ts:36-50`) — a buffered read would deadlock. This is the harness's best piece of engineering. |
| 3 | Compare `sse.ts:13` with `packages/copilot/admin/src/lib/application/runStream.ts:138` | `startsWith('data: ')` (with a space) vs `startsWith('data:')` (without). Two parsers, two contracts. See `🐞 BUG-server-e2e-15`. |

### F33 — Cookie/session flows

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx e2e server-e2e -- src/server/auth/logout.spec.ts` | The clearing cookie is asserted structurally: `^ortha_session=;` and `Expires=Thu, 01 Jan 1970` (`logout.spec.ts:75-76`), then the old cookie no longer authenticates (`:79`). |
| 2 | `grep -rn "set-cookie" apps/server-e2e/src --include=*.spec.ts` | 7 hits across 4 files (`login`, `logout`, `me`, `preferences`). |
| 3 | `grep -rn "HttpOnly\|SameSite\|Max-Age" apps/server-e2e/src --include=*.spec.ts` | Exactly one location: `login.spec.ts:83-88`. **The invite-accept endpoint also sets a session cookie** (`packages/identity/server/src/lib/auth/controllers/invite.controller.ts:84`) and its attributes are asserted nowhere. |

### F34/F35 — Catalog and CI

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx catalog:check server-e2e` | Exit 0 when `TESTS.md` matches. |
| 2 | Compare `apps/server-e2e/TESTS.md:4` with `apps/server-e2e/AGENTS.md` ("Test catalog") | `TESTS.md` says "CI runs `npx nx catalog:check server-e2e`"; `AGENTS.md` says "wire this into CI **once a pipeline exists**". They contradict each other. |
| 3 | `grep -nE "e2e\|jest\|catalog" .github/workflows/release.yml` | No matches. The only workflow runs `npm ci`, `typecheck`, `nx release`. See `🐞 BUG-server-e2e-01`. |

---

## 4. Edge Cases & Negative Paths

#### Container & lifecycle

- **EC-01 — Migration failure mid-loop.** `❌ NONE`
  Trigger: a malformed `.sql` in any plugin. Expected: setup aborts *and* the container stops.
  Suspected: `__PG_CONTAINER__` is assigned after the loop (`global-setup.ts:65`), so teardown
  finds `undefined` and the container survives → `🐞 BUG-server-e2e-02`.
- **EC-02 — Docker daemon down.** `⚠️ PARTIAL`
  `PostgreSqlContainer.start()` rejects with testcontainers' own error. Readable, but the
  harness adds no hint about `E2E_DATABASE_URL`, which is the documented workaround one file
  away (`AGENTS.md`, "Running without Docker").
- **EC-03 — Image not cached / registry unreachable.** `❌ NONE` First run pulls
  `postgres:16-alpine`; on an offline machine setup fails with a pull error and no guidance.
- **EC-04 — Port collision.** Cleared. Testcontainers binds an ephemeral host port and
  `getConnectionUri()` reports it (`global-setup.ts:42`); nothing in the harness hard-codes
  5432. `app.init()` never calls `listen`, so the API binds no port at all
  (`test-app.ts:51`).
- **EC-05 — Two concurrent runs on one machine.** `❌ NONE`
  Containers are independent, but the handoff file path is fixed
  (`db-url.ts:14`) and teardown `rmSync`s its parent directory recursively (`:40`)
  → `🐞 BUG-server-e2e-05`.
- **EC-06 — `E2E_DATABASE_URL` points at a real database.** `❌ NONE`
  No comparison against `DATABASE_URL`, no name-pattern check, no host check, no confirmation
  prompt — verified: the variable is read in exactly one place (`global-setup.ts:31`) and
  compared with nothing. `resetDb()` then TRUNCATEs it in every suite's `beforeEach`
  → `🐞 BUG-server-e2e-04`.
- **EC-07 — `E2E_DATABASE_URL` names a database with a divergent schema.** `⚠️ PARTIAL`
  `migrate()` consults each plugin's journal table. A database migrated by an *older* branch
  resumes correctly; one migrated by a *newer* branch is silently left ahead, and specs fail
  on columns the code does not know about, with no message tying it to the reused database.
- **EC-08 — Global setup succeeds, a worker cannot resolve the URL.** `⚠️ PARTIAL`
  `resolveDatabaseUrl` throws a genuinely good message (`db-url.ts:32-34`). Good.

#### Isolation

- **EC-09 — Undispatched outbox rows survive `resetDb`.** `❌ NONE`
  `outbox_events` is absent from the TRUNCATE list (`seed.ts:394-399`) and its migration
  declares **no foreign keys** (only an index on `dispatched_at`), so no cascade reaches it.
  The dispatcher's poll backstop fires every 5 s (`packages/database/src/lib/outbox/outbox-dispatcher.ts:22,119-125`)
  and drains `WHERE dispatched_at IS NULL` (`:81`). A row whose subscriber threw stays
  undispatched with `attempts + 1` (`:109-112`) and is retried inside a **later test** — after
  `resetDb` has removed the rows it references → `🐞 BUG-server-e2e-03`.
- **EC-10 — The retry is invisible.** `❌ NONE`
  The dispatcher reports failures via `this.logger.error(...)` (`outbox-dispatcher.ts:105-108`),
  but `createTestApp` boots with `logger: false` (`test-app.ts:41`). The one diagnostic that
  would explain a mysterious extra `activity_events` row is suppressed.
- **EC-11 — Audit rows appear in a test that created none.** `⚠️ PARTIAL`
  `AuditEventSubscriber` registers with the dispatcher
  (`packages/activity/server/src/lib/activity/infrastructure/audit-event.subscriber.ts:37`)
  and writes `activity_events`, which *is* truncated. `countActivityRows()` (`seed.ts:373`) is
  asserted in `activity.spec.ts`; a replayed stale event lands inside that window. The failure
  presents as an off-by-N count with no explanation.
- **EC-12 — `roles` accumulates for the whole run.** `⚠️ PARTIAL`
  Deliberate (system roles must survive), but `seedUserWithEmptyRole` inserts a *non-system*
  role that also survives (`seed.ts:118-121`). All eight keys in use today are distinct;
  the constraint is documented (`seed.ts:109-111`) and unenforced → `🐞 BUG-server-e2e-06`.
- **EC-13 — The in-memory blob store is never cleared.** `⚠️ PARTIAL`
  `createInMemoryStorageProvider()` closes over a `Map` created once per `buildTestPlugins`
  call (`media-storage.ts:26`), i.e. once per app. `resetDb` truncates `media_asset` and leaves
  the bytes → `🐞 BUG-server-e2e-07`.
- **EC-14 — `RESTART IDENTITY` on uuid tables.** Cleared. Harmless; it matters for
  `activity_events`, whose ordering assertions read `ORDER BY at DESC, id DESC`
  (`seed.ts:367`).
- **EC-15 — `SystemRolesSeeder` runs once per spec file.** Cleared. It must be idempotent for
  file #2 onward to boot, and 851 passing cases across 51 files demonstrate that it is.
- **EC-16 — A second app in one file.** `⚠️ PARTIAL`
  `initDatabase` is idempotent (`packages/database/src/lib/utils/db.ts:14-16`), so the second
  app reuses the first pool — and therefore **silently ignores its own connection string**.
  Benign today (both are the same URL); a latent trap → `🐞 BUG-server-e2e-08`.
- **EC-17 — `createTestApp` after `closeTestApp` in one file.** `❌ NONE`
  `closeTestApp` ends the singleton pool (`test-app.ts:64`) without clearing the memo, so a
  subsequent boot receives an **ended** pool and every query throws "Cannot use a pool after
  calling end". No file does this; nothing prevents it.
- **EC-18 — Parallel workers.** Cleared and correctly documented. `maxWorkers: 1`
  (`jest.config.cts:46`) with the rationale in place; `AGENTS.md` states "Parallelism later
  would need a DB-per-worker scheme". The config **does** say so — which is what the question
  asks.
- **EC-19 — Order dependence between spec files.** `⚠️ PARTIAL`
  Serial execution plus per-file `beforeEach(resetDb)` makes files independent for every table
  in the truncate list. The exceptions are `roles` (EC-12) and `outbox_events` (EC-09).
- **EC-20 — Per-suite config overrides leaking.** Cleared.
  Rate limit, allowed origins, root admin, GraphQL limits, docs and MCP all flow through
  `buildTestConfig` into a per-file app (`test-config.ts:60`), and the throttler is in-memory
  per module registry. Verified by reading `login-throttle.spec.ts:22-24` against
  `login.spec.ts:41` — the latter never 429s despite 13 login requests.
- **EC-21 — `login-throttle.spec.ts` resets in `beforeAll`, not `beforeEach`.** `⚠️ PARTIAL`
  `login-throttle.spec.ts:21-31`. Safe with one test; a second test added to the file inherits
  a consumed bucket and fails confusingly → `🐞 BUG-server-e2e-12`.

#### Seeding fidelity — does the seed produce state the API could produce?

- **EC-22 — A seeded workspace has no creator membership and no grants.** `⚠️ PARTIAL`
  `seedWorkspace` writes one row (`seed.ts:155-163`); `CreateWorkspaceUseCase` always adds the
  creator and writes grants (`create-workspace.use-case.ts:61,63`). Suites compensate with
  explicit `seedMembership`/`seedContentGrants`, but the *default* seeded state is unreachable
  through the API → `🐞 BUG-server-e2e-10`.
- **EC-23 — Slug/colour validation bypassed.** `❌ NONE`
  `Slug.create` and `WorkspaceColor.create` (`create-workspace.use-case.ts:47-48`) and
  `SlugUniquenessService.assertAvailable` (`:51`) are all skipped by the seeder. A spec could
  seed an invalid slug and assert read behaviour over it. None currently does — but nothing
  stops it, and the DB's own unique index is the only remaining guard.
- **EC-24 — Content-grant registry check bypassed.** `❌ NONE`
  `resolveGrants(dto.content, this.catalog.knownSlugs())` (`create-workspace.use-case.ts:54`)
  validates a granted slug against the registry. `seedContentGrants` (`seed.ts:185-187`)
  inserts whatever it is given, defaulting `kind` to `'collection'` — so granting a *single*
  without passing `'single'` writes a row the API would never write. Exactly one call site
  passes the kind (`api-tokens/public-content-api.spec.ts:469`); every other grant of a single
  would be silently mis-kinded.
- **EC-25 — Entry field validation bypassed.** `⚠️ PARTIAL`
  `seedArticles`/`seedAuthors`/`seedTags`/`seedPages`/`seedLanding` all cast `as never` and
  insert raw (`seed.ts:502-507`, `:523-528`, `:543-547`, `:563-566`, `:622-626`). Nothing
  enforces `required`, `minLength: 3`, `max: 120`, or the `select` option set declared on
  `test_article` (`src/support/content/test-article.ts:33-96`). Audited every `seedArticles`
  call site: **no current spec seeds an out-of-range value** — the one long string is
  `richtext`, which has no `maxLength` (`copilot/copilot-chat.spec.ts:998`). The capability is
  unguarded rather than currently abused.
- **EC-26 — Null-`workspace_id` rows.** `⚠️ PARTIAL` — deliberate and documented
  (`seed.ts:485-487`, "the orphan row is invisible path"). The API can never create one, so
  what that test proves is narrow but real: the guard filters on the column, not on a join.
- **EC-27 — Seeded media assets have no bytes.** `⚠️ PARTIAL` — documented (`seed.ts:428-431`).
  Any download-path assertion must go through a real upload.
- **EC-28 — Credentials.** Cleared, and this is the harness's best fidelity decision:
  `seedUser` hashes through the app's own `HashingService` pulled from DI
  (`seed.ts:33`, `:75`), so a change to the hashing cost or algorithm cannot silently diverge
  from what login verifies.

#### Empty / boundary / size / encoding

- **EC-29 — Zero rows.** `✅ E2E` Every seeder early-returns on an empty array
  (`seed.ts:493`, `:520`, `:542`, `:599`, `:620`) and list suites assert empty pages.
- **EC-30 — `limit`/`pageSize` boundaries.** `✅ E2E` at the DTO level — `ListMembersQueryDto`,
  `ListEntriesQueryDto` and `PublicListEntriesQueryDto` are exercised by
  `list-users.spec.ts`, `list-entries.spec.ts` and `public-content-api.spec.ts`.
- **EC-31 — Offset past the end.** `⚠️ PARTIAL` Covered for entries; not systematically for
  users, media or activity.
- **EC-32 — Unicode / emoji / RTL in a seeded value.** `⚠️ PARTIAL`
  German content exists (`i18n-content.spec.ts`), but no RTL script and no emoji. Postgres
  collation, `ILIKE` folding and the search path behave differently for those.
- **EC-33 — Very long body / 10 MB payload.** `❌ NONE` Nothing exercises Express's body limit
  or `maxUploadBytes: 52_428_800` (`test-config.ts:129`) at the boundary.
- **EC-34 — Path traversal in an uploaded filename.** `❌ NONE`
  `media-storage.ts:30` builds the key as `${workspaceId}/${assetId}/${object.fileName}` —
  the filename is interpolated unsanitised. In the in-memory `Map` that is harmless, but the
  harness therefore **cannot** catch a traversal that the real local/S3 providers would suffer,
  because those providers are never booted (`plugins.ts:69`).
- **EC-35 — SQL-ish input.** `✅ E2E` implicitly — Drizzle parameterises everything, and neither
  hand-written query interpolates a value: `seed.ts:363` is a constant SQL string with no
  parameters at all, and `seed.ts:583-586` is genuinely parameterised (`$1::uuid[]`, ids passed
  as a bind array). `resetDb`'s `TRUNCATE` (`seed.ts:393-400`) is likewise a constant string.
  (Corrected: the original filing described `:363` as parameterised; it takes no parameters,
  which is equally safe but a different property.)

#### Permission matrix, tenancy, enumeration

- **EC-36 — Per-role coverage.** `✅ E2E` Strong. `seedUserWithEmptyRole` gives a genuine
  no-permission principal, and six spec files use it (seven call sites). `admin`/`contributor`/`viewer` are
  exercised across users, workspaces, content and copilot.
- **EC-37 — Unauthenticated.** `✅ E2E` Every controller suite opens with a 401 case
  (e.g. `get-user.spec.ts`, `mcp.spec.ts` "authentication").
- **EC-38 — Authenticated but not a member.** `✅ E2E` `workspace-access.spec.ts`
  ("Workspace access is scoped to membership").
- **EC-39 — 403 vs 404 enumeration signal.** `⚠️ PARTIAL` Asserted where it matters most —
  invite tokens collapse every failure to a bare 404 (`invite.controller.ts:88-94`, asserted in
  `accept-invite.spec.ts`) and cross-workspace reads 404. Not asserted systematically as a
  policy across every route.
- **EC-40 — Bearer-token scopes and workspace binding.** `✅ E2E`
  `api-tokens-management.spec.ts`, `public-content-api.spec.ts`,
  `public-content-writes.spec.ts`, `public-graphql-api.spec.ts` — 29 references to
  `/api/api-tokens` and 149 to `/api/v1/content`.

#### Concurrency & failure

- **EC-41 — Two writers on one row / count-then-write races.** `⚠️ PARTIAL`
  The domain has explicit lock helpers (`packages/users/server/src/lib/member/infrastructure/persistence/member-lock.ts`)
  and a "last admin" invariant. The harness runs single-worker and offers no helper for
  issuing two overlapping requests, so races are asserted only through their sequential
  consequences.
- **EC-42 — Transaction rollback leaving an outbox row.** `⚠️ PARTIAL`
  `countActivityRows()` exists specifically to assert "a rolled-back mutation writes none"
  (`seed.ts:372`). The outbox side of that invariant is unassertable — no helper reads
  `outbox_events` (grep across `src/` returns zero references).
- **EC-43 — Migration applied twice.** `✅ E2E` implicitly, via the journal, whenever
  `E2E_DATABASE_URL` reuses a database.
- **EC-44 — SSE stream aborted by the client.** `⚠️ PARTIAL`
  `SseStream.onClientDisconnect` hangs off the **response** and its doc comment records that
  wiring it to the request aborts every run instantly (`sse-stream.ts:78-89`). `streamSse`
  could exercise an early abort; no spec does.
- **EC-45 — Heartbeat frames.** `⚠️ PARTIAL` `parseSse` skips them correctly (`sse.ts:12`), but
  the interval is 15 s (`sse-stream.ts:9`) and no test runs long enough to receive one, so the
  skip branch is exercised only by the `: open` frame.

---

### 4A. Accessibility & Section 508 Conformance

**Standards.** Revised Section 508 (36 CFR Part 1194, App. A-C) incorporates WCAG 2.0 A+AA by
reference (E205.4 for electronic content; **504.2 for authoring tools**). This repo's
`accessibility` skill targets WCAG 2.1 AA.

**This unit renders no UI.** It is a Node test harness driving an HTTP API with supertest —
there is no DOM, no focus, no colour and no assistive technology in the loop. Every
perceivable/operable criterion is therefore **Not Applicable** to `apps/server-e2e` itself.

What *is* in scope, and is the reason this section is not empty: OrthaCms is a **content
management system**, so 508 **Chapter 5 §504 (Authoring Tools)** applies to the API this
harness tests, and the *data model* is where 504 conformance is won or lost. If the schema has
nowhere to store alt text, a table caption or a language/direction marker, no amount of admin
UI work can fix it — and `apps/server-e2e` is the only harness positioned to assert those
guarantees at the persistence boundary. It largely does not.

#### ♿ A11Y-server-e2e-01 — Alt text is a first-class column and its three states are tested · **Supports**

**WCAG:** 1.1.1 Non-text Content (A) · **508:** 504.2, 504.3
**Location:** `apps/server-e2e/src/support/seed.ts:442-448`, `:459`;
`apps/server-e2e/src/server/insights/media-insights.spec.ts`

This is a genuine strength and belongs on the record. `media_asset.alt` is `string | null`,
and the seeder's doc comment distinguishes the three states that matter:

```
* Alt text. Distinguishes three states the alt-coverage aggregate has to
* tell apart: absent (`undefined` → NULL), explicitly blank (`''`, which is
* the markup for "decorative" and must NOT count as covered), and real text.
```

Treating `''` as *decorative* rather than *missing* is the distinction most CMS alt-coverage
reports get wrong, and the media-insights suite asserts the aggregate honours it. The admin
surfaces this as the "Images missing alt text" insight, which the admin-e2e suite proves has a
text alternative (`apps/admin-e2e/src/insights/a11y.spec.ts:126-130`).

**Remediation:** none. Keep it.

---

#### ♿ A11Y-server-e2e-02 — No API-level assertion that accessibility information survives revision restore, publish or locale copy · **Does Not Support**

**WCAG:** 1.1.1 (A), 1.3.1 Info and Relationships (A)
**508:** **504.2.1 (Preservation of Accessibility Information)**
**Location:** `apps/server-e2e/src/server/content/entry-revisions.spec.ts`,
`apps/server-e2e/src/server/i18n/i18n-content.spec.ts`

504.2.1 requires an authoring tool to preserve accessibility information through save, reload,
copy and restore. The harness exercises every one of those transitions — revision snapshot and
restore (`content_entry_revisions`), publish/unpublish, sibling-translation create, and the
`syncAcrossLocales` opt-out — and asserts none of the accessibility payload across them:

- Does a `richtext` body's `<th>`/`<caption>`/`alt` markup survive a revision restore byte-for-byte?
- Does a media field's alt text still resolve after a locale copy? (`test_article.heroImage` is
  `localized: true`, `test-article.ts:109-113`, so the *link* is per-locale even though the
  asset's alt is shared — a distinction nothing tests.)
- Does publishing a revision preserve the markup the author reviewed?

**Screen-reader consequence:** an editor writes a properly-marked-up table, restores a
revision, and silently ships a table with no header cells. Nothing in 851 cases would notice.

**Remediation:** add three assertions to the existing suites — restore, publish and
locale-copy each preserve a richtext body containing `<th scope>` and an image `alt`, compared
byte-for-byte against what was saved.

---

#### ♿ A11Y-server-e2e-03 — `LocaleDef` has no text-direction field, so an RTL locale cannot be declared · **Does Not Support** (schema-level)

**WCAG:** 3.1.2 Language of Parts (AA), 1.3.2 Meaningful Sequence (A)
**508:** E205.4; **504.2**
**Location:** `packages/i18n/server/src/lib/types/locale.ts:9-22`; harness config at
`apps/server-e2e/src/support/test-config.ts:95-101`

```ts
export interface LocaleDef {
    slug: string;
    name: string;
    isDefault?: boolean;
}
```

There is no `dir` (or equivalent). `GET /api/i18n/locales` is the single source of truth the
admin renders from (`locale.ts:1-6`), so the admin has no way to learn that `ar` or `he` needs
`dir="rtl"`, and a content type's localized fields carry no direction marker into the public
API either. The e2e config declares `en`/`de`/`fr` (`test-config.ts:96-100`) — three LTR
locales — so no suite could surface the gap even if it wanted to.

This is a **schema-level Does Not Support** and is more valuable than any missing `aria-label`:
it cannot be fixed in the admin. **It should also be filed against `i18n-server` and
`content-domain`**, which own the contract; it appears here because `apps/server-e2e` is where
it would be caught.

**Remediation (harness scope):** add an RTL locale to `test-config.ts` and a spec asserting
the locales endpoint exposes a direction. **Remediation (product scope, out of scope here):**
add `dir?: 'ltr' | 'rtl'` to `LocaleDef`.

---

#### ♿ A11Y-server-e2e-04 — Richtext is a single opaque HTML string with no slot for a table caption or per-block language · **Partially Supports** (schema-level)

**WCAG:** 1.3.1 (A), 3.1.2 (AA)
**508:** **504.2**
**Location:** `apps/server-e2e/src/support/content/test-article.ts:43-50`
(`field.richtext({ localized: true, admin: { widget: 'textarea' } })`)

The harness's own reference type models `richtext` as a plain string field, matching the
product. Whatever accessibility markup an author produces lives inside that string and is
validated by nothing — there is no server-side assertion that a stored body's tables have
header cells, that images have `alt`, or that a foreign-language passage carries `lang`. The
admin-side suite does assert the *editor produces* `<th>` (`apps/admin-e2e/src/content/wysiwyg-fields.spec.ts:285-287`),
which is a real 504.2 signal — but nothing on the server side prevents an API client (or the
MCP endpoint, or the copilot's write path, ADR-0009) from storing a body with none of it.

**Remediation (harness scope):** add a public-API write case that stores a richtext body and
asserts the round-trip is byte-exact, so at least *loss* is detectable. Structural validation
is a product decision for `content-domain`.

---

#### ♿ A11Y-server-e2e-05 — Validation errors return a field-naming message array · **Supports**

**WCAG:** 3.3.1 Error Identification (A), 3.3.3 Error Suggestion (AA)
**508:** E205.4
**Location:** `apps/server-e2e/src/server/auth/login.spec.ts:184-231`

The harness asserts that a `ValidationPipe` rejection returns `message` as an **array naming
the offending field** — `expect.arrayContaining([expect.stringContaining('email')])` at `:187`,
`password` at `:194`, and the unknown-property name (`role`) at `:229`. That is precisely the payload a
client needs to associate an error with its input for 3.3.1, and the admin's own error reader
handles the array form (`packages/copilot/admin/src/lib/application/runStream.ts:154-157`).
Asserting the *shape*, not just the 400, is the right call and is worth preserving.

---

#### Not Applicable

The following are **Not Applicable** to this unit, which renders nothing and has no user
agent: 1.3.5 Identify Input Purpose, 1.4.1 Use of Color, 1.4.3 / 1.4.11 Contrast,
1.4.4 Resize Text, 1.4.10 Reflow, 1.4.12 Text Spacing, 1.4.13 Content on Hover or Focus,
2.1.1 / 2.1.2 Keyboard, 2.2.1 Timing Adjustable, 2.4.1 Bypass Blocks, 2.4.2 Page Titled,
2.4.3 Focus Order, 2.4.6 Headings and Labels, 2.4.7 Focus Visible, 3.1.1 Language of Page,
3.2.1 / 3.2.2 On Focus / On Input, 3.3.2 Labels or Instructions, 3.3.4 Error Prevention,
4.1.2 Name Role Value, 4.1.3 Status Messages; 502.2 / 502.3 (AT interoperability),
**503.2 (platform preferences)**, **503.4 (captions and audio controls)**. These are assessed
on `app-admin`, `design-system`, `apps/admin-e2e` and the individual admin plugins.

---

## 5. E2E Coverage Map

**Inverted, because this unit is a harness.** Which product areas does this harness cover, and how honestly. "Fidelity" asks whether the
state the suite asserts against is state the running system could actually reach.

| Product area / plugin | Specs | What is genuinely asserted | Fidelity | Verdict |
| --- | --- | --- | --- | --- |
| Bootstrap — prefix + 404 | `server/server.spec.ts:15` | One case: unknown route under `/api` → 404 | Real app | ⚠️ PARTIAL |
| **Bootstrap — API reference (`/reference`, `/reference/json`)** | *(none)* | — | **Structurally impossible**: `createTestApp` never calls `setupApiDocs` (`test-config.ts:68-72`) | ❌ NONE — `🐞 BUG-server-e2e-09` |
| Auth — login | `auth/login.spec.ts` (26 cases) | 201 + `{ok:true}`, **full cookie attribute set** (`:76-89`), one session row, distinct session per login, case-insensitive email, six 401 branches, nine 400 branches, four OriginGuard cases incl. guard-before-validation | Real bcrypt via DI | ✅ E2E — the strongest suite in the repo |
| Auth — logout | `auth/logout.spec.ts` | 201, `ortha_session=;` + `Expires=Thu, 01 Jan 1970` (`:75-76`), session revoked, idempotent | Real | ✅ E2E |
| Auth — `me` | `auth/me.spec.ts` | 401 without a session, user + permissions, suspended-account lockout via out-of-band `setUserStatus` | Real | ✅ E2E |
| Auth — invite accept | `auth/accept-invite.spec.ts` | Generic 404 for every invalid token, one-time consumption, activation | **Gap**: the session cookie this endpoint sets (`invite.controller.ts:84`) has **no attribute assertion** | ⚠️ PARTIAL |
| Auth — rate limit | `auth/login-throttle.spec.ts` | 3× 401 then 429 | Dedicated app, no leak | ⚠️ PARTIAL — `🐞 BUG-server-e2e-12` |
| Auth — root admin bootstrap | `auth/root-admin.spec.ts` | Provision on boot, idempotent, non-destructive, **boot rejects on misconfiguration** | Real seeder via DI | ✅ E2E |
| Identity — session lifecycle | `users/user-sessions.spec.ts` + `seed.ts` helpers | Expiry, revocation, cross-device isolation | Real | ✅ E2E |
| **Identity — production cookie flags (`Secure`, `SameSite=strict`)** | *(none)* | — | **Structurally impossible**: `cookieSecure: false` hard-coded, no `session` override | ❌ NONE — `🐞 BUG-server-e2e-11` |
| Users / members | 8 spec files, 109 `/api/users` references | Listing, filtering (query builder), detail, invite mint + rotation, revoke, status, update, `isLastAdmin` | Real | ✅ E2E |
| Workspaces | 6 spec files, 112 references | Create, update, archive/unarchive/delete, membership scoping, content grants, member activity | **Gap**: seeded workspaces bypass creator-membership + grant writing (EC-22) | ⚠️ PARTIAL |
| Activity / audit | `activity/activity.spec.ts`, `activity-filter.spec.ts` | Event recording per mutation, actor attribution, query-builder filtering, rollback writes none | **Gap**: stale outbox replay can inject rows (EC-11) | ⚠️ PARTIAL |
| Content — schema & catalogue | `content/content-schema.spec.ts`, `content-types.spec.ts` | Serialized summaries and field schemas, permission gating, grant handover | Real registry | ✅ E2E |
| Content — entries read | `content/list-entries.spec.ts`, `list-entries-relation-filter.spec.ts`, `relation-preview.spec.ts` | Pagination, sort, search, relation filtering incl. soft-delete scoping, opt-in previews, filter-fields | **Gap**: rows are seeded past field validation (EC-25) | ✅ E2E |
| Content — entries write | `content/content-entries-write.spec.ts`, `content-media-fields.spec.ts` | Create/update/publish/delete, relation deltas, media field writes, validation | Real endpoint | ✅ E2E |
| Content — revisions | `content/entry-revisions.spec.ts` | Snapshot on save, list, restore, publish-from-revision | **Gap**: no 504.2.1 preservation assertion (`♿ A11Y-server-e2e-02`) | ⚠️ PARTIAL |
| Content — soft delete / trash / purge | covered within the write + list suites (`paranoid: true` on `test_article`, `test-article.ts:30`) | Tombstoning, exclusion from reads, relation-link survival | Real | ✅ E2E — **note this is the exact surface `apps/admin-e2e` cannot reach** |
| i18n | `i18n/i18n-content.spec.ts`, `insights/localization-insights.spec.ts` | Locale-scoped reads, sibling creates, translation groups, `syncAcrossLocales` opt-out, coverage aggregates | **Gap**: `/api/i18n` locales endpoint thinly referenced (6 hits); no RTL (`♿ A11Y-server-e2e-03`) | ⚠️ PARTIAL |
| Insights | 3 spec files, 57 references | Content totals/stale/pipeline/velocity/unshipped/punchcard, i18n coverage, media storage/uploads/**alt coverage** | Real aggregates | ✅ E2E |
| Media | `media/media-assets.spec.ts`, `media-folders.spec.ts` | Upload/download round-trip, folders, scoping, permissions, delete | **Gap**: only the in-memory provider; local/S3 never booted (EC-34) | ⚠️ PARTIAL |
| API tokens & public content API | 5 spec files, 149 + 23 references | Mint/list/revoke, bearer auth, scopes, workspace binding, expiry, read + **write** paths, GraphQL parity, cost limits, playground kill switch | Real | ✅ E2E |
| MCP | `mcp/mcp.spec.ts` (90 cases) | Auth, workspace resolution, `initialize`, `tools/list`, authorization, discovery, reads, write round-trip, **kill switch** | Real | ✅ E2E |
| Copilot | 6 spec files, 69 references | Run engine, tool loop, SSE frames + order, **permission parking answered mid-stream**, conversations, proposals, skills, media files, read catalogue, ADR-0005 negative path | Fake provider only — by design | ✅ E2E |
| **Copilot — provider adapters (anthropic, openai)** | *(none)* | — | Never registered (`plugins.ts:78`) | ❌ NONE (correct: no network in e2e) |
| **Media — provider adapters (local, s3)** | *(none)* | — | Never registered (`plugins.ts:69`) | ❌ NONE (correct: no filesystem/S3 in e2e) |
| Preferences | `preferences/preferences.spec.ts` | Read/write, per-user scoping | Real | ✅ E2E |
| **Database plugin — outbox & UnitOfWork** | *(none directly)* | Dispatch is exercised transitively via `activity.spec.ts`'s audit rows | **No spec reads `outbox_events`**; retry, `attempts`, `dispatchedAt`, `SKIP LOCKED` all unasserted | ❌ NONE — `🐞 BUG-server-e2e-03` |
| **Tools registry (`tools-server`)** | *(none dedicated)* | `surfaces` gating exercised transitively by `mcp.spec.ts` "discovery" + copilot tool offers | Real registry, one instance | ⚠️ PARTIAL |
| **The app's own content collections (`apps/server/src/content`)** | *(none)* | — | Deliberately decoupled (`plugins.ts:20-27`) | ❌ NONE (accepted trade-off) |

**Coverage tally (harness features, §2):** `35 features · 20 ✅ · 5 ⚠️ · 10 🐞/❌`
**Coverage tally (product areas, this table):** `29 areas · 15 ✅ · 8 ⚠️ · 6 ❌`
**Accessibility tally:** `5 ♿ findings · 2 Supports · 1 Partially Supports · 2 Does Not Support ·
~25 criteria Not Applicable`

---

## 6. 🐞 Potential Bugs

Ranked by severity. Every finding was read in the cited source.

### 🐞 BUG-server-e2e-01 — No CI workflow runs this suite, and the package contradicts itself about it · Severity: Critical

**Location:** `.github/workflows/release.yml:1-60`; `apps/server-e2e/TESTS.md:4-5` vs
`apps/server-e2e/AGENTS.md:99`
**Category:** correctness (process)

> **Verified as stated, and deliberately not widened.** `.github/workflows/` contains
> exactly one file, `release.yml`; its trigger is `workflow_dispatch` only (`:9-19`)
> and its `run:` steps are `npm ci` (`:43`), a git identity setup (`:45-48`),
> `npx nx run-many -t typecheck` (`:53-54`) and `npx nx release` (`:56-57`). The
> accurate claim is **that no workflow is wired up** — not that one was removed, not
> that anything is broken. The suite passes when run; nothing runs it automatically.

**What the code does:** the repository's only workflow is `Release`, manually dispatched, whose
`run:` steps are `npm ci`, a git identity setup, `npx nx run-many -t typecheck`, and
`npx nx release`. There is no `e2e`, `test`, `lint` or `catalog:check` step and no push/PR
trigger.

**Why it is wrong:** `TESTS.md:4-5` asserts "CI runs `npx nx catalog:check server-e2e` and
fails if this file has drifted". `AGENTS.md:99` in the same package says the opposite, and is
correct: "wire this into CI **once a pipeline exists**". 851 API test cases across 51 spec
files (`TESTS.md:7`) — including every authorization, tenant-isolation and cookie assertion in
this repository — execute only when a developer chooses to run them, on a machine with Docker.
The defect is the *absence* of automation plus the *false statement* in `TESTS.md`; the specs
themselves are healthy (0 `it.skip` / `describe.skip` / `.only` / `xit` across all 51 files).

**Repro:**
1. `ls .github/workflows/` → `release.yml`
2. `grep -nE "e2e|jest|catalog|lint" .github/workflows/release.yml` → no matches
→ Observed: no automated execution. Expected: a push/PR workflow.

**Blast radius:** total, and it is the multiplier on every other finding here. Note the
compounding factor specific to this suite: it needs a Docker daemon, so the friction of running
it locally is higher than admin-e2e's — which makes the absence of CI more consequential, not
less.

**Suggested fix:** add a `ci.yml` with a `services: postgres` block (or Docker-in-Docker for
testcontainers) running `npx nx affected -t lint typecheck test e2e` plus both `catalog:check`
targets; correct `TESTS.md`'s claim until it is true.

---

### 🐞 BUG-server-e2e-02 — A migration failure leaks the Postgres testcontainer permanently · Severity: Medium

**Location:** `apps/server-e2e/src/support/global-setup.ts:45-66`;
`apps/server-e2e/src/support/global-teardown.ts:5-13`
**Category:** resource leak

> **Downgraded from High** on verification, and the category corrected from
> "data-loss": nothing is lost. The mechanism is confirmed from source —
> `container.start()` is at `global-setup.ts:41`, `__PG_CONTAINER__` is assigned at
> `:65` after the migration loop, and `global-teardown.ts:6-9` reads that handle and
> no-ops when it is `undefined` — but the consequence is an orphaned container a
> `docker rm -f` clears. **Unverified —** sub-claim (a), that Jest skips
> `globalTeardown` when `globalSetup` throws, could not be executed here
> (`node_modules` is absent); the leak follows from sub-claim (b) alone, which is
> confirmed from source, so the finding does not rest on it.

**What the code does:**

```ts
const plugins = buildTestPlugins(buildTestConfig(connectionString));
const pool = new Pool({ connectionString });
try {
    const db = drizzle(pool);
    for (const plugin of plugins) {
        if (!plugin.migrations) continue;
        await migrate(db, { migrationsFolder: plugin.migrations.dir(), migrationsTable: plugin.migrations.table });
    }
} finally {
    await pool.end();
}

publishDatabaseUrl(connectionString);
(globalThis as any).__PG_CONTAINER__ = container;   // ← line 65
```

Teardown reads that handle:

```ts
const container = (globalThis as any).__PG_CONTAINER__ as StartedPostgreSqlContainer | undefined;
if (container) { await container.stop(); }
```

**Why it is wrong:** the container is started at line 41 but only *published* at line 65 —
after the migration loop. If any plugin's `migrate()` throws, the `finally` closes the pool,
the exception propagates, `__PG_CONTAINER__` is never set, and Jest aborts. Two things then
follow: (a) Jest does not run `globalTeardown` when `globalSetup` throws, and (b) even if it
did, the handle is `undefined`. The container survives, holding a port and a volume, and every
subsequent failed run adds another.

**Repro:**
1. `docker ps --filter ancestor=postgres:16-alpine` → note the count.
2. Append `SELECT 1 FROM nonexistent_table;` to any plugin's newest `.sql` migration.
3. `npx nx e2e server-e2e -- src/server/server.spec.ts`
4. Repeat step 1.
→ Observed: one additional running container, orphaned. Expected: the container is stopped
   whether or not migrations succeed.

**Blast radius:** every failed migration during development leaks a container. On a shared CI
runner this exhausts disk and ports. It also makes migration development — the most
failure-prone activity the harness supports — the exact activity that leaks.

**Suggested fix:** assign `__PG_CONTAINER__` immediately after `container.start()` (before the
migration loop), or wrap the loop in `try { … } catch (e) { await container?.stop(); throw e; }`.

---

### 🐞 BUG-server-e2e-03 — `outbox_events` is never truncated and has no FK, so undispatched rows survive into later tests · Severity: Medium

**Location:** `apps/server-e2e/src/support/seed.ts:392-401`;
`packages/database/migrations/*.sql` (the `outbox_events` DDL — one `CREATE TABLE` and one
index, **no `REFERENCES` clause**);
`packages/database/src/lib/outbox/outbox-dispatcher.ts:22, 76-116, 119-125`
**Category:** race / correctness (isolation)

> **Verified in part; downgraded from High.** Confirmed from source: `outbox_events`
> is absent from the TRUNCATE list (`seed.ts:393-400`), its migration declares one
> `CREATE TABLE` and one `CREATE INDEX` and **no `REFERENCES` clause at all**
> (`packages/database/migrations/0000_*.sql`, read in full), so no cascade from
> `users` or `workspaces` reaches it; the 5 s poll and the retry-with-`attempts + 1`
> path are as described; and no helper anywhere reads the table. **Unverified —**
> consequence 1 (cross-test replay) requires a *subscriber to throw* during a run,
> and nothing in this repository shows that it ever does. Treat the replay as a
> latent hazard the design permits, not an observed flake. Consequences 2 and 3 —
> the suppressed diagnostic and the untestable ADR-0003 invariant — are fully
> confirmed and are what carry the Medium.

**What the code does:**

```ts
export async function resetDb(): Promise<void> {
    await getPool().query(
        'TRUNCATE TABLE users, workspaces, activity_events, ' +
            'content_test_article, content_test_author, content_test_tag, ' +
            'content_test_seo, content_test_comment, content_test_landing, ' +
            'content_test_page, content_entry_revisions, ' +
            'media_asset, media_folder ' +
            'RESTART IDENTITY CASCADE'
    );
}
```

`outbox_events` is absent, and — verified against its migration — it declares no foreign key at
all (only `CREATE INDEX "outbox_events_dispatched_at_idx"`), so the `CASCADE` from `users` and
`workspaces` never reaches it. The dispatcher starts a poll on bootstrap:

```ts
onApplicationBootstrap(): void {
    this.timer = setInterval(() => { void this.pollOnce(); }, POLL_INTERVAL_MS);  // 5_000
    this.timer.unref();
}
```

and drains `WHERE dispatched_at IS NULL` (`:81`), retrying failures with `attempts + 1` (`:109-112`).

**Why it is wrong:** the doc comment on `resetDb` (`seed.ts:380-391`) is explicit about the
principle it is applying — `activity_events` and `content_entry_revisions` are truncated
*precisely because* they have no FK and "no cascade reaches" them. `outbox_events` is the third
table in that category and was missed. Consequences, in order of severity:

1. **Cross-test replay** *(latent — see the Unverified note above)*. An event whose subscriber threw stays undispatched. `resetDb` removes
   the aggregate it references. Five seconds later — inside a *different* test — the poll
   re-delivers it, and `AuditEventSubscriber`
   (`packages/activity/server/src/lib/activity/infrastructure/audit-event.subscriber.ts:37`)
   writes an `activity_events` row that test did not create. `activity.spec.ts` asserts audit
   counts; the failure presents as an off-by-N with no explanation.
2. **The diagnostic is suppressed.** The dispatcher's `logger.error('Delivery failed … will
   retry')` (`outbox-dispatcher.ts:105-108`) is silenced by `logger: false`
   (`test-app.ts:41`), so the one message that would explain the phantom row never prints.
3. **The outbox invariant is untestable.** No helper reads `outbox_events` — `grep -rn "outbox"
   apps/server-e2e/src` returns nothing. ADR-0003's central mechanism has no direct coverage,
   and "a rolled-back mutation leaves no outbox row" cannot be asserted even though the
   `countActivityRows` helper exists for exactly the analogous claim (`seed.ts:372-378`).

**Repro:**
1. `E2E_DATABASE_URL=…/scratch npx nx e2e server-e2e`
2. `psql scratch -c 'SELECT count(*) total, count(dispatched_at) done, max(attempts) FROM outbox_events'`
→ Observed: a non-zero `total` accumulated across the whole run (certain — nothing ever removes
   these rows). Any `attempts > 0` row would be a replay candidate; whether the run produces one
   is the part this artifact could not confirm. Expected: 0, because the table should be
   truncated between tests.

**Blast radius:** today, a permanent coverage hole over ADR-0003's central mechanism and a
suppressed diagnostic. If a subscriber ever does throw, it becomes an intermittent,
unexplainable audit-count failure — the single most expensive category of flake, because it
looks like a product bug, is not reproducible in isolation, and the log that would identify it
is off.

**Suggested fix:** add `outbox_events` to the TRUNCATE list, and add a `countOutboxRows()` /
`getUndispatchedOutboxRows()` helper so the ADR-0003 invariants become assertable.

---

### 🐞 BUG-server-e2e-04 — `E2E_DATABASE_URL` has no guard, and the suite TRUNCATEs whatever it names · Severity: High

**Location:** `apps/server-e2e/src/support/global-setup.ts:22-43`;
`apps/server-e2e/src/support/seed.ts:392-401`
**Category:** data-loss

> **The mechanism is confirmed exactly, and it is the one finding here worth being
> certain about.** `E2E_DATABASE_URL` appears in **three** places in the entire
> repository, all inside `global-setup.ts` — the explanatory comment (`:22-30`), the
> read (`:31`), and the log line (`:37`) — verified by
> `grep -rn E2E_DATABASE_URL apps/server-e2e`. There is **no comparison against
> `DATABASE_URL` anywhere**, no name-pattern check, no host check, no confirmation
> prompt, and no log of the database about to be destroyed. `resetDb()` then runs
> `TRUNCATE … RESTART IDENTITY CASCADE` over 13 tables (`seed.ts:393-400`). Severity
> stays **High**: this is a concrete, reachable, irreversible data-loss path.
> **🔒 stripped** — the marker is defined for auth / authz / tenant-isolation /
> data-leak concerns, and destroying your own development database is none of those;
> it is `data-loss`, which is already the category.
>
> **One claim corrected.** The original repro asserted this is "the exact keystroke a
> developer makes when following `AGENTS.md`'s 'Running without Docker' section". It
> is not. That section (`apps/server-e2e/AGENTS.md:45-57`) names a *distinct*
> database in its example — `postgres://user@127.0.0.1:5432/ortha_e2e` — and warns in
> bold: "**The database it names is truncated between every test.**" The
> documentation warns against the mistake rather than instructing it. What is missing
> is the mechanical backstop behind the prose, which is what this finding is about.

**What the code does:**

```ts
// `E2E_DATABASE_URL` points the run at an already-running Postgres instead
// of starting a container. Deliberately its OWN variable rather than
// reusing `DATABASE_URL`: this suite truncates every table between tests,
// and `DATABASE_URL` is routinely set in a developer's `.env` pointing at
// their working database. An opt-in name cannot be triggered by accident.
//
// The database it names must be disposable.
const external = process.env['E2E_DATABASE_URL'];
…
if (external) {
    console.log('\n[e2e] using E2E_DATABASE_URL (no testcontainer)…');
    connectionString = external;
}
```

**Why it is wrong:** the reasoning is sound and the comment is excellent — and it is entirely
**prose**. The code performs no check whatsoever. It does not compare `external` against
`process.env['DATABASE_URL']`, does not require the database name to match a pattern
(`*_e2e`, `*_test`), does not refuse a non-loopback host, and does not print the database name
it is about to destroy. The distinguishing property the comment relies on — "an opt-in name
cannot be triggered by accident" — protects against *forgetting to unset a variable*, not
against the far more likely mistake of copying one's own connection string into it while
following the documented Docker-less instructions.

`resetDb()` then runs `TRUNCATE … CASCADE` over 13 tables from each suite's `beforeEach` —
before effectively every one of the 851 tests (`login-throttle.spec.ts` is the lone `beforeAll`,
EC-21).
The `CASCADE` reaches sessions, tokens, memberships, workspace grants, API tokens, preferences
and every copilot table. There is no recovery.

**Repro:** (do **not** perform on data you value)
1. `export E2E_DATABASE_URL="$DATABASE_URL"` — the shortcut a developer takes when they already
   have a local Postgres up and reach for their existing connection string rather than
   `createdb`-ing the separate `ortha_e2e` the docs show.
2. `npx nx e2e server-e2e`
→ Observed: the run migrates and passes, and the developer's working database is emptied.
   Expected: the harness refuses to start.

**Blast radius:** total, irreversible loss of a developer's local working data. Severity is
High rather than Critical because it requires a deliberate user action that the package's own
documentation and its `global-setup` comment both warn against — but a bolded warning is not a
guard, and this is the one operation in the harness with no undo.

**Suggested fix:** in `global-setup`, refuse when `external === process.env['DATABASE_URL']`,
require the database name to end in `_e2e`/`_test` (or an explicit
`E2E_DATABASE_URL_I_KNOW_THIS_IS_DISPOSABLE=1`), and log the host + database name it is about
to truncate.

---

### 🐞 BUG-server-e2e-05 — The connection-string handoff uses a fixed temp path that concurrent runs clobber and delete · Severity: Medium

**Location:** `apps/server-e2e/src/support/db-url.ts:14-41`
**Category:** race

**What the code does:**

```ts
const URL_FILE = join(tmpdir(), 'ortha-server-e2e', 'database-url');

export function publishDatabaseUrl(connectionString: string): void {
    process.env['DATABASE_URL'] = connectionString;
    mkdirSync(dirname(URL_FILE), { recursive: true });
    writeFileSync(URL_FILE, connectionString, 'utf8');
}

export function clearDatabaseUrl(): void {
    rmSync(dirname(URL_FILE), { recursive: true, force: true });
}
```

**Why it is wrong:** the path carries no PID, no run id and no port. Two concurrent runs on one
machine — two agent sessions, two branches, a CI matrix on a shared runner, or simply a second
terminal — write the same file, and the first to finish `rmSync`s the *directory* recursively
while the second is still running.

The exposure is narrower than it looks, because `resolveDatabaseUrl` prefers `process.env`
(`db-url.ts:24-28`) and the file is a fallback. But the fallback exists for exactly the
runners where env inheritance does not hold (`:8-12`) — so on those runners, which are the
ones that need it, a concurrent run steers a worker at the *other* run's container. That worker
then TRUNCATEs the other run's database mid-test.

**Repro:**
1. Terminal A: `npx nx e2e server-e2e -- src/server/content`
2. Terminal B (a few seconds later): `npx nx e2e server-e2e -- src/server/users`
3. When A finishes, `ls "$TMPDIR/ortha-server-e2e"`
→ Observed: gone, while B is still running. Expected: each run owns its own handoff.

**Blast radius:** medium locally, higher on shared CI. Also affects an agent workflow where two
sessions run the suite in the same sandbox.

**Suggested fix:** include `process.pid` (of the Jest main process) or a random run id in the
filename, pass it to workers via a dedicated env var, and delete only that file.

---

### 🐞 BUG-server-e2e-06 — `roles` survives `resetDb`, making the permission-less-principal suites retry-hostile · Severity: Medium

**Location:** `apps/server-e2e/src/support/seed.ts:106-135` and `:392-401`; call sites at
`api-tokens/api-tokens-management.spec.ts:184`, `workspaces/workspace-access.spec.ts:142`,
`content/content-schema.spec.ts:79`, `content/list-entries.spec.ts:98`,
`copilot/copilot-chat.spec.ts:127,666`, `copilot/copilot-conversations.spec.ts:277`
**Category:** correctness (isolation)

**What the code does:**

```ts
/**
 * … `roleKey` must be unique across a run (`roles` is not truncated by
 * `resetDb`), so callers pass a suite-specific key and create it once.
 */
export async function seedUserWithEmptyRole(app, opts) {
    const [role] = await db.insert(roles)
        .values({ key: opts.roleKey, name: opts.roleKey, isSystem: false })
        .returning();
    …
}
```

**Why it is wrong:** the constraint is documented and unenforced, and the calls sit **inside
`it` blocks**, not in `beforeAll`. Any mechanism that re-executes a test body within one Jest
process breaks it: `jest.retryTimes(...)`, `--repeat-each`, a watch-mode re-run of the same
`-t` pattern, or a future flake-retry policy in CI. The second execution hits a unique
violation on `roles.key` and fails with a raw Postgres error, not an assertion — so the
symptom points at the database rather than at the harness.

All seven keys are currently distinct (verified: `wsa-empty-role`, `token-mgmt-norights`,
`entries-spec-no-perms`, `copilot-threads-no-perms`, `copilot-no-perms`,
`copilot-models-no-perms`, `content-spec-no-perms`), so today's runs are clean. The defect is
that nothing keeps them distinct and nothing survives a retry.

**Repro:**
1. `npx nx e2e server-e2e -- src/server/content/list-entries.spec.ts --repeat-each=2`
→ Observed: the second pass fails with a duplicate-key violation on `roles`.
   Expected: repeatable.

**Suggested fix:** make the helper upsert (`ON CONFLICT (key) DO UPDATE`) or generate a unique
suffix (`${roleKey}-${randomUUID()}`), and add `roles WHERE is_system = false` to the reset.

---

### 🐞 BUG-server-e2e-07 — The in-memory blob store is never reset and is unreachable from specs · Severity: Medium

**Location:** `apps/server-e2e/src/support/media-storage.ts:25-52`;
`apps/server-e2e/src/support/plugins.ts:69`; `apps/server-e2e/src/support/seed.ts:392-401`
**Category:** correctness (isolation) / coverage gap

**What the code does:**

```ts
export function createInMemoryStorageProvider(): StorageProvider {
    const store = new Map<string, Buffer>();
    return { async put(...) { store.set(storageKey, buffer); … },
             async get(...) { … }, async remove(...) { store.delete(storageKey); }, … };
}
```

The `Map` is closed over, created once per `buildTestPlugins` call (i.e. once per app, so once
per spec file), and never exported.

**Why it is wrong:** two consequences.

1. **`resetDb` truncates `media_asset` but not the bytes.** Every uploaded blob from every test
   in a file accumulates in the worker's heap for the whole file. Keys embed a uuid asset id
   (`media-storage.ts:30`) so collisions are effectively impossible — this is memory growth and
   a stale-state smell rather than a correctness failure today.
2. **"Deleting an asset removes its bytes" is unassertable.** The delete use case calls
   `remove()`, but no spec can observe the store: there is no accessor, and reading through
   `GET` after the row is gone 404s at the row check before storage is touched. An orphaned-blob
   regression — the storage half of a delete silently becoming a no-op — would pass. That is a
   real leak class for the *production* providers (local disk, S3), where orphaned objects cost
   money and retain deleted content.

**Repro:** attempt to write a spec asserting the blob is gone after `DELETE /api/media/assets/:id`.
→ Observed: no API surface exists to check. Expected: the harness should expose the store.

**Suggested fix:** return the `Map` (or a `{ provider, store }` pair) from
`createInMemoryStorageProvider`, expose it through the harness, add `clearMediaStorage()` to the
per-test reset, and add one spec asserting delete removes the bytes.

---

### 🐞 BUG-server-e2e-08 — `closeTestApp` ends the singleton pool without clearing `initDatabase`'s memo · Severity: Medium

**Location:** `apps/server-e2e/src/support/test-app.ts:56-65`;
`packages/database/src/lib/utils/db.ts:5-20`
**Category:** correctness (harness API)

**What the code does:**

```ts
export async function closeTestApp(harness: TestApp): Promise<void> {
    await harness.app.close();
    await getPool().end();
}
```

and the module it ends:

```ts
let pool: Pool | null = null;
let database: Database | null = null;

export function initDatabase(config: DatabasePluginConfig): void {
    if (database) { return; }               // ← idempotent
    pool = new Pool({ connectionString: config.connectionString });
    database = drizzle(pool);
}
```

**Why it is wrong:** `pool` and `database` are never reset. Two latent traps follow:

1. **A second `createTestApp` in one file silently ignores its own connection string.**
   `initDatabase` returns early, so `DatabasePlugin({ connectionString })` at `plugins.ts:49`
   is a no-op for the second app. Benign today (both URLs are identical), but a future
   "boot against a second database" override would connect to the first and the test would
   assert against the wrong data with no error.
2. **`createTestApp` after `closeTestApp` in one file yields an ended pool.** Every query then
   throws `Cannot use a pool after calling end on the pool` — from deep inside a provider,
   with no hint that the harness's own teardown caused it.

The two files that boot a second app already work around this by hand — `mcp.spec.ts:923` calls
`disabled.app.close()` (not `closeTestApp`), and `root-admin.spec.ts:122-124` carries an
explicit comment: "Reuses this file's live DB pool; the failed app is never returned or closed,
so the shared pool stays open for the suite." That the workaround needed a comment is the
signal: the API's contract is implicit and enforced by convention.

**Repro:** in a scratch spec, `const a = await createTestApp(); await closeTestApp(a); const b =
await createTestApp(); await request(b.server).get('/api/auth/me');`
→ Observed: pool-after-end error. Expected: either a fresh pool or a clear harness error.

**Suggested fix:** add a `resetDatabase()` to `packages/database` that nulls both memos, call it
from `closeTestApp`, and document the one-app-at-a-time contract in `test-app.ts`'s JSDoc.

---

### 🐞 BUG-server-e2e-09 — `createTestApp` skips `setupApiDocs`, and AGENTS.md claims it does not · Severity: Medium

**Location:** `apps/server-e2e/src/support/test-app.ts:16-26, 40-51`;
`apps/server-e2e/src/support/test-config.ts:68-72`;
`packages/bootstrap/server/src/lib/create-server.ts:36-38`; `apps/server-e2e/AGENTS.md`
**Category:** correctness (fidelity + coverage gap)

**What the code does:** `createServer` runs, in order: plugin init → `NestFactory.create` →
prefix → `ValidationPipe` → **`setupApiDocs(app, plugins, docs, globalPrefix)`** → `listen`.
`createTestApp` runs the same sequence minus `setupApiDocs` and `listen`, and with
`logger: false`.

**Why it is wrong:** `test-app.ts:20-21` states "the only difference from production is 'init,
don't listen'", and `AGENTS.md` repeats it ("stops at `app.init()` instead of `listen()`").
There are three differences, and one of them removes a whole production-reachable surface.
`setupApiDocs` generates the OpenAPI document from every plugin's descriptors and mounts the
Scalar reference at `/reference` and `/reference/json`, gated by `API_DOCS` (root `AGENTS.md`,
"Commands"). That means:

- **Zero coverage** that the OpenAPI document generates at all. A plugin shipping a malformed
  `PluginApiDocs` descriptor breaks a production boot and passes every one of 851 tests.
- **Zero coverage** that `/reference` is *off* in production, which is a security property
  (the same flag also gates the GraphiQL playground — and note that half *is* covered, by
  `public-graphql-playground.spec.ts` via `docsEnabled`, which proves the pattern is available).
- `logger: false` additionally suppresses the outbox dispatcher's error output, compounding
  `🐞 BUG-server-e2e-03`.

The `test-config.ts:68-72` comment is accurate and honest about the omission; the AGENTS.md and
`test-app.ts` claims are not.

**Repro:** `grep -n "setupApiDocs" apps/server-e2e/src/support/test-app.ts` → no matches;
`grep -n "reference" apps/server-e2e/src --include=*.spec.ts` → no matches.

**Suggested fix:** either call `setupApiDocs` in `createTestApp` (gated on `docsEnabled`, which
already exists) and add two cases — document generates with `docs.enabled: true`, `/reference`
404s with `false` — or correct the two "only difference" claims.

---

### 🐞 BUG-server-e2e-10 — Seeders bypass the domain validation the endpoints under test enforce · Severity: Medium

**Location:** `apps/server-e2e/src/support/seed.ts:149-170` (`seedWorkspace`), `:179-188`
(`seedContentGrants`), `:489-627` (content seeders); contrast
`packages/workspaces/server/src/lib/workspace/application/use-cases/create-workspace.use-case.ts:47-70`
**Category:** correctness (seeding fidelity)

**What the code does:**

```ts
export async function seedWorkspace(opts) {
    const [workspace] = await getDatabase().insert(workspaces)
        .values({ name: opts.name, slug: opts.slug, description: opts.description ?? null,
                  ...(opts.color ? { color: opts.color } : {}) })
        .returning();
    …
}
```

The endpoint does considerably more:

```ts
const slug = Slug.create(dto.slug);
const color = WorkspaceColor.create(dto.color);
return this.uow.run(async () => {
    await this.slugUniqueness.assertAvailable(slug);
    const memberUserIds = await this.provisioner.resolve(dto.members);
    const grants = resolveGrants(dto.content, this.catalog.knownSlugs());
    const workspace = Workspace.create({ …, creatorUserId: actor.id, memberUserIds, grants });
    …
});
```

**Why it is wrong:** the `server-e2e` skill's own non-negotiable is "seed through DI, never raw
bcrypt/SQL for credentials" — and `seedUser` honours that beautifully. The workspace and
content seeders do not extend the principle. Three concrete divergences:

1. **A seeded workspace has no creator membership and no content grants.** The API always
   writes both. Every suite that seeds a workspace is asserting against a state the running
   system cannot produce, and must remember to add memberships and grants by hand — which
   `seedContentGrants`'s own doc comment (`seed.ts:172-178`) warns about, because forgetting it
   produces confusing 404s.
2. **`seedContentGrants` skips the registry check and defaults `kind` to `'collection'`**
   (`seed.ts:181-187`). `resolveGrants` validates the slug against `catalog.knownSlugs()`. A
   grant for a *single* written with the default kind is a row the API would never write —
   and exactly one of the call sites passes `'single'`
   (`api-tokens/public-content-api.spec.ts:469`).
3. **`seedArticles`/`seedAuthors`/`seedTags`/`seedPages`/`seedLanding` cast `as never` and
   insert raw** (`seed.ts:502-507` and siblings), bypassing every field rule declared on the
   type — `required`, `minLength: 3`, `max: 120`, the `select` option set
   (`src/support/content/test-article.ts:33-96`). I audited every `seedArticles` call site and
   **no current spec seeds an out-of-range value** — the only long string is `richtext`, which
   has no `maxLength` (`copilot/copilot-chat.spec.ts:998`). The capability is unguarded rather
   than presently abused.

**Repro:**
1. In a scratch spec, `await seedArticles([{ text: 'ab', select: 'nope' }], ws.id)` — a title
   below `minLength` and a value outside the option set.
2. `GET /api/content/test_article`
→ Observed: the row is returned and every list/filter assertion works against it. Expected: a
   row the API could never have created should not be reachable through a seeder without a
   deliberate opt-in.

**Blast radius:** medium. Read-path suites can assert behaviour over impossible data, which is
the classic way a passing e2e suite stops describing the product.

**Suggested fix:** route `seedWorkspace` through `CreateWorkspaceUseCase` from DI (mirroring
`provisionRootAdmin`, `seed.ts:295-300`), and either validate content rows against the type's
field specs or rename the helpers to `seedRawArticles` so the bypass is explicit at every call
site — the same honesty `setUserStatus`'s doc comment already applies (`seed.ts:237-242`).

---

### 🐞 BUG-server-e2e-11 — Production cookie attributes are structurally untestable, and the one assertion pins the test-only value · Severity: Medium

**Location:** `apps/server-e2e/src/support/test-config.ts:30-58` (`TestConfigOverrides`) and
`:80-84`; `apps/server-e2e/src/server/auth/login.spec.ts:76-89`
**Category:** correctness (coverage gap) · 🔒-adjacent

**What the code does:**

```ts
session: {
    ttlSeconds: 60 * 60 * 24 * 7,
    cookieSecure: false,
    cookieSameSite: 'lax'
},
```

`TestConfigOverrides` exposes `rateLimit`, `allowedOrigins`, `rootAdmin`, `graphqlLimits`,
`docsEnabled` and `mcpEnabled` — **no `session` key**. The suite then asserts:

```ts
expect(raw).toMatch(/HttpOnly/i);
expect(raw).toMatch(/SameSite=Lax/i);
expect(raw).toMatch(/Path=\//i);
expect(raw).toMatch(/Max-Age=604800/);
// cookieSecure is false in the test config (plain HTTP).
expect(raw).not.toMatch(/Secure/i);
```

**Why it is wrong:** this is the most thorough cookie assertion in the repository and it is
worth keeping — but the last line pins a **test-only** value. `not.toMatch(/Secure/i)` says
nothing about production, where `cookieSecure` must be `true`; and because no override exists,
there is no way to boot an app with `cookieSecure: true` or `cookieSameSite: 'strict'` and
assert the flag is actually emitted. The `CookieService` branch that adds `Secure` therefore
has **zero coverage**, as does the `strict`/`none` branch of `SameSite`.

A session cookie shipping without `Secure` is a plaintext-interception bug of the first order,
and it is the one property of that cookie the harness cannot check.

**Repro:** attempt `createTestApp({ session: { cookieSecure: true } })` → TypeScript rejects it;
`TestConfigOverrides` has no such field.

**Suggested fix:** add `session?: Partial<IdentitySessionConfig>` to `TestConfigOverrides`, and
add a suite booting with `{ cookieSecure: true, cookieSameSite: 'strict' }` that asserts both
attributes appear. `cookieSecure: false` must remain the default so plain-HTTP supertest
requests keep working.

---

### 🐞 BUG-server-e2e-12 — The throttle suite resets in `beforeAll` and its one test is internally order-dependent · Severity: Low

**Location:** `apps/server-e2e/src/server/auth/login-throttle.spec.ts:19-47`
**Category:** correctness (fragility)

**What the code does:**

```ts
beforeAll(async () => {
    harness = await createTestApp({ rateLimit: { ttlSeconds: 60, limit: 3 } });
    await resetDb();
    await seedActiveUser(harness.app, { email: EMAIL, password: PASSWORD, role: 'viewer' });
});
…
it('returns 429 once the limit is exceeded', async () => {
    await attempt().expect(401);
    await attempt().expect(401);
    await attempt().expect(401);
    await attempt().expect(429);
});
```

**Why it is wrong:** every other suite in the harness uses `beforeEach(resetDb + seed)`
(`AGENTS.md`, "Conventions"). This one uses `beforeAll`, which is correct *today* because the
throttle bucket is consumed by the single test and a `beforeEach` reset would not clear the
in-memory counter anyway. But the file is one added test away from breaking: a second `it`
inherits a bucket with 4 of 3 consumed and a 60-second TTL, so it 429s on its first request and
fails for a reason unrelated to what it asserts. Nothing in the file warns a future author.

Related: the four requests inside the single test are strictly order-dependent, which is
inherent to what is being asserted and fine — but it means the test cannot be split.

**Suggested fix:** add a comment stating that this file must contain exactly one test, or give
each test its own app so the bucket is fresh.

---

### 🐞 BUG-server-e2e-13 — The copilot fake-provider facade has no per-test reset · Severity: Low

**Location:** `apps/server-e2e/src/support/copilot.ts:18-66`;
`apps/server-e2e/src/server/copilot/copilot-chat.spec.ts:61-66` (the file-level `beforeEach`,
which resets `fixtures.invoked` but not the provider)
**Category:** correctness (isolation)

**What the code does:**

```ts
let current = createFakeProvider({ models: [...MODELS] });
export const fakeProvider: ModelProvider = { … stream: (r, s) => current.stream(r, s) };

export function scriptCopilot(...turns: FakeTurn[]): void {
    current = createFakeProvider({ script: turns, models: [...MODELS] });
}

export function copilotCalls(): readonly ModelRequest[] { return current.calls; }
```

**Why it is wrong:** `current` is replaced only when a test calls `scriptCopilot`. Jest isolates
module registries per **file**, so no script crosses a file boundary — that part is sound and
documented (`copilot.ts:28-32`). Within a file it is convention-only: `scriptCopilot` is called
from nested `beforeEach` blocks (`copilot-chat.spec.ts:114-116`, `:189`), not from the file's
top-level `beforeEach` (`:61-66`). A test in a describe block that lacks one inherits the
previous block's script **and its call log**, so `copilotCalls()` can return another test's
requests. Given `copilotCalls()` is the assertion target for the ADR-0005 mandatory negative
path ("a viewer is not offered write tools"), a stale log is exactly the wrong thing to assert
on.

56 `scriptCopilot` calls vs 30 `copilotCalls` uses across the suite suggests current discipline
is good; the hazard is that nothing enforces it.

**Suggested fix:** add `resetCopilot()` (re-instantiating `current` with no script, so an
unscripted call throws) and call it from a top-level `beforeEach` in every copilot spec.

---

### 🐞 BUG-server-e2e-14 — Cross-plugin migration ordering is load-bearing and unasserted · Severity: Low

**Location:** `apps/server-e2e/src/support/plugins.ts:36-90`;
`apps/server-e2e/src/support/global-setup.ts:52-59`
**Category:** correctness (fragility)

**What the code does:** `global-setup` iterates `buildTestPlugins(...)` in array order and
applies each plugin's migrations sequentially against one pool, outside any wrapping
transaction. The array order encodes real FK dependencies — `copilot_conversations` references
both `users` (identity) and `workspaces`; `copilot_skills`, `copilot_proposals` and
`copilot_workspace_policies` likewise; `api_tokens` references `users`. The comment at
`plugins.ts:31-34` documents the *boot* rationale ("DatabasePlugin first… identity before
workspaces… i18n after content") but not the *migration* one.

**Why it is wrong:** reordering the array — a plausible edit when adding a plugin — produces a
raw Postgres `relation "workspaces" does not exist` from inside drizzle's migrator, in global
setup, before any test names itself. Nothing in the harness explains that ordering was the
cause. There is also no assertion anywhere that the applied schema is complete: a plugin whose
`migrations` descriptor is accidentally omitted is simply skipped (`global-setup.ts:53`,
`if (!plugin.migrations) continue;`) and the failure surfaces later as a missing-table error in
whichever suite touches it first.

**Suggested fix:** add a post-migration sanity check in `global-setup` asserting an expected set
of tables exists, and extend the `plugins.ts` comment to state that the order is a migration
dependency, not only a boot one.

---

### 🐞 BUG-server-e2e-15 — The harness's SSE parser requires a space after `data:`; the client's does not · Severity: Low

**Location:** `apps/server-e2e/src/support/sse.ts:13`; contrast
`packages/copilot/admin/src/lib/application/runStream.ts:138`
**Category:** correctness (contract drift between the two harnesses)

**What the code does:**

```ts
// apps/server-e2e/src/support/sse.ts:13
const data = trimmed.split('\n').find((line) => line.startsWith('data: '));
return data ? (JSON.parse(data.slice('data: '.length)) as CopilotRunEvent) : undefined;
```

```ts
// packages/copilot/admin/src/lib/application/runStream.ts:138
const data = frame.split('\n').find((line) => line.startsWith('data:'));
…
return JSON.parse(data.slice('data:'.length).trim()) as CopilotRunEvent;
```

**Why it is wrong:** the SSE specification treats the space after the colon as optional. The
server currently writes one (`sse-stream.ts:61`), so both parsers work. But the two parsers
encode different contracts: if the server ever emitted `data:{…}` — a legitimate change, and
the shape a minifier or a different serializer would produce — the **production client would
keep working and the test harness would silently see zero frames**, so every copilot SSE suite
would fail with an empty frame list rather than a meaningful message. The failure would look
like the run engine broke.

Note the related asymmetry with the front-end harness, which has the mirror-image problem: its
mock never emits an `event:` line at all (see `docs/testing/app-admin-e2e.md`,
`🐞 BUG-admin-e2e-04`). Between the two harnesses, no test anywhere pins the real wire format.

**Suggested fix:** align `sse.ts` with `runStream.ts` (`startsWith('data:')` + `.trim()`), and
add one server-side assertion on the raw `res.text` that a frame carries both the
`event: <type>` line and its `data:` payload — closing the gap on both sides at once.

---

**Tally:** 15 🐞 — 1 Critical · 1 High · 9 Medium · 4 Low · 0 🔒 (BUG-04's was stripped
on verification: data-loss, not an auth/authz/tenant-isolation/data-leak concern) ·
**0 deleted** on verification · 8 corrected in place · 2 carrying an `Unverified —`
qualifier (BUG-02's Jest `globalTeardown` behaviour, BUG-03's cross-test replay).
Two findings were downgraded (BUG-02 High→Medium, BUG-03 High→Medium) because their
impact is a leaked container and a coverage hole rather than a reachable exploit or
data loss.
**♿ tally:** 5 ♿ — 2 Supports (A11Y-01, -05) · 1 Partially Supports (A11Y-04) ·
2 Does Not Support (A11Y-02, -03, both schema-level) · 0 Not Applicable as findings,
with ~25 success criteria and Chapter 5 provisions recorded Not Applicable in §4A
because this unit renders nothing.

---

## 7. Recommended E2E Tests

Ordered by value. Prose only.

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | CI (not a spec) | `.github/workflows/ci.yml` | On push and PR: `lint`, `typecheck`, `test`, `e2e admin-e2e`, `e2e server-e2e`, `catalog:check` for both. Without this, every row below is optional. | `🐞 BUG-server-e2e-01` |
| 2 | harness change | `src/support/global-setup.ts:22-43` | Refuse to start when `E2E_DATABASE_URL === DATABASE_URL` or the database name lacks an `_e2e`/`_test` suffix; log the host + database about to be truncated. | `🐞 BUG-server-e2e-04`, EC-06 |
| 3 | harness change | `src/support/global-setup.ts:41-65` | Publish `__PG_CONTAINER__` immediately after `start()`, or wrap the migration loop in `try/catch → container.stop()`. | `🐞 BUG-server-e2e-02`, EC-01 |
| 4 | harness change + new spec | `src/support/seed.ts:392` + `src/server/database/outbox.spec.ts` (new) | Add `outbox_events` to the TRUNCATE list; add `countOutboxRows`/`getUndispatchedOutboxRows` helpers; assert (a) a committed mutation writes exactly one outbox row and it is dispatched, (b) a rolled-back mutation writes none, (c) a throwing subscriber increments `attempts` and leaves the row undispatched. | `🐞 BUG-server-e2e-03`, EC-09/10/11/42 |
| 5 | server-e2e | `src/server/auth/login.spec.ts` (extend) or a new `session-cookie.spec.ts` | Boot with `{ session: { cookieSecure: true, cookieSameSite: 'strict' } }` (needs the override added first) and assert `Secure` and `SameSite=Strict` are emitted. | `🐞 BUG-server-e2e-11` |
| 6 | server-e2e | `src/server/auth/accept-invite.spec.ts` (extend) | The invite-accept response's `Set-Cookie` carries the same attribute set login's does (`HttpOnly`, `SameSite`, `Path`, `Max-Age`) — currently asserted for login only. | EC (F33 step 3) |
| 7 | harness change | `src/support/db-url.ts:14` | Scope `URL_FILE` by run id / PID; delete only that file in teardown. | `🐞 BUG-server-e2e-05`, EC-05 |
| 8 | harness change | `src/support/seed.ts:113-135` | Make `seedUserWithEmptyRole` idempotent (`ON CONFLICT (key) DO UPDATE` or a random suffix); add non-system roles to the reset. | `🐞 BUG-server-e2e-06`, EC-12 |
| 9 | server-e2e | `src/server/bootstrap/api-docs.spec.ts` (new) | With `{ docsEnabled: true }` the OpenAPI document generates and `/reference/json` returns a valid document naming every plugin's routes; with `false`, `/reference` 404s. Requires `createTestApp` to call `setupApiDocs`. | `🐞 BUG-server-e2e-09` |
| 10 | harness change + spec | `src/support/media-storage.ts` + `src/server/media/media-assets.spec.ts` | Expose the blob `Map`; clear it per test; assert `DELETE /api/media/assets/:id` removes the bytes, not just the row. | `🐞 BUG-server-e2e-07`, EC-13 |
| 11 | harness change | `src/support/seed.ts:149-170` | Route `seedWorkspace` through `CreateWorkspaceUseCase` from DI (mirroring `provisionRootAdmin`), so a seeded workspace has the creator membership and grants the API always writes. | `🐞 BUG-server-e2e-10`, EC-22/23/24 |
| 12 | harness change | `packages/database` + `src/support/test-app.ts:62-65` | Add `resetDatabase()` clearing `initDatabase`'s memo; call it from `closeTestApp`; document the one-app-at-a-time contract. | `🐞 BUG-server-e2e-08`, EC-16/17 |
| 13 | server-e2e | `src/server/content/entry-revisions.spec.ts` (extend) | 504.2.1: a richtext body containing `<th scope="col">`, a `<caption>` and an `<img alt>` survives save → revision snapshot → restore byte-for-byte; and a media field's alt still resolves after a locale copy. | `♿ A11Y-server-e2e-02` |
| 14 | server-e2e | `src/server/i18n/i18n-content.spec.ts` (extend) + `test-config.ts` | Add an RTL locale to the e2e config and assert `GET /api/i18n/locales` exposes enough for a client to set `dir` — which today it cannot. Files the schema gap on `i18n-server`. | `♿ A11Y-server-e2e-03` |
| 15 | harness change | `src/support/copilot.ts` | Add `resetCopilot()` (unscripted → throws on use); call it from a top-level `beforeEach` in all six copilot specs. | `🐞 BUG-server-e2e-13` |
| 16 | harness change + spec | `src/support/sse.ts:13` + `src/server/copilot/copilot-chat.spec.ts` | Align the parser with the client's (`'data:'` + trim); add one assertion on the raw `res.text` that each frame carries `event: <type>` **and** `data:`, pinning the wire format neither harness currently checks. | `🐞 BUG-server-e2e-15` |
| 17 | server-e2e | `src/support/global-setup.ts` (post-migration check) | Assert an expected table set exists after the migration loop, so a dropped `migrations` descriptor fails in setup rather than in an unrelated suite. | `🐞 BUG-server-e2e-14` |
| 18 | server-e2e | `src/server/copilot/copilot-chat.spec.ts` (extend) | Abort the client mid-stream via `streamSse` and assert the run stops and no further effects are applied — exercising `SseStream.onClientDisconnect` (`sse-stream.ts:78-99`). | EC-44 |
| 19 | server-e2e | `src/server/content/encoding.spec.ts` (new) | Round-trip an RTL string, an emoji, a CJK string and a whitespace-only value through create → list → search → GraphQL; assert `ILIKE` search folds correctly. | EC-32 |
| 20 | server-e2e | `src/server/media/upload-limits.spec.ts` (new) | A body at exactly `maxUploadBytes` succeeds, one byte over is rejected with the right status; a filename containing `../` does not escape the storage key. | EC-33, EC-34 |
| 21 | server-e2e | `src/server/tools/registry.spec.ts` (new) | ADR-0007 directly: a tool marked `surfaces: ['copilot']` is absent from `tools/list` on MCP and present in the copilot's offer, and vice versa; omitting `surfaces` offers it to both. | Tools-registry ⚠️ row |
| 22 | server-e2e | `src/server/workspaces/concurrency.spec.ts` (new) | Two overlapping requests race the "last admin" and unique-slug invariants; assert exactly one wins and the loser gets a domain error rather than a constraint violation. | EC-41 |
| 23 | harness change | `src/support/seed.ts:489-627` | Rename the raw content seeders (`seedRawArticles`, …) or validate rows against the type's field specs, so the bypass is explicit at every call site. | `🐞 BUG-server-e2e-10`, EC-25 |
| 24 | server-e2e | `src/server/auth/login-throttle.spec.ts` | Add a guard comment (or per-test app) documenting that the file must hold one test because the bucket is not reset. | `🐞 BUG-server-e2e-12`, EC-21 |
| 25 | docs | `apps/server-e2e/AGENTS.md`, `apps/server-e2e/TESTS.md:4` | Correct the "only difference from production" claim and the "CI runs catalog:check" claim. | `🐞 BUG-server-e2e-01`, `-09` |

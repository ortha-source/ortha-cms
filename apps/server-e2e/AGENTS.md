# @ortha-cms/server-e2e

End-to-end tests for the NestJS API (`apps/server`). They boot the **real**
server **in-process** against a throwaway Postgres **testcontainer** and drive
it with `supertest`. There is no separate running server, no Docker Compose, no
child process — `npx nx e2e server-e2e` is self-contained (it does need a
running Docker daemon for testcontainers).

> Authoring or extending these suites is governed by the **`server-e2e`**
> skill — read it before adding a suite or a harness helper.

## How a run works

1. **`src/support/global-setup.ts`** starts one `postgres:16-alpine` container
   and applies **each plugin's own migration descriptor** (`{ dir, table }`) —
   the same path `server:db:migrate` uses — so the schema under test is the real
   shipped schema (e.g. identity's `__drizzle_migrations_identity`). The
   connection string is published to the worker (`db-url.ts`: env + temp-file
   fallback). `global-teardown.ts` stops the container.
2. **`src/support/test-app.ts`** — `createTestApp(overrides?)` boots the server
   in-process, mirroring `createServer` (real `buildPlugins`, global `api`
   prefix, strict `ValidationPipe`) but stops at **`app.init()`** instead of
   `listen()`. `app.init()` still runs the `OnApplicationBootstrap` seeders
   (system roles). Suites drive `harness.server` (`getHttpServer()`) with
   supertest. `closeTestApp` closes the app and the per-file DB pool.
3. **`src/support/copilot.ts`** — the copilot harness. `scriptCopilot(...turns)`
   scripts the fake model for one test; `copilotCalls()` returns every
   `ModelRequest` served, which is the assertion target for the negative path
   ADR-0005 makes mandatory (*a viewer's run must be verified not to be offered
   write tools* — an assertion about `calls[0].tools`, made without a model).
   The object registered with `CopilotPlugin` is a **stable delegating facade**,
   because the plugin list is built once per spec file while each test needs its
   own script, and `createFakeProvider` takes its script at construction.
   `src/support/copilot-fixture-tools.ts` supplies propose/apply tools that
   phase 1 otherwise has none of — without them "a viewer is offered no write
   tools" would pass vacuously.
4. **`src/support/seed.ts`** — `seedUser` / `seedActiveUser` insert through the
   app's **real `HashingService`** (pulled from DI), so seeded credentials match
   what login verifies. `resetDb()` truncates the mutable tables, leaving the
   seeded system roles. Plus `expireUserSessions` / `revokeUserSessions` /
   `deleteUser` / `countUserSessions` for session-lifecycle assertions, and
   `setUserStatus` for the out-of-band suspension the API never performs (its
   disable endpoint revokes sessions in the same transaction).

## Conventions

- **One suite per endpoint/concern**, grouped by feature folder under
  `src/server/` — e.g. auth suites live in `src/server/auth/`
  (`login.spec.ts`, `logout.spec.ts`, `me.spec.ts`, …); the folder names the
  domain so the file doesn't repeat it. Bootstrap/health stays at
  `src/server/server.spec.ts`. `beforeAll(createTestApp)` /
  `afterAll(closeTestApp)`; `beforeEach(resetDb + seed)` for a clean slate.
- **Boot the real app** via `createTestApp` — never re-declare `NestFactory` /
  prefix / pipe in a spec (that drifts from prod). `bootstrap-server` stays
  untouched.
- **Seed through DI**, never raw bcrypt/SQL for credentials.
- **Cookie flows** use a `supertest.agent(harness.server)` so `Set-Cookie` from
  login is carried into the next request; for single requests forward the
  `ortha_session=...` pair explicitly via `.set('Cookie', …)`.
- `src/support/**` is exempt from `@nx/enforce-module-boundaries` (it
  deliberately imports the host app and a plugin internal); **specs are not** —
  keep cross-project imports in the support harness. (This is why the copilot
  suite reaches DI through `registerCopilotTools` / `copilotToolCallRows`
  helpers rather than importing `@ortha-cms/copilot-server` directly.)

## Gotchas

- **`@Post` returns `201` by default** (no `@HttpCode` on login/logout), not 200. Assert `201`.
- **Rate limit:** the app boots with a relaxed login limit so suites don't
  self-throttle. To test the `429` path, boot a dedicated app with
  `createTestApp({ rateLimit: { ttlSeconds, limit } })`. The throttle is
  per-app + in-memory, so it never bleeds across suites.
- **`maxWorkers: 1`** — one shared container; suites run serially so they don't
  race on `resetDb`. Parallelism later would need a DB-per-worker scheme.
- Each spec **file** gets its own module registry (own app instance, own pool,
  own throttler) — that's why `closeTestApp` ends the pool per file.

## Test catalog

[`TESTS.md`](./TESTS.md) is a **generated** browsable index of every
`describe`/`it` case, built by parsing the spec AST (`tools/generate-test-catalog.mjs`)
— it never runs Jest, so it needs no Docker. **Don't edit it by hand.** After
adding, renaming, or removing a test, run `npx nx catalog server-e2e` and commit
the result. `npx nx catalog:check server-e2e` fails if it has drifted (wire this
into CI once a pipeline exists).

## Commands

- `npx nx e2e server-e2e` — run the suites (needs Docker running).
- `npx nx lint server-e2e` / `npx nx typecheck server-e2e`.
- `npx nx catalog server-e2e` — regenerate `TESTS.md` from the specs.
- `npx nx catalog:check server-e2e` — fail if `TESTS.md` is stale.

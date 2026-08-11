# @ortha-cms/bootstrap-server — Test Artifact

> **Unit:** `packages/bootstrap/server` · **Package:** `@ortha-cms/bootstrap-server` · **Kind:** host
> **Source of truth:** `packages/bootstrap/server/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns.** Exactly one thing: turning `ServerPlugin[]` into a running NestJS process.
Concretely — the `onPluginInit` pass (`create-server.ts:21-23`), the dynamic root module
that imports every plugin's module (`server.module.ts:11-16`), the global route prefix and
the strict `ValidationPipe` (`create-server.ts:27-34`), the OpenAPI document + Scalar
reference (`utils/setup-api-docs.ts`), and `app.listen` (`create-server.ts:40`).

**Does NOT own.** No guards (`AGENTS.md` "Not owned here"), no auth, no sessions, no CORS
call, no exception filter, no interceptor, no shutdown hook, no schema, no migrations
(it only *declares* the `migrations` descriptor shape — `@ortha-cms/nx` applies them), no
health endpoint, no logger configuration, no rate limiting, and no plugin registry: the
list is handed in by `apps/server/src/plugins.ts`.

**Entry points**

| Export | Shape | Where |
| --- | --- | --- |
| `createServer(options)` | `(CreateServerOptions) => Promise<void>` | `src/lib/create-server.ts:13` |
| `ServerModule.forRoot(plugins)` | `(ServerPlugin[]) => DynamicModule` | `src/lib/server.module.ts:11` |
| `setupApiDocs(app, plugins, docs?, prefix?)` | returns `{path,jsonPath} \| null` | `src/lib/utils/setup-api-docs.ts:80` |
| `ServerPlugin`, `CreateServerOptions` | types | `src/lib/types/server-plugin.ts:9,42` |
| `ApiDocsOptions` | type | `src/lib/types/api-docs.ts:8` |
| `PluginApiDocs`, `ApiSecurityScheme`, `OpenApiDocument` | types | `src/lib/types/plugin-api-docs.ts` |

**HTTP routes the host itself mounts** (on the http adapter, *outside* the global prefix,
*outside* every guard and the `ValidationPipe` — `setup-api-docs.ts:139,141`):

| Verb | Path | Handler |
| --- | --- | --- |
| `GET` | `/reference/json` (default) | raw OpenAPI JSON — `setup-api-docs.ts:137-139` |
| `GET` | `/reference` (default) | Scalar UI — `setup-api-docs.ts:141-148` |

**Runtime prerequisites**

- Postgres reachable (`docker compose up -d`) — not for the host itself, but the first
  plugin in the list (`DatabasePlugin`) opens a pool in `onPluginInit`.
- `.env` with `DATABASE_URL`; `SESSION_SECRET` / `TOKEN_SECRET` for identity.
- `NODE_ENV` and/or `API_DOCS` decide whether the reference mounts
  (`apps/server/ortha.config.ts:87-89` → `setup-api-docs.ts:87`).
- `PORT` (default 3000), and the host's `globalPrefix` (`'api'`, `ortha.config.ts:79`).

**How to exercise it manually**

```bash
docker compose up -d
npx nx run server:db:migrate
npm run dev                      # or: npx nx serve server
curl -i http://localhost:3000/api/does-not-exist          # 404 under the prefix
curl -s http://localhost:3000/reference/json | head -c 400 # OpenAPI doc, no auth
open http://localhost:3000/reference                       # Scalar UI
API_DOCS=false npx nx serve server                         # docs off
NODE_ENV=production npx nx serve server                    # docs off by default
```

**Dependencies that must be healthy.** `@nestjs/core` + `@nestjs/platform-express`
(the http adapter's `.get(path, handler)` is what the docs routes use),
`@nestjs/swagger` ≥ 11.4.6, `@scalar/nestjs-api-reference`, and — for the Scalar UI to
render — outbound access to the jsDelivr CDN unless `docs.cdn` points at a local bundle
(`api-docs.ts:26-30`).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Run every plugin's `onPluginInit` sequentially, in registration order, before the Nest app is created | `src/lib/create-server.ts:21-23` | ⚠️ PARTIAL |
| F2 | Build the root module importing every plugin's `module` | `src/lib/server.module.ts:11-16` | ✅ E2E |
| F3 | Apply the global route prefix (default `api`) | `src/lib/create-server.ts:27` | ✅ E2E |
| F4 | Apply the strict global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`) | `src/lib/create-server.ts:28-34` | ✅ E2E |
| F5 | Listen on `port` (default 3000) and log the boot line | `src/lib/create-server.ts:40-43` | ❌ NONE |
| F6 | Gate the API reference on `docs.enabled`, defaulting to `NODE_ENV !== 'production'` | `src/lib/utils/setup-api-docs.ts:87,96-98` | ❌ NONE |
| F7 | Merge every plugin's `docs.securitySchemes` into the document | `src/lib/utils/setup-api-docs.ts:106-111` | ❌ NONE |
| F8 | Advertise every plugin's `docs.defaultSecurity` as OR-ed document-level requirements | `src/lib/utils/setup-api-docs.ts:112-114` | ❌ NONE |
| F9 | Generate the OpenAPI document with `autoTagControllers: false` | `src/lib/utils/setup-api-docs.ts:119-121` | ❌ NONE |
| F10 | Re-tag every operation by its resource (first segment after the prefix) | `src/lib/utils/setup-api-docs.ts:42-65` | ❌ NONE |
| F11 | Run each plugin's `docs.decorate(document)` last, in registration order | `src/lib/utils/setup-api-docs.ts:127-129` | ❌ NONE |
| F12 | Serve raw OpenAPI JSON at `docs.jsonPath` (default `/reference/json`), registered first | `src/lib/utils/setup-api-docs.ts:137-139` | ❌ NONE |
| F13 | Serve the Scalar UI at `docs.path` (default `/reference`), optionally from a custom `cdn` | `src/lib/utils/setup-api-docs.ts:141-148` | ❌ NONE |
| F14 | Normalise a docs path that lacks a leading slash | `src/lib/utils/setup-api-docs.ts:29-31` | ❌ NONE |
| F15 | Expose the `ServerPlugin.migrations` descriptor (`dir` thunk + per-plugin `table`) for the migrate target to read | `src/lib/types/server-plugin.ts:27-32` | ⚠️ PARTIAL |
| F16 | Return the mounted doc paths (or `null` when disabled) from `setupApiDocs` | `src/lib/utils/setup-api-docs.ts:85,97,152` | ❌ NONE |

## 3. Manual Test Plan

### F1 — Plugin `onPluginInit` runs in order, before the app

**Preconditions:** a checkout with `.env` (`DATABASE_URL` set), Postgres up.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx serve server` | Boot succeeds; final log line is `🚀 Application is running on: http://localhost:3000/api` |
| 2 | Temporarily reorder `apps/server/src/plugins.ts:54-55` so `IdentityPlugin(...)` precedes `DatabasePlugin(...)`, restart | Boot fails with `Database not initialized. Call initDatabase() first.` (thrown by `packages/database/src/lib/utils/db.ts:28`) at DI-provider instantiation, **not** at `onPluginInit` |
| 3 | Restore the order | Boot succeeds again |
| 4 | Add a temporary `onPluginInit: () => { throw new Error('boom'); }` to any plugin in the list and restart | Node exits non-zero with an **unhandled promise rejection** trace containing `boom`. No `Logger.error`, no plugin name, no "which plugin failed" line — see `🐞 BUG-bootstrap-server-03` |

### F2 — Root module imports every plugin module

**Preconditions:** server running.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -i http://localhost:3000/api/auth/me` | `401` (identity's route exists — its module was imported) |
| 2 | `curl -i http://localhost:3000/api/workspaces` | `401`/`403`, not `404` (workspaces module imported) |
| 3 | Comment out `UsersPlugin()` in `apps/server/src/plugins.ts:59`, restart, `curl -i http://localhost:3000/api/users` | `404` — removing the entry removes the routes; the host has no other registry |

### F3 — Global prefix

**Preconditions:** server running, `globalPrefix: 'api'` (`ortha.config.ts:79`).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -i http://localhost:3000/api/does-not-exist` | `404` with a Nest JSON body `{"message":"Cannot GET /api/does-not-exist", ...}` |
| 2 | `curl -i http://localhost:3000/auth/me` (no prefix) | `404` — routes exist only under the prefix |
| 3 | `curl -i http://localhost:3000/reference/json` | `200 application/json` — the docs routes deliberately sit **outside** the prefix |

### F4 — Strict `ValidationPipe`

**Preconditions:** server running, a valid `Origin` header (`http://localhost:4200`, see `ortha.config.ts:110-111`).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -i -X POST localhost:3000/api/auth/login -H 'Origin: http://localhost:4200' -H 'content-type: application/json' -d '{"email":"a@b.c","password":"x","role":"admin"}'` | `400`; body `message` array contains a string mentioning `role` (`forbidNonWhitelisted`) |
| 2 | Same, with `{"email":null,"password":"x"}` | `400`, `email` validation messages |
| 3 | Same, with a well-formed payload and a wrong password | `401` — the pipe passed, the guard/service answered |
| 4 | Send `{"email":"a@b.c","password":"x","extra":{"nested":1}}` | `400` naming `extra` — `whitelist` strips, `forbidNonWhitelisted` rejects |

### F5 — Listen + boot log

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `PORT=3999 npx nx serve server` | Log reads `🚀 Application is running on: http://localhost:3999/api`; `curl -i localhost:3999/api/does-not-exist` → `404` |
| 2 | Start a second instance on the same port | Second process dies with `EADDRINUSE`; the message is a raw unhandled rejection, not a friendly error |
| 3 | `PORT=abc npx nx serve server` | Listens on 3000 — `Number('abc') \|\| 3000` in `ortha.config.ts:78` |

### F6 — Docs enable/disable gate

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx serve server` (no `NODE_ENV`, no `API_DOCS`) | Log line `📘 API reference: /reference (OpenAPI JSON: /reference/json)`; `curl -sf localhost:3000/reference/json` → `200` |
| 2 | `API_DOCS=false npx nx serve server` | No `📘` log line; `curl -i localhost:3000/reference/json` → `404` |
| 3 | `NODE_ENV=production npx nx serve server` | No `📘` line; `/reference` → `404` |
| 4 | `NODE_ENV=production API_DOCS=true npx nx serve server` | `📘` line present; `/reference` → `200` (explicit opt-in) |
| 5 | `API_DOCS=1 npx nx serve server` | Docs **off** — the config compares `=== 'true'` (`ortha.config.ts:88`), so any other value is falsy |

### F7 — Plugin security schemes merged

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -s localhost:3000/reference/json \| jq '.components.securitySchemes \| keys'` | Includes identity's cookie + bearer scheme names |
| 2 | Open `http://localhost:3000/reference` | The auth panel offers those credentials |
| 3 | Remove `IdentityPlugin(...)` from the list, restart, repeat step 1 | The keys are gone — the host invents none of its own |

### F8 — Document-level `defaultSecurity` is OR, not AND

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -s localhost:3000/reference/json \| jq '.security'` | An **array of separate one-key objects** (e.g. `[{"ortha_session":[]},{"apiToken":[]}]`), never one object with two keys — one entry per `addSecurityRequirements` call (`setup-api-docs.ts:113`) |

### F9 / F10 — Tagging by resource

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -s localhost:3000/reference/json \| jq -r '.tags[].name'` | A short, **sorted, de-duplicated** list of resources (`auth`, `content`, `media`, `users`, `workspaces`, …) — not ~50 controller names |
| 2 | `curl -s localhost:3000/reference/json \| jq '.paths["/api/auth/login"].post.tags'` | `["auth"]` — exactly one tag, taken from the first segment after `api` |
| 3 | In the Scalar UI, confirm the sidebar groups by those resources | Sidebar sections match the tag list from step 1 |

### F11 — Plugin `decorate` runs last

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -s localhost:3000/reference/json \| jq '.components.schemas \| keys \| map(select(startswith("Content")))'` | Content-server's runtime-defined per-content-type schemas are present, though no decorated class exists for them |
| 2 | `curl -s localhost:3000/reference/json \| jq '.paths \| to_entries \| map(select(.key \| test("^/api/content"))) \| .[0].value \| .. \| .tags? // empty'` | Still a single resource tag — `decorate` ran *after* `tagByResource` and did not clobber it |

### F12 / F13 / F14 — The two doc routes

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -sD- -o/dev/null localhost:3000/reference/json` | `200`, `content-type: application/json` |
| 2 | `curl -sD- -o/dev/null localhost:3000/reference` | `200`, `content-type: text/html` |
| 3 | `curl -i -H 'Cookie:' localhost:3000/reference/json` (no session at all) | `200` — the route is outside every guard, by design |
| 4 | `curl -i -X POST localhost:3000/reference/json` | `404` — only `GET` is registered (`setup-api-docs.ts:139`) |
| 5 | Set `docs.path: 'docs'` (no leading slash) in `ortha.config.ts`, restart | `curl -i localhost:3000/docs` → `200`; the log line reads `/docs` (`normalizePath`, `setup-api-docs.ts:29-31`) |
| 6 | Set `docs.jsonPath` to the same value as `docs.path` | The JSON wins — it is registered first (`setup-api-docs.ts:135-139`) |

### F15 — `migrations` descriptor

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx run server:db:migrate` on an empty DB | One `Applying migrations: <name> → <table>` line per plugin **that declares `migrations`**, in registration order, then `Migrations complete.` |
| 2 | Re-run immediately | Same log lines, no SQL applied, exit 0 — drizzle's per-plugin tracking table makes it idempotent |
| 3 | `psql "$DATABASE_URL" -c "\dt __drizzle_migrations*"` | One tracking table per migrating plugin (`__drizzle_migrations_database`, `__drizzle_migrations_content`, …) — never one shared table |

### F16 — `setupApiDocs` return value

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | In a scratch host, call `setupApiDocs(app, plugins, { enabled: false })` | Returns `null`; no routes registered |
| 2 | Call it with `{ path: 'ref', jsonPath: 'ref/raw' }` | Returns `{ path: '/ref', jsonPath: '/ref/raw' }` — both normalised |

## 4. Edge Cases & Negative Paths

**Plugin registration & lifecycle**

- **EC-01 — Empty plugin list.** `❌ NONE` Trigger: `createServer({ plugins: [] })`.
  Expected: boots, every route 404s. Suspected: works, but `SwaggerModule.createDocument`
  produces `paths: {}` and `tagByResource` writes `tags: []` — harmless.
- **EC-02 — A plugin's `onPluginInit` throws.** `❌ NONE`
  `create-server.ts:21-23` has no `try/catch`, and `apps/server/src/main.ts:5` calls
  `createServer(...)` with no `.catch`. → `🐞 BUG-bootstrap-server-03`.
- **EC-03 — A plugin's `onPluginInit` never resolves.** `❌ NONE` The loop `await`s each
  hook, so one hanging plugin hangs boot forever with no timeout and no log naming it.
- **EC-04 — A plugin's `onPluginInit` is synchronous and slow.** `❌ NONE` Blocks the event
  loop; boot time is the sum of all hooks (they are strictly sequential by design, not
  `Promise.all` — correct, since order is the contract).
- **EC-05 — Two plugins register the same module class.** `❌ NONE`
  `server.module.ts:14` maps without de-duplication. Nest de-duplicates a plain `Type`,
  but two *differently configured* `DynamicModule`s of the same class are distinct — the
  second's providers can silently win. No warning is emitted.
- **EC-06 — Duplicate plugin `name`.** `❌ NONE` `name` is documented "unique identifier"
  (`server-plugin.ts:11`) but is used only in the migrate log line
  (`packages/nx/src/lib/drizzle/apply.ts:33`). Nothing enforces uniqueness.
- **EC-07 — Two plugins declare the same `migrations.table`.** `❌ NONE` Their histories
  interleave in one tracking table; the second plugin's migrations are recorded as if they
  were the first's, and a later `db:migrate` skips real work. Nothing checks for a clash.
- **EC-08 — `migrations.dir()` points at a missing folder.** `❌ NONE` drizzle's `migrate`
  throws mid-loop; earlier plugins are already committed → partially-migrated database.
  See EC-30.
- **EC-09 — Graceful shutdown.** `❌ NONE` `createServer` never calls
  `app.enableShutdownHooks()`, so on `SIGTERM` no `onModuleDestroy` runs:
  `OutboxDispatcher`'s interval is never cleared and the pg pool is never drained.
  → `🐞 BUG-bootstrap-server-04`. Acknowledged as deferred in `AGENTS.md`
  ("Lifecycle beyond `onPluginInit` (no shutdown hook yet)").

**Global prefix**

- **EC-10 — `globalPrefix: ''`.** `❌ NONE` Nest treats empty as no prefix; `tagByResource`'s
  `prefix` becomes `''`, `segments[0] === ''` is never true, so it tags by the **first**
  segment — which is now the resource anyway. Accidentally correct.
- **EC-11 — `globalPrefix: '/api/'`.** `❌ NONE` `tagByResource` strips leading/trailing
  slashes (`setup-api-docs.ts:43`) but `app.setGlobalPrefix('/api/')` yields `/api//...`
  in Nest's route table while the document paths differ → tags silently fall back to `api`
  for every route, collapsing the sidebar to one group.
- **EC-12 — A plugin route that is exactly `/api`.** `❌ NONE` `segments[1]` is `undefined`,
  `resource` falsy, `continue` — the operation keeps **no tag at all** and vanishes from
  the Scalar sidebar (`setup-api-docs.ts:49-51`).

**`ValidationPipe`**

- **EC-13 — Implicit type conversion.** `✅ E2E` (indirectly) `transformOptions` is *not*
  set, so `enableImplicitConversion` stays `false` — a DTO with `page: number` and no
  `@Type(() => Number)` receives the raw string. This is the safe default; the pitfall
  would be turning it on, where `'0'`/`'false'` coerce surprisingly. Verify no future
  change enables it.
- **EC-14 — Unknown field nested inside an allowed object.** `⚠️ PARTIAL`
  `apps/server-e2e/src/server/auth/login.spec.ts:224` covers a top-level extra key only.
  A nested unknown key is only rejected if the nested DTO is `@ValidateNested` +
  `@Type`-annotated; otherwise it passes through untouched.
- **EC-15 — A route with no DTO at all.** `❌ NONE` `whitelist` strips nothing when there is
  no metadata; the raw body reaches the handler. The pipe is not a substitute for a DTO.
- **EC-16 — 10 MB JSON body.** `❌ NONE` No `bodyParser` limit is configured here, so
  express's default 100 kb applies → `413`. Not asserted anywhere; a plugin raising the
  limit would do so invisibly to this host.
- **EC-17 — Query/param validation.** `⚠️ PARTIAL` The pipe applies to `@Query`/`@Param`
  DTOs too. Covered incidentally by `apps/server-e2e/src/server/api-tokens/public-content-api.spec.ts:313`
  (malformed `X-Workspace-Id` → 400), never as a host-level assertion.

**API reference / docs — 🔒**

- **EC-18 — `NODE_ENV` unset in a real deployment.** `❌ NONE` 🔒 The default is
  *fail-open*: `enabled = process.env['NODE_ENV'] !== 'production'`
  (`setup-api-docs.ts:87`). A container that forgets `NODE_ENV=production` publishes the
  complete, unauthenticated API surface at `/reference/json` — and, via
  `apps/server/src/plugins.ts:73`, turns on the GraphiQL playground too.
  → `🐞 BUG-bootstrap-server-01`.
- **EC-19 — Docs routes bypass every guard.** `❌ NONE` 🔒 Registered on the http adapter
  (`setup-api-docs.ts:139,141`), so `AuthGuard`/`PermissionsGuard`/`OriginGuard` never see
  them. Intentional and documented, but it means "enabled" == "world-readable"; there is
  no authenticated-docs mode.
- **EC-20 — `docs.path` collides with a plugin route.** `❌ NONE` e.g. `docs.path: '/api'`
  registers a raw handler for `GET /api` on the adapter. Whether it shadows the Nest
  router depends on registration order; nothing validates the path.
- **EC-21 — `docs.cdn` unreachable / air-gapped host.** `❌ NONE` `/reference` returns
  `200` with an HTML shell that never renders — a blank page, no error. The JSON route
  still works.
- **EC-22 — A plugin's `decorate` throws.** `❌ NONE` `setup-api-docs.ts:128` is unguarded
  inside `createServer`, so one plugin's bad docs pass aborts the whole boot.
  → `🐞 BUG-bootstrap-server-05`.
- **EC-23 — A plugin's `decorate` deletes another plugin's paths.** `❌ NONE` The contract
  says "amend only what the plugin owns" (`plugin-api-docs.ts:63`) but the document is
  passed by reference with no isolation, no snapshot, no diff check.
- **EC-24 — Two plugins register the same security scheme name.** `❌ NONE`
  `builder.addSecurity(name, scheme)` — last writer wins silently.
- **EC-25 — A path item carries non-operation keys.** `❌ NONE` `tagByResource` iterates
  `Object.values(item)` and assigns `.tags` to anything that is `typeof 'object'`
  (`setup-api-docs.ts:53-59`) — a path-level `parameters` **array** would receive a `tags`
  property. Harmless today (Nest emits none) but not defensive.
- **EC-26 — Unicode / very long route paths.** `❌ NONE` `route.split('/')` handles them;
  a resource segment containing a `%`-escape becomes a tag name verbatim.
- **EC-27 — `docs.enabled: true` with zero controllers.** `❌ NONE` Document generates with
  empty `paths`; Scalar renders an empty reference. No crash.

**Failure & partiality**

- **EC-28 — Port already in use.** `❌ NONE` `app.listen` rejects → unhandled rejection, no
  friendly message. Cross-reference `🐞 BUG-bootstrap-server-03`.
- **EC-29 — A plugin module fails to instantiate (DI error).** `⚠️ PARTIAL` Nest prints its
  own dependency-resolution error, which is legible. The host adds nothing.
- **EC-30 — Migration run interrupted mid-loop.** `❌ NONE` `applyPluginMigrations`
  (`packages/nx/src/lib/drizzle/apply.ts:27-39`) iterates plugins with **no outer
  transaction**: a failure at plugin *k* leaves plugins `0..k-1` migrated and the rest
  not. Re-running is safe (drizzle re-checks each tracking table), but the interim state
  boots and serves traffic against a half-migrated schema.
- **EC-31 — Two `db:migrate` runs concurrently (two replicas booting).** `❌ NONE`
  drizzle's node-postgres migrator takes no advisory lock, so both can decide the same
  migration is pending → duplicate DDL error on one of them.

**Idempotency & replay**

- **EC-32 — `createServer` called twice in one process.** `❌ NONE` `onPluginInit` runs
  again (`initDatabase` is idempotent, but a plugin with a non-idempotent hook is not),
  and a second `NestFactory.create` + `listen` on the same port fails.
- **EC-33 — `setupApiDocs` called twice.** `❌ NONE` Registers the same adapter routes
  twice; express keeps the first. `setupApiDocs` is exported precisely so a custom host
  can call it (`AGENTS.md` "Key exports"), so double-call is reachable.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F2 Root module | `apps/server-e2e/src/server/server.spec.ts:15-17` | `GET /api/does-not-exist` → 404 against a real app built from `ServerModule.forRoot(plugins)` | ⚠️ PARTIAL — proves the module builds and routes resolve; asserts nothing about *which* plugins were imported or about ordering |
| F3 Global prefix | `apps/server-e2e/src/server/server.spec.ts:16` | 404 is served **under** `/api` | ⚠️ PARTIAL — no assertion that an unprefixed path 404s, none that the prefix is configurable |
| F4 ValidationPipe (`forbidNonWhitelisted`) | `apps/server-e2e/src/server/auth/login.spec.ts:224-231` | POST with an extra `role` key → 400, message array contains `role` | ✅ E2E — but see EC-14 (top-level only) |
| F4 ValidationPipe (`forbidNonWhitelisted`) | `apps/server-e2e/src/server/preferences/preferences.spec.ts:175` | Same shape on a second endpoint | ✅ E2E |
| F4 ValidationPipe (privilege smuggling) | `apps/server-e2e/src/server/auth/accept-invite.spec.ts:197` | A smuggled field on invite acceptance is rejected outright | ✅ E2E — the security-relevant case |
| F4 ValidationPipe (whitelist) | `apps/server-e2e/src/server/copilot/copilot-chat.spec.ts:184`, `copilot-proposals.spec.ts:696` | Comments assert the host pipe's behaviour is relied on | ⚠️ PARTIAL — relied on, not independently asserted |
| F1 `onPluginInit` ordering | `apps/server-e2e/src/support/test-app.ts:36-38` | The harness *mirrors* the loop, so every server-e2e suite depends on it working | ⚠️ PARTIAL — exercised on every run but never asserted; a failure mode (throw, order swap) is untested |
| F15 migrations descriptor | `apps/server-e2e/src/support/global-setup.ts` | Applies plugin migrations once against the testcontainer | ⚠️ PARTIAL — proves the happy path; no re-entrancy, ordering or partial-failure assertion |
| F5–F14, F16 (listen, docs gate, schemes, tagging, decorate, both routes) | — | The e2e harness stops at `app.init()` and **never calls `setupApiDocs`** (`apps/server-e2e/src/support/test-app.ts:40-53`) | ❌ NONE — the entire OpenAPI/Scalar surface, including the production-exposure gate, is unexecuted by any automated test |

**Coverage tally:** `16 features · 2 ✅ · 4 ⚠️ · 10 ❌`

## 6. 🐞 Potential Bugs

### 🐞 BUG-bootstrap-server-01 — The API reference defaults to *on*, so a deployment that forgets `NODE_ENV=production` publishes its full API surface unauthenticated · Severity: High · 🔒

**Location:** `packages/bootstrap/server/src/lib/utils/setup-api-docs.ts:86-98`, with `apps/server/ortha.config.ts:87-89` and `apps/server/src/plugins.ts:73`
**Category:** data-leak

**What the code does:**

```ts
const {
    enabled = process.env['NODE_ENV'] !== 'production',
    ...
} = options;

if (!enabled) {
    return null;
}
```

and the two routes it then registers sit on the http adapter, outside the Nest router:

```ts
httpAdapter.get(documentPath, sendDocument);
httpAdapter.get(uiPath, apiReference({ content: document, ... }) as Handler);
```

so `AuthGuard`, `PermissionsGuard` and `OriginGuard` never run for them.

**Why it is wrong:** the switch is *fail-open* on an unset variable. `NODE_ENV` is not set
by Node, by `docker run`, or by most process managers — it is set by the operator. The
documented intent (`api-docs.ts:11-14`) is "a deployment opts in explicitly rather than
leaking its surface by accident", but the implementation makes leaking the accident and
opting **out** the deliberate act. The same expression also drives the GraphiQL playground
(`apps/server/src/plugins.ts:73`: `playground: config.docs.enabled === true`), so one
missing variable exposes two developer surfaces at once.

**Repro:**
1. Build and run the server image with no `NODE_ENV` and no `API_DOCS`.
2. `curl -s https://<host>/reference/json | jq '.paths | keys | length'`
→ Observed: `200` with the complete operation list — every route, every DTO schema, every
security scheme — to an unauthenticated caller, plus a working GraphiQL at
`/api/v1/graphql`.
→ Expected: `404` unless the operator set `API_DOCS=true`.

**Blast radius:** every self-hosted deployment that does not explicitly set `NODE_ENV`.
The document is not itself a credential, but it is a complete, machine-readable map of the
attack surface (including internal admin routes and the shapes their DTOs accept), and the
playground is an interactive client for it.
**Suggested fix:** invert the default to `enabled = process.env['API_DOCS'] === 'true'`, or
have the host log a loud warning when the reference mounts and `NODE_ENV` is unset.

### 🐞 BUG-bootstrap-server-02 — `tagByResource` overwrites tags on every object under a path item, not only on operations · Severity: Low

**Location:** `packages/bootstrap/server/src/lib/utils/setup-api-docs.ts:52-59`
**Category:** correctness

**What the code does:**

```ts
for (const operation of Object.values(item as Record<string, unknown>)) {
    if (operation && typeof operation === 'object') {
        (operation as { tags?: string[] }).tags = [resource];
    }
}
```

**Why it is wrong:** an OpenAPI *Path Item* legally holds non-operation members —
`parameters` (an array), `servers` (an array), `$ref`, `summary`, `description`. The guard
only excludes primitives, so `parameters` and `servers` get a spurious `tags` property
written onto them, producing a document that no longer validates against the OpenAPI 3
schema. The correct filter is the HTTP-method key set
(`get|put|post|delete|options|head|patch|trace`).

**Repro:**
1. Have any plugin's `decorate` add a path-level `parameters: [...]` to one of its routes
   (a legal way to declare a shared path parameter).
2. `curl -s localhost:3000/reference/json | jq '.paths["/api/…"].parameters'`
→ Observed: the array carries a `tags` key. → Expected: untouched.

**Blast radius:** only manifests once a plugin uses path-level members; today
`@nestjs/swagger` emits none, so this is latent. Codegen tools that validate the document
would reject it.
**Suggested fix:** iterate `Object.entries(item)` and skip keys not in the HTTP-method set.

### 🐞 BUG-bootstrap-server-03 — A failing plugin init, or a port clash, surfaces as a raw unhandled promise rejection with no plugin name · Severity: Medium

**Location:** `packages/bootstrap/server/src/lib/create-server.ts:21-23,40` and `apps/server/src/main.ts:5-10`
**Category:** ux-state (operability)

**What the code does:**

```ts
for (const plugin of plugins) {
    await plugin.onPluginInit?.();
}
```

and the caller is fire-and-forget:

```ts
createServer({ plugins: buildPlugins(config), port: config.port, ... });
```

**Why it is wrong:** `createServer` returns a `Promise<void>` that nobody handles. Any
rejection — a plugin's `onPluginInit` throwing, `NestFactory.create` failing, a plugin's
`decorate` throwing, `listen` hitting `EADDRINUSE` — becomes an unhandled rejection: Node
prints a stack and exits with a code that does not distinguish the causes, and the log
never says *which* plugin failed even though the loop knows `plugin.name`
(`server-plugin.ts:11` exists for exactly this: "used in logging and lookups"). The
`onPluginInit` JSDoc calls it "one-time setup that must happen before the app boots"
without saying what happens when it doesn't.

**Repro:**
1. Add `onPluginInit() { throw new Error('boom'); }` to any entry in
   `apps/server/src/plugins.ts`.
2. `npx nx serve server`
→ Observed: `Error: boom` + a stack rooted in `create-server.ts`, no plugin name, no
`Logger.error`. → Expected: `Logger.error('plugin "<name>" failed to initialise', …)` and a
deliberate `process.exit(1)`.

**Blast radius:** every operator debugging a boot failure, on every misconfiguration. Costs
time, not data.
**Suggested fix:** wrap the loop in `try/catch`, re-throw with the plugin name attached,
and give `main.ts` a `.catch` that logs and exits non-zero.

### 🐞 BUG-bootstrap-server-04 — No shutdown hooks: on SIGTERM the pg pool is never drained and the outbox dispatcher's interval is never cleared · Severity: Medium

**Location:** `packages/bootstrap/server/src/lib/create-server.ts:25-40` (nothing calls `app.enableShutdownHooks()`); consequences in `packages/database/src/lib/outbox/outbox-dispatcher.ts:127-133` and `packages/database/src/lib/utils/db.ts:18`
**Category:** data-loss

**What the code does:** `createServer` creates the app, sets the prefix and pipe, mounts
docs and listens. It never calls `app.enableShutdownHooks()`, and there is no
`process.on('SIGTERM'…)` anywhere in the production tree — a repo-wide grep for
`enableShutdownHooks` / `pool.end` finds hits only in `packages/nx/src/lib/drizzle/apply.ts:42`
and the e2e harness (`apps/server-e2e/src/support/test-app.ts:64`).

**Why it is wrong:** `OutboxDispatcher` implements `OnModuleDestroy` specifically to clear
its 5-second interval (`outbox-dispatcher.ts:128-133`); without `enableShutdownHooks` that
method is dead code in production. More seriously, a `SIGTERM` during
`OutboxDispatcher.drain()` kills the process mid-batch: subscribers that already ran are
not re-marked, the drain transaction is aborted by the connection dying, and the pool's
sockets are dropped rather than closed. `AGENTS.md` lists this under "Not owned here …
(no shutdown hook yet)", so it is a known gap — but the outbox landing afterwards
(ADR-0003) turned it from cosmetic into a correctness issue.

**Repro:**
1. Start the server, trigger a burst of audited mutations so the outbox has pending rows.
2. `kill -TERM <pid>` while a drain is in flight.
→ Observed: process exits immediately; Postgres logs abandoned backends; the in-flight
drain's `dispatchedAt` stamps are lost, so those events are re-delivered on the next boot
(safe only because `AuditEventSubscriber` is idempotent — a future non-idempotent
subscriber would double-apply).
→ Expected: `app.enableShutdownHooks()` → interval cleared, in-flight drain allowed to
finish or cleanly abort, `pool.end()` awaited.

**Blast radius:** every rolling deploy and every container restart. Today mitigated by the
one existing subscriber being idempotent (`packages/activity/server/src/lib/activity/infrastructure/audit-event.subscriber.ts:50-53`).
**Suggested fix:** call `app.enableShutdownHooks()` in `createServer`, and add an
`onApplicationShutdown` to the database plugin that awaits `getPool().end()`.

### 🐞 BUG-bootstrap-server-05 — One plugin's `decorate` throwing aborts the entire boot · Severity: Low

**Location:** `packages/bootstrap/server/src/lib/utils/setup-api-docs.ts:127-129`
**Category:** correctness

**What the code does:**

```ts
for (const plugin of plugins) {
    plugin.docs?.decorate?.(document as unknown as OpenApiDocument);
}
```

**Why it is wrong:** `setupApiDocs` runs inside `createServer` before `listen`
(`create-server.ts:38`), so an exception from any plugin's documentation pass takes down
the API. The host's own framing is that docs are "a dev tool" (`api-docs.ts:11-13`) —
a cosmetic subsystem should not be able to prevent the product from serving traffic. The
risk is real because `decorate` is the hook for plugins whose contract is *runtime data*
(`plugin-api-docs.ts:56-60`): content-server builds a schema per registered content type,
so a malformed content-type definition can throw here.

**Repro:**
1. Add a `decorate(doc) { throw new Error('bad schema'); }` to any plugin's `docs`.
2. `npx nx serve server`
→ Observed: process dies before `listen`; no routes served. → Expected: the failure is
logged, that plugin's contribution is skipped, and the server still boots.

**Blast radius:** availability, gated on a plugin bug in a non-essential subsystem.
**Suggested fix:** wrap each `decorate` call in `try/catch` and `Logger.warn` the plugin
name on failure; likewise consider making the whole `setupApiDocs` call non-fatal.

**Checked and cleared** (no defect found): the `ValidationPipe` configuration — `whitelist`
+ `forbidNonWhitelisted` + `transform` with `transformOptions` deliberately left unset, so
`enableImplicitConversion` stays `false` and no surprising string→number/boolean coercion
occurs (`create-server.ts:28-34`); the JSON-before-UI route ordering, which is correct and
commented (`setup-api-docs.ts:135-139`); `normalizePath`, which is total for the string
inputs it accepts (`setup-api-docs.ts:29-31`); the absence of a global exception filter,
which leaves Nest's default — a bare `{"statusCode":500,"message":"Internal server error"}`
with **no** stack or internal message in the body (stacks go to the logger only), so there
is no leak here; the absence of `app.enableCors()`, which is correct for the same-origin
dev proxy (`apps/admin/vite.config.mts:20-26`) and means no permissive CORS default was
accidentally shipped; and `ServerModule.forRoot`, which is a faithful one-liner over the
plugin list.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` (testcontainer + supertest; needs a harness that calls `setupApiDocs`) | `apps/server-e2e/src/server/docs/api-docs-gate.spec.ts` | With `docs: { enabled: false }` both `/reference` and `/reference/json` 404; with `enabled: true` both 200 and the JSON is a valid OpenAPI 3 object. A third case boots with `NODE_ENV=production` and no `API_DOCS` and asserts 404 | F6, EC-18, `🐞 BUG-bootstrap-server-01` |
| 2 | `apps/server-e2e` | `apps/server-e2e/src/server/docs/api-docs-exposure.spec.ts` | 🔒 With docs enabled, `/reference/json` returns 200 to a request carrying **no** cookie and no bearer token — pinning the documented "outside every guard" behaviour so a future change is deliberate | EC-19 |
| 3 | Unit (`packages/bootstrap/server/src/lib/utils/__test__/setup-api-docs.spec.ts`, jest) | `tagByResource` | Given a synthetic document with `/api/content/post`, `/api/users`, `/reference` and a path item carrying a `parameters` array: every operation gets exactly one tag equal to its resource, `tags` is sorted and de-duplicated, and the `parameters` array is **untouched** | F10, EC-25, `🐞 BUG-bootstrap-server-02` |
| 4 | Unit (same file) | `setupApiDocs` merge pass | Two fake plugins contributing overlapping `securitySchemes` and two `defaultSecurity` names produce a `security` array of **separate single-key objects** (OR), and the later scheme wins a name clash | F7, F8, EC-24 |
| 5 | Unit (`packages/bootstrap/server/src/lib/__test__/create-server.spec.ts`) | plugin lifecycle | With three fake plugins, `onPluginInit` is called exactly once each, in array order, and awaited (a hook returning a delayed promise completes before the next starts); a throwing hook rejects `createServer` with an error naming the plugin | F1, EC-02, `🐞 BUG-bootstrap-server-03` |
| 6 | Unit (same file) | `decorate` isolation | A plugin whose `decorate` throws does not prevent the other plugins' `decorate` from running, and does not reject `createServer` | EC-22, `🐞 BUG-bootstrap-server-05` |
| 7 | `apps/server-e2e` | extend `apps/server-e2e/src/server/server.spec.ts` | An unprefixed path (`GET /auth/me`) 404s while `GET /api/auth/me` 401s — pinning the prefix as a real boundary rather than an incidental one | F3, EC-10 |
| 8 | `apps/server-e2e` | `apps/server-e2e/src/server/docs/plugin-decorate.spec.ts` | Content-server's runtime-defined schemas appear under `components.schemas` **and** its operations still carry exactly one resource tag — proving `decorate` runs after `tagByResource` and does not clobber it | F11 |
| 9 | Unit (`packages/nx`) | `applyPluginMigrations` | Running it twice against one database applies each plugin's SQL exactly once and leaves one tracking table per plugin; a plugin whose `dir()` is missing fails **without** having rolled back the plugins already applied (documenting EC-30 rather than pretending it is atomic) | F15, EC-30 |
| 10 | `apps/server-e2e` | `apps/server-e2e/src/server/docs/security-schemes.spec.ts` | The generated document advertises identity's session-cookie and bearer schemes, and advertises **no** scheme when the identity plugin is absent from the list — the host invents none | F7 |

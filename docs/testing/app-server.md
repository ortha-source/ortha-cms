# apps/server — Test Artifact

> **Unit:** `apps/server` · **Package:** `@ortha-cms/server` (private) · **Kind:** app (composition root + migration host)
> **Source of truth:** `apps/server/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns.** Three things, and no logic beyond them:

1. **The plugin registry** — `src/plugins.ts`, the ordered `ServerPlugin[]` the host boots
   from, including every composition-root decision (which model providers the copilot gets,
   which storage provider media gets, which content types content gets).
2. **The typed config** — `ortha.config.ts`, documented as "the single place that reads
   `process.env`" (`:11-12`).
3. **The host's own content model** — `src/content/`, the code-defined collections and
   pages whose generated tables this app owns and migrates (`drizzle.config.ts`,
   `migrations/`).

Plus `src/main.ts`, a five-line call into `createServer`.

**Does NOT own.** Any route handler, guard, service, DTO or table definition — all of those
live in plugins. Not the bootstrap mechanics either (`packages/bootstrap/server`), nor the
migration tooling (`packages/nx`), nor the connection (`packages/database`).

**Entry points**

| Entry | Shape | Where |
| --- | --- | --- |
| `src/main.ts` | side-effecting `createServer({...})` call | `src/main.ts:5-10` |
| `buildPlugins(config)` | `(OrthaConfig) => ServerPlugin[]` — shared by boot **and** `db:migrate` | `src/plugins.ts:42` |
| `ortha.config.ts` default export | `OrthaConfig` | `ortha.config.ts:77-263` |
| `contentTypes` | the code-defined content model | `src/content/index.ts` |
| `drizzle.config.ts` | drizzle-kit config pointing `schema` at `src/content/index.ts` | `apps/server/drizzle.config.ts` |

**Effective HTTP surface** (contributed by the registered plugins, all under `/api`):
`auth`, `users`, `workspaces`, `activity`, `preferences`, `content`, `content/v1` public
API, `media`, `i18n`, `insights`, `copilot`, `v1/graphql`, `v1/mcp`. Plus the host-level
`GET /reference` + `GET /reference/json` outside the prefix.

**Runtime prerequisites**

| Variable | Default | Consequence |
| --- | --- | --- |
| `DATABASE_URL` | `''` (`ortha.config.ts:81`) | Empty → `pg` falls back to libpq env/defaults; boot still succeeds (lazy pool) |
| `PORT` | `3000` (`:78`) | `Number(x) \|\| 3000`, so `PORT=0` also yields 3000 |
| `NODE_ENV` | unset | Drives `docs.enabled` **and** cookie `secure` (`:120`) |
| `API_DOCS` | unset | `=== 'true'` opts docs in; any other value opts out (`:87-89`) |
| `SESSION_SECRET` / `TOKEN_SECRET` | `''` (`:106-107`) | Empty strings are accepted here — see `🐞 BUG-app-server-01` |
| `ALLOWED_ORIGINS` | `http://localhost:4200` (`:111`) | CSRF origin allow-list |
| `SESSION_TTL_SECONDS`, `INVITE_TTL_SECONDS`, `RESET_TTL_SECONDS`, `LOGIN_RATE_LIMIT*` | 7 d / 7 d / 1 h / 10 per 60 s (`:118-135`) | All parsed with `Number(x) \|\| default` |
| `ORTHA_ROOT_ADMIN_EMAIL/PASSWORD/NAME` | `''` (`:137-139`) | Bootstrap admin seeding |
| `MEDIA_LOCAL_ROOT`, `MEDIA_MAX_UPLOAD_BYTES`, `MEDIA_PROVIDER` | `./.storage/media`, 50 MB, `local` (`:156-169`) | |
| `GRAPHQL_MAX_*` | 8 / 1000 / 30 / 16384 (`:178-183`) | Per-operation cost budget |
| `COPILOT_ENABLED` | `false` — `=== 'true'` (`:194`) | Kill switch |
| `COPILOT_PROVIDER` | `fake` (`:198`) | Fresh clone boots with no key |
| `ANTHROPIC_API_KEY`, `COPILOT_OPENAI_*` | `''` / localhost:11434 (`:217-244`) | |
| `MCP_ENABLED` | `false` — `=== 'true'` (`:254`) | Kill switch |

**How to exercise it manually**

```bash
docker compose up -d
cp .env.example .env      # then fill DATABASE_URL, SESSION_SECRET, TOKEN_SECRET, root admin
npx nx run server:db:migrate
npm run dev               # 4 panes; or: npx nx serve server
curl -i localhost:3000/api/auth/me                    # 401 — unauthenticated
curl -i localhost:3000/api/v1/mcp                     # 404 unless MCP_ENABLED=true
COPILOT_ENABLED=true npx nx serve server              # copilot routes live
npx nx run server:db:studio                           # inspect the live DB
```

**Dependencies that must be healthy.** Postgres (migrations + every request); the
filesystem path in `MEDIA_LOCAL_ROOT` must be writable; the copilot's configured provider
endpoint must be reachable **only** if `COPILOT_ENABLED=true` and the provider is not
`fake`.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `main.ts` hands the built plugin list, port, prefix and docs options to `createServer` | `src/main.ts:5-10` | ⚠️ PARTIAL |
| F2 | `buildPlugins(config)` returns the ordered plugin list, shared by boot and `db:migrate` | `src/plugins.ts:42-171` | ⚠️ PARTIAL |
| F3 | `DatabasePlugin` is registered first so the connection opens before any provider | `src/plugins.ts:55` | ⚠️ PARTIAL |
| F4 | Identity → workspaces → activity → users ordering (FK + port-binding dependencies) | `src/plugins.ts:56-59` | ⚠️ PARTIAL |
| F5 | `ContentPlugin` receives the **host-owned** migrations descriptor for its generated collection tables | `src/plugins.ts:43-53` | ⚠️ PARTIAL |
| F6 | `ContentGraphqlPlugin` takes the `content` plugin **by value** so name collisions fail at boot | `src/plugins.ts:67-74` | ✅ E2E |
| F7 | The GraphiQL playground rides the same switch as the Scalar reference (`docs.enabled === true`) | `src/plugins.ts:73` | ✅ E2E |
| F8 | `MediaServerPlugin` gets exactly one named storage provider (`local`) and no `resolve` handler | `src/plugins.ts:86-91` | ✅ E2E |
| F9 | `CopilotPlugin` gets three named model providers (`claude`, `ollama`, `fake`) and no `resolve` | `src/plugins.ts:112-156` | ✅ E2E |
| F10 | `McpPlugin` is registered last and is off unless `MCP_ENABLED=true` | `src/plugins.ts:169`, `ortha.config.ts:254` | ✅ E2E |
| F11 | Copilot is off unless `COPILOT_ENABLED=true` | `ortha.config.ts:194` | ✅ E2E |
| F12 | `docs.enabled` = `API_DOCS` when set, else `NODE_ENV !== 'production'` | `ortha.config.ts:87-89` | ❌ NONE |
| F13 | Session cookie is `secure` only in production, `SameSite=lax` always | `ortha.config.ts:120-121` | ⚠️ PARTIAL |
| F14 | `ALLOWED_ORIGINS` is comma-split, trimmed and filtered | `ortha.config.ts:110-115` | ⚠️ PARTIAL |
| F15 | Login rate limit is configurable, defaulting to 10 per 60 s | `ortha.config.ts:131-135` | ✅ E2E |
| F16 | Content locales are literals (`en` default, `de`, `fr`) | `ortha.config.ts:147-151` | ✅ E2E |
| F17 | GraphQL cost budget (depth/complexity/aliases/length) + schema cache TTL | `ortha.config.ts:177-189` | ✅ E2E |
| F18 | Copilot model lists are comma-split env overrides over literal defaults | `ortha.config.ts:222-228,239-242` | ⚠️ PARTIAL |
| F19 | `COPILOT_MAX_STEPS` is conditionally spread so an unset value leaves plugin defaults intact | `ortha.config.ts:208-214` | ❌ NONE |
| F20 | `src/content/` defines the host's collections and pages | `src/content/collections/*.ts`, `src/content/pages/*.ts` | ✅ E2E |
| F21 | `src/content/index.ts` is the single aggregation point — `contentTypes` **and** every generated table re-exported for drizzle-kit | `src/content/index.ts` | ⚠️ PARTIAL |
| F22 | Host migrations live in `apps/server/migrations` and are applied under `__drizzle_migrations_content` | `src/plugins.ts:49-52`, `apps/server/migrations/meta/_journal.json` | ⚠️ PARTIAL |
| F23 | Root-admin bootstrap from `ORTHA_ROOT_ADMIN_*` | `ortha.config.ts:136-140` | ✅ E2E |
| F24 | Media upload cap (`MEDIA_MAX_UPLOAD_BYTES`, 50 MB) and local root dir | `ortha.config.ts:156-169` | ✅ E2E |

## 3. Manual Test Plan

### F1 / F2 / F3 — Boot and registry order

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx serve server` | Final log: `🚀 Application is running on: http://localhost:3000/api` |
| 2 | `curl -s localhost:3000/reference/json \| jq -r '.tags[].name'` | Includes `auth`, `users`, `workspaces`, `activity`, `content`, `media`, `i18n`, `insights`, `preferences` |
| 3 | Swap lines 55 and 56 of `src/plugins.ts` so identity precedes database; restart | Boot fails with `Database not initialized. Call initDatabase() first.` |
| 4 | Restore | Boots |
| 5 | Delete `UsersPlugin()` (`:59`); restart; `curl -i localhost:3000/api/users` | `404` |

### F4 — Dependency ordering between plugins

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx run server:db:migrate` on an empty DB | Log order is `database`, `identity`, `workspaces`, `activity`, `users`, `content`, … — matching `src/plugins.ts:54-170` |
| 2 | `psql "$DATABASE_URL" -c "\d memberships"` | Its FK references `users(id)` — identity's table, created earlier in the same run |
| 3 | Move `WorkspacesPlugin()` above `IdentityPlugin()` and re-migrate a **fresh** DB | Migration fails: `relation "users" does not exist` |

### F5 / F21 / F22 — Host-owned content tables

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `psql "$DATABASE_URL" -c "\dt"` | Tables for every entry in `src/content/collections/` and `src/content/pages/` (`article`, `author`, `category`, `comment`, `tag`, `seo_meta`, `home_page`, `site_settings`, …) plus their `joinTableOf` join tables |
| 2 | Add a new file `src/content/collections/thing.ts` and add it to `contentTypes` in `src/content/index.ts` but **do not** re-export its table | `npx nx run server:db:generate --name=thing` emits **no migration for it** — drizzle-kit only diffs top-level table exports (`AGENTS.md`, "Adding a type") |
| 3 | Add the missing `export * from './collections/thing'` and re-generate | The `CREATE TABLE` appears; commit the SQL |
| 4 | `npx nx run server:db:migrate` twice in a row | Second run applies nothing; `select count(*) from __drizzle_migrations_content` is unchanged |

### F6 / F7 — GraphQL adapter and playground gating

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Define two content types whose GraphQL type names would collide; restart | **Boot fails** — the collision is caught at composition, not on the first request (`src/plugins.ts:64-66`) |
| 2 | `npx nx serve server` (docs on) then `curl -sD- -o/dev/null localhost:3000/api/v1/graphql` | `200 text/html` — GraphiQL |
| 3 | `API_DOCS=false npx nx serve server`; repeat | GraphiQL is not served; `POST /api/v1/graphql` with a bearer token still works |
| 4 | `NODE_ENV=production npx nx serve server`; repeat | Same as step 3 — one switch drives both dev surfaces |

### F8 — Media storage composition

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Upload an asset via the admin Media Library | The blob appears under `./.storage/media` (`ortha.config.ts:160`) |
| 2 | `MEDIA_LOCAL_ROOT=/tmp/ortha-media npx nx serve server`; upload again | The blob lands in `/tmp/ortha-media` |
| 3 | `MEDIA_PROVIDER=s3 npx nx serve server`; upload | Fails — only `local` is registered in `src/plugins.ts:87-89`; `defaultProvider` names a provider that does not exist |

### F9 / F11 / F18 / F19 — Copilot composition

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx serve server` (no `COPILOT_ENABLED`); `curl -i localhost:3000/api/copilot/models` with a session cookie | Copilot is disabled — the route is unavailable |
| 2 | `COPILOT_ENABLED=true npx nx serve server`; repeat | `200` listing every provider × model pair from `src/plugins.ts:113-130` — `claude` × 3 Anthropic models, `ollama` × `llama3.1`, `fake` × its scripted models |
| 3 | `COPILOT_ANTHROPIC_MODELS='a, b ,,c' COPILOT_ENABLED=true npx nx serve server`; repeat | Exactly `a`, `b`, `c` — split, trimmed, empties filtered (`ortha.config.ts:222-228`) |
| 4 | `COPILOT_PROVIDER=nope COPILOT_ENABLED=true` and start a run | The run fails at resolve time, not at boot — `defaultProvider` is not validated against the registered names |
| 5 | `COPILOT_MAX_STEPS=` (empty) | `Number('')` is `0`, falsy → the `limits` key is **not** spread, plugin defaults apply (`:208-214`) |
| 6 | `COPILOT_MAX_STEPS=0` | Same as step 5 — `0` is falsy, so "zero steps" is silently unrepresentable |

### F10 — MCP kill switch

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx serve server`; `curl -i -X POST localhost:3000/api/v1/mcp` | `404` — the front door is not mounted |
| 2 | `MCP_ENABLED=true npx nx serve server`; repeat with a valid bearer token and a JSON-RPC body | A JSON-RPC response |
| 3 | `MCP_ENABLED=yes npx nx serve server`; repeat step 1 | `404` — the comparison is `=== 'true'` (`ortha.config.ts:254`) |

### F12 — Docs gate

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx serve server` | `curl -sf localhost:3000/reference/json` → `200` |
| 2 | `API_DOCS=false npx nx serve server` | → `404` |
| 3 | `NODE_ENV=production npx nx serve server` | → `404` |
| 4 | `NODE_ENV=production API_DOCS=true` | → `200` |
| 5 | Unset `NODE_ENV` in a production-like container | → `200` **unauthenticated** — see `🐞 BUG-app-server-02` |

### F13 / F14 — Cookie and CSRF configuration

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Log in over plain HTTP with no `NODE_ENV`; inspect `Set-Cookie` | `HttpOnly`, `SameSite=Lax`, **no** `Secure` (`ortha.config.ts:120`) |
| 2 | `NODE_ENV=production` and log in over HTTPS | `Secure` present |
| 3 | `NODE_ENV=production` behind a TLS-terminating proxy over plain HTTP internally | `Secure` is set; the cookie is still delivered because the browser sees HTTPS. Fine — but the flag tracks `NODE_ENV`, not the actual scheme |
| 4 | `curl -X POST localhost:3000/api/auth/login -H 'Origin: http://evil.example' …` | `403` (`OriginGuard`) |
| 5 | `ALLOWED_ORIGINS=' http://a.test , ,http://b.test '` and retry with `Origin: http://a.test` | Accepted — trimmed and empties filtered (`:112-115`) |
| 6 | `ALLOWED_ORIGINS=''` and retry with any origin | The list is `[]` — every state-changing POST with an `Origin` header is refused. Verify this is the intended fail-closed behaviour |

### F15 — Login rate limit

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | 11 bad logins within 60 s from one IP | The 11th returns `429` |
| 2 | `LOGIN_RATE_LIMIT=2 LOGIN_RATE_LIMIT_TTL_SECONDS=5` | The 3rd fails with `429`; after 5 s it succeeds again |
| 3 | `LOGIN_RATE_LIMIT=0` | `Number('0') \|\| 10` → **10**. Zero is unrepresentable; see EC-11 |

### F16 / F17 — Locales and GraphQL budget

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -s localhost:3000/api/i18n/locales` with a session | `en` (default), `de`, `fr` |
| 2 | `POST /api/v1/graphql` with a 9-level-deep selection | `400` — `maxDepth` 8 |
| 3 | Same with a 17 KB document | `400` — `maxQueryLength` 16384 |
| 4 | `GRAPHQL_MAX_DEPTH=20` and repeat step 2 | `200` |

### F20 / F23 / F24 — Content model, root admin, uploads

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Fresh DB, `ORTHA_ROOT_ADMIN_EMAIL/PASSWORD/NAME` set, boot | A root admin user exists; logging in with those credentials returns `201` |
| 2 | Boot again with the same values | No duplicate user, no error |
| 3 | Boot with `ORTHA_ROOT_ADMIN_EMAIL=''` on an empty DB | No admin is seeded and no error is raised — the instance has no way in |
| 4 | Upload a 60 MB file | Rejected — over `maxUploadBytes` |
| 5 | `MEDIA_MAX_UPLOAD_BYTES=1024` and upload 2 KB | Rejected |

## 4. Edge Cases & Negative Paths

**Configuration parsing (`ortha.config.ts`)**

- **EC-01 — Missing `DATABASE_URL`.** `❌ NONE` Defaults to `''` (`:81`). `pg` treats that
  as "use libpq defaults", so the process boots and every request 500s with a connection
  error rather than the actual problem. → `🐞 BUG-app-server-01` (grouped).
- **EC-02 — Missing `SESSION_SECRET` / `TOKEN_SECRET`.** `❌ NONE` 🔒 Both default to `''`
  (`:106-107`). → `🐞 BUG-app-server-01`.
- **EC-03 — `PORT=0`.** `❌ NONE` `Number('0') || 3000` → 3000. Port 0 ("pick a free port")
  is unrepresentable. Same shape at `:118,124,128,133-134,169,178-183,189,200,211`.
- **EC-04 — `PORT=99999`.** `❌ NONE` Passed through; `listen` rejects with `ERR_SOCKET_BAD_PORT`
  as an unhandled rejection.
- **EC-05 — `PORT=' 3000 '`.** `❌ NONE` `Number` trims → 3000. Fine.
- **EC-06 — `SESSION_TTL_SECONDS=-1`.** `❌ NONE` `Number('-1') || …` → `-1` is truthy, so a
  **negative** TTL is accepted: every session is issued already expired. No lower-bound
  check anywhere.
- **EC-07 — `MEDIA_MAX_UPLOAD_BYTES=-1`.** `❌ NONE` Same shape — a negative cap rejects
  every upload.
- **EC-08 — `GRAPHQL_MAX_DEPTH=1e9`.** `❌ NONE` Accepted; the cost budget that
  `ADR-0008`/`ortha.config.ts:172-176` calls "the replacement bound" for GraphQL's lack of
  structural bounding is silently removed. 🔒
- **EC-09 — `API_DOCS=TRUE` (upper case).** `❌ NONE` `=== 'true'` fails → docs **off**.
  Fail-closed, so acceptable, but surprising.
- **EC-10 — `MCP_ENABLED=1` / `COPILOT_ENABLED=yes`.** `❌ NONE` Both `=== 'true'`, so both
  fail closed. Consistent and safe.
- **EC-11 — `LOGIN_RATE_LIMIT=0`.** `❌ NONE` → 10. "Block all logins" is unrepresentable.
- **EC-12 — `ALLOWED_ORIGINS` with a trailing slash** (`http://localhost:4200/`).
  `❌ NONE` The value is compared against the `Origin` header, which never has a trailing
  slash → every state-changing POST 403s with a config that *looks* right. 🔒 (availability,
  not exposure)
- **EC-13 — `ALLOWED_ORIGINS='*'`.** `❌ NONE` Treated as a literal origin string, so it
  matches nothing. No wildcard support and no error.
- **EC-14 — Two config keys read the same variable.** `❌ NONE` `NODE_ENV` drives both
  `docs.enabled` (`:89`) and `cookieSecure` (`:120`). Setting `NODE_ENV=production` to hide
  the docs also turns on `Secure` cookies — which breaks local HTTP testing. The coupling is
  undocumented.
- **EC-15 — `COPILOT_PROVIDER` naming an unregistered provider.** `❌ NONE` No boot-time
  validation against the `providers` array in `src/plugins.ts:113-130`; the failure appears
  per-run.
- **EC-16 — `MEDIA_PROVIDER` naming an unregistered provider.** `❌ NONE` Same shape
  (`ortha.config.ts:156` vs `src/plugins.ts:87-89`); the failure appears per-upload.

**Plugin registry (`src/plugins.ts`)**

- **EC-17 — Registering the same plugin twice.** `❌ NONE` Nothing de-duplicates; two
  `DynamicModule`s of the same class both register their providers.
- **EC-18 — Removing a plugin another one binds a port on.** `❌ NONE` Ports are injected
  `@Optional()` (`ARCHITECTURE.md` §6), so removing e.g. `ActivityPlugin` degrades silently
  — audit rows stop being written with no boot error.
- **EC-19 — Reordering the workspace-interior plugins.** `❌ NONE` The file's header comment
  (`:26-41`) says DI is order-independent because every module is global and the order is
  "legibility only" — except for `DatabasePlugin` (init) and the **migration** order, which
  is load-bearing (EC-20).
- **EC-20 — Migration order vs FK order.** `⚠️ PARTIAL` `applyPluginMigrations` iterates in
  registration order (`packages/nx/src/lib/drizzle/apply.ts:27`). Moving `WorkspacesPlugin`
  above `IdentityPlugin` breaks a **fresh** migrate but is invisible on an already-migrated
  DB — so the mistake ships and only bites the next clean install.
- **EC-21 — A migration run interrupted midway.** `❌ NONE` No outer transaction across
  plugins; earlier plugins stay migrated. See `docs/testing/bootstrap-server.md` EC-30.
- **EC-22 — Two instances booting and migrating at once.** `❌ NONE` No advisory lock.
- **EC-23 — `db:migrate` against a DB migrated by an older plugin set.** `❌ NONE` Each
  plugin's tracking table is independent, so removing a plugin from `plugins.ts` leaves its
  tables and its tracking table orphaned, and re-adding it later resumes from where it left
  off — including if the schema drifted meanwhile.

**Content model (`src/content/`)**

- **EC-24 — A table not re-exported from `src/content/index.ts`.** `⚠️ PARTIAL` Documented
  in `AGENTS.md` ("silently absent from migrations … join tables via `joinTableOf`
  included"), which makes it a known trap rather than a surprise — but nothing *checks* it,
  so the failure is a runtime `relation does not exist` on first use.
- **EC-25 — A content type in `contentTypes` with no table at all.** `❌ NONE` Boots; every
  read/write against it 500s.
- **EC-26 — Two content types with colliding GraphQL names.** `✅ E2E` Fails at boot by
  design (`src/plugins.ts:64-66`).
- **EC-27 — Renaming a collection slug.** `❌ NONE` The generated table name changes;
  drizzle-kit emits a drop+create, silently destroying data unless the migration is
  hand-reviewed. `.cursor/BUGBOT.md` warns never to hand-edit *applied* migrations, but
  reviewing a *new* destructive one is on the author.

**Failure & partiality**

- **EC-28 — Postgres down at boot.** `❌ NONE` Boots (lazy pool); `/api/auth/me` returns
  `500`. No readiness endpoint exists anywhere in the repo to make this visible to an
  orchestrator.
- **EC-29 — Postgres restarts while running.** `❌ NONE` `pg` reconnects per-client on the
  next acquisition, but an in-flight `UnitOfWork.run` fails with an unmapped 500.
- **EC-30 — `MEDIA_LOCAL_ROOT` not writable.** `❌ NONE` Boots; every upload fails.
- **EC-31 — `SIGTERM` during a request.** `❌ NONE` No shutdown hooks. See
  `docs/testing/bootstrap-server.md` `🐞 BUG-bootstrap-server-04`.

**Permission matrix at the app level.** This app registers no route of its own, so the
matrix belongs to each plugin's artifact. Two app-level facts matter: (a) every plugin's
routes are mounted unconditionally except the two kill-switched ones (`copilot`, `mcp`),
so **disabling a capability is only possible for those two**; and (b) the two host doc
routes are outside every guard, so "unauthenticated" is a real role here — covered as
`🐞 BUG-app-server-02`.

### 4A. Accessibility & Section 508 Conformance

`apps/server` renders **no user interface**. It is a NestJS composition root: a config file,
a plugin list, and a code-defined content model. Almost every WCAG 2.1 AA success criterion
is therefore **Not Applicable** here and is assessed on `apps/admin`, `bootstrap-admin` and
`packages/design-system` instead. Two things genuinely belong to this unit, and both are
Chapter 5 / 504 concerns rather than 1.x–4.x ones:

**Not Applicable — with justification, not padding.** 1.1.1, 1.3.x, 1.4.x, 2.1.x, 2.2.1,
2.4.x, 3.2.x, 3.3.x and 4.1.2/4.1.3 all describe rendered content and interactive controls;
this app emits JSON. 503.4 (captions/audio controls) — no media player. 502.2/502.3
(platform AT interoperability, reduced motion, forced colors) — no platform UI. The two
**HTML** surfaces the app does cause to exist are third-party pages it only switches on:
the Scalar reference (`apps/server/ortha.config.ts:87-89` → the host's
`setup-api-docs.ts:141`) and GraphiQL
(`apps/server/src/plugins.ts:73` → `graphql-playground.controller.ts:44`). Their conformance
belongs to Scalar and to `@graphql-yoga/render-graphiql`; this app neither styles nor
markup-controls them. Recorded as inherited, unverified, and out of scope for remediation
here — but note that both are on by default outside an explicit `NODE_ENV=production`
(`🐞 BUG-app-server-02`), so a deployment publishes two pages whose accessibility it has
never assessed.

#### ♿ A11Y-app-server-01 — An asset's alt text is one global column, so it cannot vary per usage or per locale

**WCAG:** 1.1.1 Non-text Content (A) · **508:** E205.4, **504.2.1** (preservation of
accessibility information) · **Verdict: Partially Supports**
**Location:** `packages/media/server/src/lib/infrastructure/schema/media-asset.ts:62`
(`alt: text('alt')`) versus the host's media fields
`apps/server/src/content/collections/article.ts:103-120` (`coverImage`, `localizedHero`,
`gallery`).

The data model *can* carry alt text — which is the important half, and better than many
CMSes manage. What it cannot do is carry **more than one**. `alt` hangs off the asset row,
not off the field occurrence, so:

- The same image used as `coverImage` on one article and inside `body` richtext on another
  carries identical alt text in both, though the two contexts need different sentences.
- `alt` has no `locale` column, while the entries that reference it do
  (`packages/content/server/src/lib/collection/table-builder.ts:204`). A German translation
  of an article therefore ships English alt text — 3.1.2 Language of Parts fails at the data
  layer, and no admin edit can fix it.
- There is no `decorative` flag, so "this image is decorative, emit `alt=''`" is
  indistinguishable from "nobody filled the field in". A consumer rendering the API cannot
  tell which, and will guess wrong in one direction or the other.

**Repro:** 1) upload one image, 2) set it as `coverImage` on an `article` and as a `gallery`
item on a second, 3) create the `de` translation of the first, 4) read
`GET /api/v1/content/article?relations=preview&media=preview` for all three.
→ Observed: one `alt` string in all four places. → Expected: per-occurrence and per-locale
alt, plus an explicit decorative marker.

**Keyboard-only user:** unaffected. **Screen-reader user of a site built on this API:**
hears the same, often wrong-language, description for every use of an image, or hears a
filename where a decorative image should have been skipped silently.

**Remediation:** add `alt` (and a `decorative` boolean) to the media *reference* — the
per-field join/value — falling back to the asset-level `alt`, and localize it on i18n types
the way every other localized value already is.

#### ♿ A11Y-app-server-02 — The shipped content types model no table caption, no heading structure and no per-field language, so 504.2 conformance rests entirely on the richtext editor

**WCAG:** 1.3.1 Info and Relationships (A) · **508: 504.2 / 504.4** (authoring tool: can an
author produce conformant content; do shipped templates default to conformant output) ·
**Verdict: Unverified — Partially Supports**
**Location:** `apps/server/src/content/collections/article.ts:30-100`,
`apps/server/src/content/index.ts`

The kitchen-sink `article` type is the repo's *reference* content model, so what it can
express is what a 508 auditor will read as the product's ceiling. It has exactly one
structured field — `body: field.richtext()`
(`apps/server/src/content/collections/article.ts:56-60`) — and every other field is a
scalar. Whether an author can produce real headings, lists and `<th>` cells is therefore
entirely a property of the WYSIWYG and its stored format, not of this app; **and whether
that markup survives save → reload → locale copy → revision restore (504.2.1) is not
asserted anywhere in `apps/server-e2e`.** `field.json` and `field.multiselect` carry no
language marker, so a mixed-language field cannot be marked up at all (3.1.2).

What this unit *does* get right and should be credited with: the row-per-locale model gives
every entry an explicit, non-null language (`table-builder.ts:204`), which is the single
most valuable thing a CMS data model can do for 3.1.2 downstream.

**Unverified — what could not be confirmed from `apps/server` alone:** whether richtext
round-trips heading levels, list semantics and table header cells intact. That belongs to
`docs/testing/wysiwyg-admin.md` and `docs/testing/content-server.md`; this entry exists so
the 504.2/504.2.1 question is asked of the shipped model rather than assumed.

**Remediation:** none in this app beyond adding a 504.2.1 round-trip assertion to
`apps/server-e2e` for the richtext field; the real fix (if the round-trip loses semantics)
is in the editor and the stored document format.

**♿ tally:** `2 findings — 0 Supports · 1 Partially Supports · 0 Does Not Support · 1 Unverified`
(everything else Not Applicable: this app renders no UI).

## 5. E2E Coverage Map

`apps/server-e2e` boots the **real** plugin graph through a parallel composition root
(`apps/server-e2e/src/support/plugins.ts` + `test-config.ts`), not through `apps/server`'s
own `buildPlugins`/`ortha.config.ts`. So every suite is strong evidence that the *plugins*
work and weak evidence that **this app's** wiring is right — the two files can drift.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1/F2 boot | `apps/server-e2e/src/server/server.spec.ts:15-17` | A full app built from a plugin list serves 404 under `/api` | ⚠️ PARTIAL — uses `buildTestPlugins`, not `buildPlugins`; nothing pins the real registry |
| F3 database-first | `apps/server-e2e/src/support/test-app.ts:36-38` | Init hooks run before `NestFactory.create` | ⚠️ PARTIAL — mirrors the order rather than asserting it |
| F4 identity/workspaces/users ordering | `apps/server-e2e/src/server/workspaces/workspace-members.spec.ts`, `users/list-users.spec.ts` | Cross-plugin reads work | ⚠️ PARTIAL — proves DI order-independence, not migration order |
| F6/F7 GraphQL adapter + playground | `apps/server-e2e/src/server/api-tokens/public-graphql-api.spec.ts`, `public-graphql-playground.spec.ts` | The GraphQL protocol reuses the same tokens/guards/scopes; the playground's availability is asserted | ✅ E2E |
| F17 GraphQL cost budget | `apps/server-e2e/src/server/api-tokens/public-graphql-limits.spec.ts` | Depth/complexity/alias/length caps reject over-budget documents | ✅ E2E — against test-config values |
| F8/F24 media composition + upload cap | `apps/server-e2e/src/server/media/media-assets.spec.ts`, `apps/server-e2e/src/support/media-storage.ts` | Uploads land through the registered provider; oversize is rejected | ✅ E2E |
| F9/F11 copilot composition + kill switch | `apps/server-e2e/src/server/copilot/copilot-chat.spec.ts`, `copilot-read-catalogue.spec.ts`, `apps/server-e2e/src/support/copilot.ts` | Runs execute through the `fake` provider with no key or network; the catalogue asserts what the copilot surface is and is not shown | ✅ E2E |
| F10 MCP kill switch + surface | `apps/server-e2e/src/server/mcp/mcp.spec.ts` | The MCP front door and its tool surface | ✅ E2E |
| F13 cookie flags | `apps/server-e2e/src/server/auth/login.spec.ts`, `logout.spec.ts`, `user-sessions.spec.ts` | Session issue/revoke over the cookie | ⚠️ PARTIAL — the `Secure`/`SameSite` **attributes** are set from config; no assertion pins them |
| F14 origin allow-list | `apps/server-e2e/src/server/auth/login.spec.ts:235-241` | A disallowed `Origin` → 403 | ✅ E2E |
| F15 login rate limit | `apps/server-e2e/src/server/auth/login-throttle.spec.ts` | The configured limit produces 429 (per-suite config override) | ✅ E2E |
| F16 locales | `apps/server-e2e/src/server/i18n/i18n-content.spec.ts`, `insights/localization-insights.spec.ts` | The configured locale set drives row-per-locale behaviour and coverage | ✅ E2E |
| F20 content model | `apps/server-e2e/src/server/content/content-types.spec.ts`, `content-schema.spec.ts` | Types and their generated schema | ✅ E2E — but against `apps/server-e2e/src/support/content/*`, **not** `apps/server/src/content/*` |
| F23 root admin | `apps/server-e2e/src/server/auth/root-admin.spec.ts` | Bootstrap seeding and re-boot idempotency | ✅ E2E |
| F5/F21/F22 host content migrations | `apps/server-e2e/src/support/global-setup.ts` | Migrations apply | ⚠️ PARTIAL — for the *test* content set |
| F12 docs gate, F18 model-list parsing, F19 conditional `limits` spread | — | — | ❌ NONE |

**Coverage tally:** `24 features · 12 ✅ · 10 ⚠️ · 2 ❌`

## 6. 🐞 Potential Bugs

### 🐞 BUG-app-server-01 — Every security-critical setting defaults to the empty string and nothing validates it, so a misconfigured deployment boots silently · Severity: Medium · 🔒

**Location:** `apps/server/ortha.config.ts:80-82,106-107,136-140`
**Category:** correctness

**What the code does:**

```ts
database: { url: process.env['DATABASE_URL'] ?? '' },
…
identity: {
    sessionSecret: process.env['SESSION_SECRET'] ?? '',
    tokenSecret: process.env['TOKEN_SECRET'] ?? '',
```

There is no validation step anywhere between `process.env` and the plugins — the file's own
header calls itself "the single place that reads `process.env`" (`:4-5`) and hands the
result on unchecked. `main.ts:5-9` adds nothing.

**Why it is wrong:** the concrete, *today* failure is `DATABASE_URL`. `''` reaches
`new Pool({ connectionString: '' })` (`packages/database/src/lib/utils/db.ts:18`), and an
empty string is falsy to `pg`, so the pool silently falls back to libpq environment defaults
(`PGHOST`/`PGUSER`/current user, localhost) instead of failing. The server then boots
cleanly, logs its `🚀` line, and fails only on the first query — or, worse, connects to
whatever local database the ambient environment names.

The two secrets are a **latent** trap rather than a live one, and the artifact previously
overstated them: `sessionSecret` and `tokenSecret` are declared in
`packages/identity/server/src/lib/types/index.ts:8,20` and **read nowhere** — a repo-wide
search finds no consumer outside the type, `ortha.config.ts` and
`apps/server-e2e/src/support/test-config.ts:75-76`. Sessions are unsigned opaque 256-bit
tokens stored as SHA-256 (`packages/identity/server/src/lib/auth/services/hashing.service.ts:48-50`),
which identity's `AGENTS.md` records as deliberate ("Session cookie is unsigned, token hashed
at rest (#8) … Consequently `sessionSecret` stays **unconsumed** for now"). So there is no
forgery path from an empty secret. What is wrong is that the same `AGENTS.md` states
"fail-fast validation **must** be added when signing is introduced (#10)" — and because the
config supplies `''` rather than throwing, the first consumer to start signing will inherit
an empty key from every deployment that never set the variable, with no boot signal.

**Repro:**
1. `unset SESSION_SECRET TOKEN_SECRET DATABASE_URL` (or deploy a container that forgot them).
2. `npx nx serve server`
→ Observed: boots normally, `🚀 Application is running on: http://localhost:3000/api`, no
warning; the pg pool is pointed at libpq defaults rather than the intended database.
→ Expected: the process refuses to start — `DATABASE_URL is required` — or, at minimum,
logs a prominent `Logger.error` and exits non-zero.

**Blast radius:** any deployment missing an env var. Today: a server that appears healthy
while connected to the wrong database (or to none). Tomorrow: whichever ticket introduces
signing silently inherits an empty key across every such deployment. No authentication
bypass exists at this commit.
**Suggested fix:** validate the config once at the bottom of `ortha.config.ts` — throw for
an absent/empty `DATABASE_URL`, and throw (or warn loudly with a minimum length) for
`SESSION_SECRET` / `TOKEN_SECRET` now, so the fail-fast is in place before the first signing
consumer rather than after it.

### 🐞 BUG-app-server-02 — The API reference and GraphiQL both default to *on* unless `NODE_ENV=production` is explicitly set · Severity: Medium · 🔒

**Location:** `apps/server/ortha.config.ts:87-89` and `apps/server/src/plugins.ts:70-73`
**Category:** data-leak

**What the code does:**

```ts
enabled: process.env['API_DOCS']
    ? process.env['API_DOCS'] === 'true'
    : process.env['NODE_ENV'] !== 'production',
```

and that one value gates two surfaces:

```ts
// src/plugins.ts:73
playground: config.docs.enabled === true
```

**Why it is wrong:** the comment above it says "On outside production, where the reference
is a development tool" — but `NODE_ENV` is not set by Node, by Docker, or by most process
managers. So the effective default in a plain deployment is **enabled**, and the reference
routes deliberately sit outside every guard
(`packages/bootstrap/server/src/lib/utils/setup-api-docs.ts:139,141` register both routes
straight on the `httpAdapter`, below Nest's guard pipeline). The result is an
unauthenticated, complete, machine-readable description of the API — plus an interactive
GraphiQL page — published by default. Cross-reference
`docs/testing/bootstrap-server.md` `🐞 BUG-bootstrap-server-01`, which is the same defect at
the host layer; this entry records that the app-level config *repeats* rather than corrects
it, and additionally couples the GraphQL playground to it.

Scope, precisely: the GraphiQL route is `GET /api/v1/graphql/playground`
(`packages/content/graphql/src/lib/http/controllers/graphql-playground.controller.ts:29-44`),
and it is `@Public()` **by design** — it is a static, ~9 MB self-contained page that reads
nothing and carries no schema. `POST /api/v1/graphql` and the SDL `GET` remain behind
`ApiTokenGuard` + `ApiTokenWorkspaceGuard`, so introspection is *not* exposed by this
default: the per-grant-set schema of `ADR-0008` still needs a bearer token. What leaks is
the OpenAPI document and the existence of the tooling.

**Repro:**
1. `docker run -e DATABASE_URL=… <image>` with no `NODE_ENV` and no `API_DOCS`.
2. `curl -s https://<host>/reference/json | jq '.paths | keys | length'`
3. `curl -sD- -o/dev/null https://<host>/api/v1/graphql/playground`
→ Observed: full OpenAPI document, `200`; GraphiQL HTML, `200`. Neither requires a
credential. → Expected: `404` for both.

**Blast radius:** every self-hosted deployment that does not set `NODE_ENV`. Reconnaissance
only — it enumerates routes, DTO shapes and the two security schemes, and it invites a
pasted credential on a page the operator did not intend to publish. No authenticated data
is reachable through either surface, which is why this is Medium and not High.
**Suggested fix:** make the docs switch opt-**in** (`process.env['API_DOCS'] === 'true'`,
full stop) and drop the `NODE_ENV` fallback, or log a startup warning naming both surfaces
when `NODE_ENV` is unset.

### 🐞 BUG-app-server-03 — `Number(x) || default` silently rejects `0` and silently accepts negatives for every numeric setting · Severity: Medium

**Location:** `apps/server/ortha.config.ts:78,117-118,124-125,128,132-134,168-169,178-183,188-189,199-200,208-211`
**Category:** correctness

**What the code does:** the same idiom — 15 `Number(process.env…)` reads covering 14
settings (`COPILOT_MAX_STEPS` is read twice, at `:208` and `:211`):

```ts
port: Number(process.env['PORT']) || 3000,
ttlSeconds: Number(process.env['SESSION_TTL_SECONDS']) || 60 * 60 * 24 * 7,
limit: Number(process.env['LOGIN_RATE_LIMIT']) || 10,
maxUploadBytes: Number(process.env['MEDIA_MAX_UPLOAD_BYTES']) || 52_428_800,
maxDepth: Number(process.env['GRAPHQL_MAX_DEPTH']) || 8,
```

**Why it is wrong:** `||` treats `0` and `NaN` identically, and treats every negative as
valid. Two symmetrical failures:

- **`0` is unrepresentable.** `LOGIN_RATE_LIMIT=0` ("block all logins") silently becomes 10.
  `MEDIA_MAX_UPLOAD_BYTES=0` ("no uploads") silently becomes 50 MB. `PORT=0` ("pick a free
  port", a normal Node idiom) becomes 3000. An operator who deliberately set a hardening
  value gets the permissive default and no warning.
- **Negatives pass.** `SESSION_TTL_SECONDS=-1` is truthy, so every session is issued already
  expired; `GRAPHQL_MAX_DEPTH=-1` disables the cost bound that
  `ortha.config.ts:172-176` describes as the *replacement* for REST's structural bounding.
  Nothing clamps or validates.

`packages/utils/server` already exports the right primitive for this —
`clampInt(raw, fallback, min, max)` (`packages/utils/server/src/lib/clamp-int.ts:7`), used
for request pagination but not for configuration.

**Repro:**
1. `LOGIN_RATE_LIMIT=0 npx nx serve server`; attempt 11 bad logins.
2. `SESSION_TTL_SECONDS=-1 npx nx serve server`; log in.
→ Observed: (1) the 11th is the first to 429 — the setting was ignored; (2) login succeeds
but the session is immediately unusable, with no error explaining why.
→ Expected: an explicit parse that distinguishes "absent" from "zero" and rejects
out-of-range values.

**Blast radius:** every numeric setting, i.e. every hardening knob an operator would reach
for. Silent in both directions.
**Suggested fix:** replace the idiom with `clampInt(process.env[…], default, min, max)` (or a
small `readInt` helper that only falls back when the variable is absent or non-numeric) and
give each setting a sane minimum.

### 🐞 BUG-app-server-04 — `defaultProvider` for media and copilot is not validated against the providers actually registered, so a typo fails per-request instead of at boot · Severity: Low

**Location:** `apps/server/ortha.config.ts:156` and `:198`, versus `apps/server/src/plugins.ts:86-91` and `:112-130`
**Category:** correctness

**What the code does:**

```ts
// config
media:   { defaultProvider: process.env['MEDIA_PROVIDER']  ?? 'local' },
copilot: { defaultProvider: process.env['COPILOT_PROVIDER'] ?? 'fake' },

// plugins.ts — the only place the names are defined
providers: { local: createLocalStorageProvider(config.plugins.media.local) },
providers: [ { name: 'claude', … }, { name: 'ollama', … }, { name: 'fake', … } ],
```

**Why it is wrong:** the composition root already holds both halves — the registered names
and the default name — in the same function call, but never compares them. `MEDIA_PROVIDER=s3`
is accepted even though `s3` is not registered (the config even carries an `s3` block at
`:163-166` for a provider `plugins.ts` does not construct), and `COPILOT_PROVIDER=claud`
boots fine. The failure surfaces on the first upload / first run, as a runtime error to an
end user. This is exactly the class of mistake the file's own design note argues
composition-time checking should catch — `ContentGraphqlPlugin` takes `content` **by value**
specifically so a name collision "fail[s] boot … rather than on the first request"
(`src/plugins.ts:64-66`).

**Repro:**
1. `MEDIA_PROVIDER=s3 npx nx serve server`.
2. Upload any asset from the admin Media Library.
→ Observed: boot is clean; the upload fails with an unresolved-provider error.
→ Expected: boot fails with `media.defaultProvider "s3" is not registered (have: local)`.

**Blast radius:** operator confusion and a broken feature discovered late; no data or
authorization impact.
**Suggested fix:** assert in `buildPlugins` that `config.plugins.media.defaultProvider` is a
key of the `providers` object and that `config.plugins.copilot.defaultProvider` is one of the
registered `name`s, throwing with the valid list.

**Checked and cleared** (no defect found): the plugin *ordering* in `src/plugins.ts:54-170`
is correct and its rationale (`:26-41`) matches reality — `DatabasePlugin` first, identity
before workspaces (FK), workspaces before content (guard + port binding), MCP last; the
`ContentGraphqlPlugin` by-value composition genuinely does move a collision to boot time;
both kill switches (`COPILOT_ENABLED`, `MCP_ENABLED`) fail **closed** on any value other
than the exact string `'true'`, which is the right direction; the comma-split-trim-filter
idiom for `ALLOWED_ORIGINS` and the model lists is correct
(`:110-115,222-228,239-242`); the conditional spread of `limits` at `:208-214` correctly
leaves plugin defaults untouched when the variable is absent (with the `0` caveat recorded
in `🐞 BUG-app-server-03`); `cookieSecure` correctly tracks production and `SameSite=lax`
is the right choice for a same-origin admin (`:120-121`); and `main.ts` is a faithful
nine-line delegation with no logic of its own — its only flaw (no `.catch`) belongs to the
host and is filed there.

**Tally:** `4 🐞 — 0 Critical · 0 High · 3 Medium · 1 Low (2 🔒)` ·
`♿ 2 findings — 0 Supports · 1 Partially Supports · 0 Does Not Support · 1 Unverified`

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | Unit (`apps/server/src/__test__/config.spec.ts`, jest, re-importing `ortha.config` under mutated `process.env`) | config validation | 🔒 Absent/empty `SESSION_SECRET`, `TOKEN_SECRET` or `DATABASE_URL` causes a **throw**, not an empty-string default. Currently fails | `🐞 BUG-app-server-01`, EC-01, EC-02 |
| 2 | Unit (same file) | docs gate truth table | `{NODE_ENV, API_DOCS}` × `{unset, 'production', 'true', 'false', '1'}` maps to the intended `docs.enabled`, and the case "`NODE_ENV` unset ⇒ enabled" is asserted **explicitly** so any change to the default is deliberate | F12, `🐞 BUG-app-server-02` |
| 3 | Unit (same file) | numeric parsing | `LOGIN_RATE_LIMIT=0` yields `0` (not 10); `SESSION_TTL_SECONDS=-1` is rejected; `PORT=0` is preserved; `GRAPHQL_MAX_DEPTH=abc` falls back. Currently fails | `🐞 BUG-app-server-03`, EC-03, EC-06, EC-08 |
| 4 | Unit (`apps/server/src/__test__/plugins.spec.ts`) | registry invariants | `buildPlugins(config)[0].name === 'database'`; identity precedes workspaces which precedes content; every `migrations.table` in the list is **unique**; every plugin `name` is unique | F2, F3, F4, EC-07-shape |
| 5 | Unit (same file) | composition-root validation | `config.plugins.media.defaultProvider` is a registered provider key and `config.plugins.copilot.defaultProvider` is a registered provider name — otherwise throw. Currently fails | `🐞 BUG-app-server-04`, EC-15, EC-16 |
| 6 | `apps/server-e2e` (testcontainer + supertest) | `apps/server-e2e/src/server/auth/session-cookie-attributes.spec.ts` | 🔒 The `Set-Cookie` from `POST /api/auth/login` carries `HttpOnly` and `SameSite=Lax`, and carries `Secure` **iff** the test config says production — pinning `ortha.config.ts:120-121`, which nothing asserts today | F13 |
| 7 | Unit (`apps/server/src/content/__test__/exports.spec.ts`) | content aggregation | Every content type in `contentTypes` has its table (and every `joinTableOf` join table) re-exported from `src/content/index.ts` — turning the documented silent-migration trap into a failing test | F21, EC-24 |
| 8 | `apps/server-e2e` | `apps/server-e2e/src/server/config/kill-switches.spec.ts` | With `MCP_ENABLED` unset, `POST /api/v1/mcp` → 404; with `'true'` → JSON-RPC; with `'1'` → 404. Same three cases for `COPILOT_ENABLED` against `/api/copilot/models` | F10, F11, EC-10 |
| 9 | `apps/server-e2e` | `apps/server-e2e/src/server/auth/origin-allowlist.spec.ts` | An `ALLOWED_ORIGINS` entry with a trailing slash rejects the matching browser `Origin` — documenting EC-12 so the footgun is at least visible | F14, EC-12 |
| 10 | Nx target check (CI) | migration drift guard | `nx run server:db:generate --name=ci-check` produces **no** new SQL on a clean checkout, failing the build when a content-type edit was committed without its migration (`.cursor/BUGBOT.md`, "Schema/migration drift") | F21, F22, EC-27 |

# @ortha-cms/nx — Test Artifact

> **Unit:** `packages/nx` · **Package:** `@ortha-cms/nx` · **Kind:** library (Nx plugin — developer tooling, no UI)
> **Source of truth:** `packages/nx/AGENTS.md`
> **Findings verified:** 2026-08-11 — 7 confirmed · 0 deleted · 6 corrected · 4 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** the workspace's Nx plugin — a `createNodesV2` target-inference rule
plus four executors. It infers `db:generate` onto any project with a
`drizzle.config.ts`; `db:migrate` and `db:studio` onto the host (the project with
an `ortha.config.ts`); and `build` / `pack` / `nx-release-publish` onto packages
under `packages/`. It owns the Drizzle migration **apply** loop, the Drizzle
Studio launcher, the jiti+swc loader that reads the host's TypeScript config at
runtime, and the whole throttled/retried npm publish path.

**Does NOT own:** the schemas (each plugin owns its own `drizzle.config.ts` and
`migrations/`), the migration **content** (drizzle-kit generates the SQL), the
host's plugin list or its order (`apps/server/src/plugins.ts`), the
runtime database connection (`@ortha-cms/database` opens that in
`onPluginInit` — this package opens its own short-lived `pg.Pool` for migrations
only), the staging of a publishable package (`tools/release/pack.mjs`), or the
release orchestration (`nx release`, driven by `tools/release/release.mjs` and
`nx.json`'s `release` block).

**This is developer tooling.** It renders no UI, ships in no product, and is
`"private": true` (`packages/nx/package.json:4`) so it is excluded from the
release (`nx.json:101`). §3 below is therefore a set of **CLI invocations**, not
UI steps, and §4A is short by design.

- **Entry points**
  - `createNodesV2` (`packages/nx/src/index.ts:17`) — glob
    `'**/{drizzle.config.ts,ortha.config.ts,package.json}'`.
    | Trigger file | Target(s) inferred | Cacheable |
    | --- | --- | --- |
    | `<p>/drizzle.config.ts` | `db:generate` | ✅ (`inputs: ['{projectRoot}/src/lib/schema/**/*']`, `outputs: ['{projectRoot}/migrations']`) |
    | `<p>/ortha.config.ts` | `db:migrate`, `db:studio` | ❌ (`cache: false`) |
    | `packages/<p>/package.json` with a `name` **and** a `tsconfig.lib.json` | `build` | ✅ |
    | …and not `"private": true` | `pack`, `nx-release-publish` | `pack` ❌, publish n/a |
  - Executors (`packages/nx/executors.json`): `db-generate`, `db-migrate`,
    `db-studio`, `release-publish`.
  - Library functions: `runDrizzleKitGenerate` (`src/lib/drizzle/generate.ts:13`),
    `applyPluginMigrations` (`src/lib/drizzle/apply.ts:12`),
    `runDrizzleKitStudio` (`src/lib/drizzle/studio.ts:31`), `createTsJiti`
    (`src/lib/jiti.ts:45`), `publishWithRetry` / `runNpmPublish` /
    `isRateLimit` / `formatNpmError` (`src/lib/release/publish.ts`),
    `withPublishSlot` / `tripCreationLimit` / `creationLimitTrippedBy` /
    `throttleStateDir` (`src/lib/release/throttle.ts`), `probeRegistry` /
    `registryTokenFromEnv` (`src/lib/release/registry.ts`).
  - Registration: `nx.json:89` (`"@ortha-cms/nx"` in `plugins`), plus the
    `nx-release-publish` executor **repeated** in `nx.json:95-98` (see F7).

- **Runtime prerequisites**
  - Node + the workspace's `node_modules` (`drizzle-kit`, `drizzle-orm`, `pg`,
    `jiti`, `@swc/core`, `@nx/devkit` — `packages/nx/package.json:17-25`).
  - **`db:migrate` / `db:studio`:** a reachable Postgres and a `.env` at the
    workspace root exporting `DATABASE_URL`. Nothing in this package loads
    `.env` — Nx's own dotenv loading does, so running the executors outside Nx
    resolves nothing (EC-05). `apps/server/ortha.config.ts:80-82` is the single
    reader: `url: process.env['DATABASE_URL'] ?? ''`.
  - **`db:generate`:** **no database and no secret** — generation only diffs the
    schema against `migrations/meta/`. The committed drizzle configs carry no
    `dbCredentials` on purpose.
  - **`nx-release-publish`:** a staged `dist/pack/<projectRoot>/` (produced by
    `pack`), an `NPM_TOKEN` in the environment, and network access to the
    registry.
  - Docker for a local Postgres: `docker compose up -d`.

- **How to exercise it manually**
  ```bash
  docker compose up -d
  cp .env.example .env            # ensure DATABASE_URL is set
  npx nx run server:db:migrate                     # apply every plugin's SQL
  npx nx run @ortha-cms/identity-server:db:generate --name=my_change
  npx nx run server:db:studio --port=4990          # Ctrl+C to stop
  npx nx show project server --json | jq '.targets | keys'   # see the inferred targets
  npx nx reset && npx nx graph --file=/tmp/graph.json        # re-run inference cold
  npm run release:dry-run                          # rehearse the publish path
  ```

- **Dependencies that must be healthy:** `drizzle-kit`'s `bin.cjs` must be
  resolvable beside its main entry (both `generate.ts:20` and `studio.ts:37`
  reach for it that way, because drizzle-kit's `exports` map blocks a direct
  `./bin.cjs` resolution); `@ortha-cms/bootstrap-server` for the `ServerPlugin`
  type; `apps/server/ortha.config.ts` and `apps/server/src/plugins.ts` must be
  loadable by jiti+swc; `tools/release/pack.mjs` must have staged
  `dist/pack/<projectRoot>/package.json` before a publish.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `createNodesV2` glob + per-file dispatch (drizzle vs ortha vs manifest) | `packages/nx/src/index.ts:17-71` | ❌ NONE |
| F2 | Infer cacheable **`db:generate`** with declared inputs/outputs | `packages/nx/src/index.ts:37-49` | ❌ NONE |
| F3 | Infer **`db:migrate`** on the host, with `plugins: '<root>/src/plugins.ts'` | `packages/nx/src/index.ts:51-58` | ❌ NONE |
| F4 | Infer **`db:studio`** on the host | `packages/nx/src/index.ts:59-65` | ❌ NONE |
| F5 | Infer **`build`** (`tsc --build tsconfig.lib.json`) for a `packages/*` project | `packages/nx/src/index.ts:112-124` | ❌ NONE |
| F6 | Infer **`pack`** for a publishable package (`dependsOn: ['build']`, `cache: false`) | `packages/nx/src/index.ts:131-141` | ❌ NONE |
| F7 | Infer **`nx-release-publish`** pointed at `dist/pack/<root>`, mirrored in `targetDefaults` | `packages/nx/src/index.ts:142-157`, `nx.json:95-98` | ❌ NONE |
| F8 | Inference guards: non-`packages/` root, unparseable manifest, no `name`, no `tsconfig.lib.json`, `private` | `packages/nx/src/index.ts:97-127` | ❌ NONE |
| F9 | `db-generate` executor — resolves `cwd` against the workspace root, forwards `--name` | `packages/nx/src/executors/db-generate/executor.ts:20-27` | ❌ NONE |
| F10 | `runDrizzleKitGenerate` — bin resolution, `cwd`-relative config paths, no DB | `packages/nx/src/lib/drizzle/generate.ts:13-26` | ❌ NONE |
| F11 | `db-migrate` executor — loads `ortha.config.ts` + `buildPlugins()` through jiti+swc | `packages/nx/src/executors/db-migrate/executor.ts:27-46` | ❌ NONE |
| F12 | `applyPluginMigrations` — per-plugin tracking table, ordered loop, pool always closed | `packages/nx/src/lib/drizzle/apply.ts:12-44` | ❌ NONE (a structurally identical re-implementation runs in every server e2e — see §5) |
| F13 | `db-studio` executor — resolves the URL, refuses with an actionable message when absent | `packages/nx/src/executors/db-studio/executor.ts:29-50` | ❌ NONE |
| F14 | `runDrizzleKitStudio` — ephemeral config in a temp dir, secret via env only, `--host`/`--port`, cleanup | `packages/nx/src/lib/drizzle/studio.ts:31-68` | ❌ NONE |
| F15 | `createTsJiti` — swc in **legacy-decorator** mode so the Nest plugin graph loads | `packages/nx/src/lib/jiti.ts:14-49` | ❌ NONE |
| F16 | `release-publish` — skips a `private` package and one Nx resolved no new version for | `packages/nx/src/executors/release-publish/executor.ts:97-107` | ❌ NONE |
| F17 | `probeRegistry` — one packument `GET` → `version-published` / `name-exists` / `name-absent` / `unknown` | `packages/nx/src/lib/release/registry.ts:37-72` | ❌ NONE |
| F18 | `registryTokenFromEnv` — `npm_config_…:_authToken`, then `NPM_TOKEN`, then `NODE_AUTH_TOKEN` | `packages/nx/src/lib/release/registry.ts:80-87` | ❌ NONE |
| F19 | `withPublishSlot` — cross-process file lock, spacing gap, pid-liveness + age-based steal | `packages/nx/src/lib/release/throttle.ts:50-152` | ❌ NONE |
| F20 | Creation-limit circuit breaker + the `blocked-by-peer` outcome | `packages/nx/src/lib/release/throttle.ts:175-196`, executor `:142-169, 220-231` | ❌ NONE |
| F21 | `publishWithRetry` — retry classification, doubling backoff, the creation exception | `packages/nx/src/lib/release/publish.ts:65-95` | ❌ NONE |
| F22 | `runNpmPublish` — arg assembly and `EPUBLISHCONFLICT` → `already-published` | `packages/nx/src/lib/release/publish.ts:102-152` | ❌ NONE |
| F23 | `formatNpmError` — pull npm's `--json` error out of mixed stdout/stderr | `packages/nx/src/lib/release/publish.ts:206-225` | ❌ NONE |
| F24 | `numeric` precedence — env > target option > built-in default | `packages/nx/src/executors/release-publish/executor.ts:265-275` | ❌ NONE |
| F25 | Dry run — no probe, no spacing wait, `--dry-run` passed through | executor `:109, 118, 156-163, 179, 206-210` | ❌ NONE |
| F26 | `executors.json` registration of all four executors + their `schema.json` contracts | `packages/nx/executors.json`, `src/executors/*/schema.json` | ❌ NONE |

## 3. Manual Test Plan

Every block is a shell session at the workspace root. `$WS` = the workspace root.
Commands are exactly as a QA engineer would type them.

### F1 — Inference fires, and only where it should

**Preconditions:** a clean checkout, `npm ci` done.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx reset` | the Nx daemon and project graph cache are cleared, so inference re-runs |
| 2 | `npx nx show project server --json \| jq '.targets \| keys'` | includes `db:generate`, `db:migrate`, `db:studio` — `apps/server` has **both** a `drizzle.config.ts` and an `ortha.config.ts` |
| 3 | `npx nx show project @ortha-cms/identity-server --json \| jq '.targets \| keys'` | includes `db:generate`, `build`, `pack`, `nx-release-publish` — **not** `db:migrate`/`db:studio` |
| 4 | `npx nx show project @ortha-cms/nx --json \| jq '.targets \| keys'` | includes `build`; **excludes `pack` and `nx-release-publish`** (`"private": true`, guard at `src/index.ts:127`) |
| 5 | `npx nx show project admin --json \| jq '.targets \| keys'` | no `build` from this plugin — `apps/admin` is outside `packages/` (guard at `:97`) |
| 6 | `npx nx show project @ortha-cms/design-system --json \| jq '.targets.build.options'` | `{ command: 'tsc --build tsconfig.lib.json --pretty', cwd: 'packages/design-system' }` |
| 7 | `npx nx show project server-e2e --json \| jq '.targets["db:generate"].options'` | `{ cwd: 'apps/server-e2e', config: 'drizzle.config.ts' }` — inference does not care that the project is a test app |

### F2 / F9 / F10 — `db:generate`

**Preconditions:** no database needed. Work on a scratch branch — this writes SQL.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx run @ortha-cms/identity-server:db:generate --name=qa_probe` | drizzle-kit runs with `cwd=packages/identity/server`; prints its diff; either emits `migrations/NNNN_qa_probe.sql` or says "No schema changes, nothing to migrate" |
| 2 | `git status packages/identity/server/migrations` | shows the new `.sql` **and** the updated `migrations/meta/_journal.json` + snapshot |
| 3 | Re-run the identical command | Nx reports a **cache hit** and "existing outputs match the cache"; drizzle-kit is not invoked |
| 4 | Add a column to `packages/identity/server/src/lib/schema/…`, then re-run with the **same** `--name` | the cache is **missed** and a new migration is generated — the declared input `{projectRoot}/src/lib/schema/**/*` covers identity's schema |
| 5 | Repeat step 4 for `@ortha-cms/media-server` (schema at `src/lib/infrastructure/schema/`) | **cache HIT — nothing is generated** → `🐞 BUG-nx-01` |
| 6 | `npx nx run @ortha-cms/media-server:db:generate --name=another_name` | a different `--name` changes the target's options and therefore the hash, so this *does* run — which is what usually masks the bug |
| 7 | `npx nx run @ortha-cms/identity-server:db:generate` (no `--name`) | drizzle-kit picks its own generated name |
| 8 | `npx nx run @ortha-cms/identity-server:db:generate --name='a b; echo hi'` | the name is passed as a single `execFileSync` argv element — **no shell**, so nothing is interpreted (`generate.ts:21-25`) |
| 9 | Stop Postgres entirely, then run any `db:generate` | it still succeeds — generation never connects |
| 10 | Break the schema (a TypeScript syntax error) and re-run | drizzle-kit exits non-zero; `execFileSync` throws; Nx prints a **stack trace**, not a one-line diagnosis (see `🐞 BUG-nx-06`) |

### F3 / F11 / F12 — `db:migrate`

**Preconditions:** `docker compose up -d`, `.env` with a valid `DATABASE_URL`
pointing at a **disposable** database.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx run server:db:migrate` | one `Applying migrations: <plugin> → __drizzle_migrations_<plugin>` line per plugin that ships migrations, then `Migrations complete.` |
| 2 | `psql "$DATABASE_URL" -c "\dt"` | the tables from every plugin, plus one `__drizzle_migrations_*` table per plugin |
| 3 | Re-run the same command | the same log lines print, but no SQL is applied — drizzle's per-plugin journal makes it a **no-op**; the target is `cache: false`, so it genuinely re-runs |
| 4 | `psql "$DATABASE_URL" -c "select count(*) from __drizzle_migrations_identity"` | unchanged between runs |
| 5 | Delete one row from `__drizzle_migrations_media` and re-run | only that one media migration re-applies — and fails if its DDL is not idempotent; a **partially-applied** state is recoverable only per plugin |
| 6 | Introduce a deliberately broken SQL file in the 3rd plugin's `migrations/` and re-run on a fresh DB | plugins 1–2 commit, plugin 3 throws, plugins 4+ never run; the pool is still closed (`apply.ts:41-43`); Nx reports failure with a raw Postgres error and **no "applied 2 of 6" summary** |
| 7 | Re-run after fixing the SQL | it resumes from plugin 3 — the journal makes the loop re-entrant |
| 8 | Comment out every `migrations` descriptor in `apps/server/src/plugins.ts` and run | `No plugin migrations to apply.` and a clean exit; **no pool is even opened** (`apply.ts:18-21`) |
| 9 | `unset DATABASE_URL` (and remove it from `.env`), then run | **not** a clean error — see `🐞 BUG-nx-02` |
| 10 | Reorder `plugins.ts` so `WorkspacesPlugin()` precedes `IdentityPlugin()`, drop the DB, and run | `memberships`' FK to `users` fails: `relation "users" does not exist` → `🐞 BUG-nx-03` |
| 11 | Run two `db:migrate` processes concurrently against a fresh DB | see EC-13 — there is no advisory lock here |
| 12 | Introduce a stage-3-decorator-incompatible construct into a Nest DTO the plugin graph imports | it still loads — swc runs in `legacyDecorator` mode (`jiti.ts:22-30`); this is the whole reason `createTsJiti` exists |

### F4 / F13 / F14 — `db:studio`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx run server:db:studio` | drizzle-kit Studio starts and prints its `https://local.drizzle.studio` URL; it binds `127.0.0.1:4983` by default |
| 2 | Open the printed URL | every applied table is browsable — Studio **introspects** the live DB, so no `schema` is configured |
| 3 | While it runs, `ls $TMPDIR/ortha-studio-*` | one temp dir containing a `drizzle.config.ts` that references `process.env.DATABASE_URL` — **grep it: the URL itself is not in the file** (`studio.ts:41-50`) |
| 4 | Press Ctrl+C | Studio stops. Note the two secondary effects in EC-16: Nx may report the target as **failed**, and the temp dir may be left behind |
| 5 | `npx nx run server:db:studio --port=4990` | Studio listens on 4990 |
| 6 | `npx nx run server:db:studio --port=0` | the flag is **silently dropped** (`if (options.port)` is falsy for 0) and Studio uses 4983 |
| 7 | `npx nx run server:db:studio --host=0.0.0.0` | Studio binds every interface — an unauthenticated, full read/write database browser reachable from the LAN, with no warning printed → `🐞 BUG-nx-05` |
| 8 | `unset DATABASE_URL`, then run | a clean, actionable error: "DATABASE_URL is not set — Drizzle Studio needs a live database connection. Set it in your .env before running db:studio." (`db-studio/executor.ts:40-45`) — **compare step 9 of F3** |
| 9 | Set `DATABASE_URL` to a syntactically valid URL for a database that does not exist | drizzle-kit reports the connection failure; this package adds nothing |

### F5 / F6 / F7 — build, pack, publish targets

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx run @ortha-cms/utils-admin:build` | `tsc --build tsconfig.lib.json --pretty` runs with `cwd=packages/utils/admin`, emitting JS + `.d.ts` into `packages/utils/admin/dist/` and building its project references first (`dependsOn: ['^build']`) |
| 2 | Re-run | a cache hit (`inputs: ['production','^production']`) |
| 3 | `npx nx run @ortha-cms/utils-admin:pack` | `node tools/release/pack.mjs packages/utils/admin` stages `dist/pack/packages/utils/admin/` with a **rewritten** manifest pointing at built output, not `./src/index.ts` |
| 4 | Re-run `pack` | it runs again — `cache: false` deliberately, because it reads `dist/`, which is not one of its declared inputs (`src/index.ts:137-139`) |
| 5 | `npx nx show project @ortha-cms/utils-admin --json \| jq '.targets["nx-release-publish"]'` | `executor: '@ortha-cms/nx:release-publish'`, `options.packageRoot: 'dist/pack/packages/utils/admin'`, and `dependsOn: ['pack']` inherited from `targetDefaults` |
| 6 | Temporarily change **only** `nx.json:96`'s executor to `@nx/js:release-publish`, re-run step 5 | Nx's implicit target wins and `packageRoot` disappears — the release would publish the **source-pointing project root**. Restore it. This is the trap `src/index.ts:146-153` documents |

### F16–F25 — the publish path

**Preconditions:** a clean `main`, `NPM_TOKEN` in `.env`. Use the dry run for
everything except step 8.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npm run release:dry-run` | every package logs `Would publish @ortha-cms/x@V — [dry-run] was set`; **no waiting between packages** (`spacing: () => 0` under dry run) and **no registry probe** |
| 2 | `npx nx run @ortha-cms/nx:nx-release-publish` (if it existed) | it does not — the plugin is private and gets no publish target (F8) |
| 3 | Stage a package whose manifest carries `"private": true` and publish it | `Skipped …, because it is marked private` and `success: true` |
| 4 | Publish a package Nx resolved no new version for | `Skipped …, because no new version was resolved` (`executor:104-107`) |
| 5 | Re-run a **real** publish of a version already on the registry | the probe answers `version-published`, so `Skipped …, because that version is already on the registry` — **and no `PUT` is sent** (`executor:127-132`) |
| 6 | Take the registry offline (block `registry.npmjs.org`) and publish | the probe returns `unknown` and the publish is attempted anyway — a probe that cannot answer never blocks a release (`registry.ts:68-71`) |
| 7 | `ls dist/.release-publish` during a real release | a `lock` file holding the current publisher's pid, and a `last-publish` timestamp |
| 8 | Run a real release and watch the log | packages publish **one at a time**, ~5 s apart; a queued one prints `waiting for another package to finish publishing` |
| 9 | `ORTHA_PUBLISH_DELAY=10000 ORTHA_PUBLISH_RETRIES=8 npm run release` | the gap becomes 10 s and the ladder 9 attempts — env beats the target options (`numeric`, `:265-275`) |
| 10 | `ORTHA_PUBLISH_DELAY=abc npm run release:dry-run` | the value is ignored and the default applies (`Number.parseInt` → NaN) |
| 11 | `ORTHA_PUBLISH_DELAY=-5 npm run release:dry-run` | ignored (`parsed >= 0` fails) |
| 12 | Simulate a 429 on a **new** package name | one attempt only; a multi-line `creationLimitAdvice` explaining that no retry helps and pointing at `npm run release:publish`; `dist/.release-publish/creation-blocked` is written |
| 13 | With that flag present, publish another **new** name | `blocked-by-peer` — it bows out **without spending a request** and names the package that hit the wall first |
| 14 | With that flag present, publish an **existing** name | it publishes normally — `blockedByPeer()` returns null unless `creatingName` (`executor:142-148`) |
| 15 | `rm -rf dist` | the breaker is cleared, as documented (`throttle.ts:172-174`) |

## 4. Edge Cases & Negative Paths

### Target inference and caching

- **EC-01 — A project whose Drizzle schema is not under `src/lib/schema/`.** `❌ NONE`
  Trigger: edit `packages/media/server/src/lib/infrastructure/schema/media-asset.ts`,
  then `nx run @ortha-cms/media-server:db:generate --name=<the same name as last time>`.
  Expected: a fresh migration. Suspected: a **cache hit**, no drizzle-kit run, and
  the previously-cached `migrations/` restored over your working tree. Five of the
  eight `drizzle.config.ts` files in the repo point outside the declared input glob
  → `🐞 BUG-nx-01`.
- **EC-02 — Editing `drizzle.config.ts` itself.** `❌ NONE`
  The config is not in the declared inputs either, so widening a `schema` glob (as
  copilot's `'./src/lib/*/infrastructure/schema/index.ts'` did) does not invalidate
  the cache. Same bug.
- **EC-03 — A cache hit restores `migrations/` as an output.** `❌ NONE`
  `outputs: ['{projectRoot}/migrations']` (`src/index.ts:47`), so a restore replaces
  the whole directory — including `meta/_journal.json`, drizzle's own snapshot,
  which is the *other* real input to generation. A restore can therefore roll a
  developer's in-progress migration back. Same bug; this is the destructive half.
- **EC-04 — `apps/server-e2e`'s `out` is `./migrations/content`, not `./migrations`.** `❌ NONE`
  The inferred output is the parent directory, so it over-captures rather than
  under-captures. Harmless today (`apps/server-e2e/migrations/` contains only
  `content/`), but it would capture any sibling migration set added later.
- **EC-05 — Running an executor outside Nx.** `❌ NONE`
  Nothing here loads `.env`; the documented "needs a `.env` with `DATABASE_URL`"
  is satisfied by **Nx's** dotenv loading. The AGENTS.md rationale for keeping
  logic in `src/lib/` is "lets a standalone CLI reuse it later"; such a CLI would
  have to load the environment itself. Recorded so the assumption is written down.
- **EC-06 — Two plugins infer `build` for the same project.** `❌ NONE`
  `nx.json:29-34` configures `@nx/js/typescript` with a `build` target named
  `build` and `configName: tsconfig.lib.json`; `@ortha-cms/nx` infers its own
  `build` for the same projects. `@ortha-cms/nx` is **last** in the `plugins`
  array (`nx.json:89`), so it wins. The AGENTS.md asserts `@nx/js` "infers no
  `build` here because our manifests point at source" — plausible but **I could
  not verify `@nx/js`'s gating without running it**; the ordering makes the
  outcome correct either way. Recorded, not filed.
- **EC-07 — The workspace-root `package.json`.** `❌ NONE`
  `projectRoot` is `'.'`, which fails `startsWith('packages/')` → `undefined` →
  the node contributes `{}` (`src/index.ts:29-32`). Correct.
- **EC-08 — A malformed `package.json` under `packages/`.** `❌ NONE`
  `JSON.parse` throws, the `catch` returns `undefined`, and the project simply
  gets no targets (`:101-105`). Silent, but the right failure mode for an
  inference pass that must not break the whole graph.
- **EC-09 — A `packages/*` project with a `name` but no `tsconfig.lib.json`.** `❌ NONE`
  No targets at all — not even `build` (`:108-110`). So a package that forgets the
  file is silently unbuildable and **silently unpublishable**, with no diagnostic.
  Worth knowing when adding a package.
- **EC-10 — A nested `package.json` inside a package (e.g. a fixture).** `❌ NONE`
  `projectRoot` would be that nested directory, which still starts with
  `packages/`, so if it has a `name` and a `tsconfig.lib.json` it gets targets on a
  path Nx may not treat as a project. Not reachable in this repo today.

### `db:migrate` — the database URL, ordering and partiality

- **EC-11 — `DATABASE_URL` unset.** `❌ NONE`
  `ortha.config.ts:81` resolves `''`; `db-migrate` does **not** check it (unlike
  `db-studio`, which does at `:40-45`), so `new Pool({ connectionString: '' })`
  falls through to `pg`'s environment defaults — `PGHOST`/`PGUSER`/`PGDATABASE`,
  or localhost + the OS user. Best case ECONNREFUSED with a stack trace; worst
  case a **successful migration of an unintended database** → `🐞 BUG-nx-02`.
- **EC-12 — `DATABASE_URL` pointing at a production database.** `❌ NONE`
  Nothing warns, confirms, or names the target in the output. The log says
  `Applying migrations: identity → __drizzle_migrations_identity` and never says
  *where*. Folded into `🐞 BUG-nx-02`.
- **EC-13 — Two `db:migrate` runs concurrently.** `❌ NONE`
  `applyPluginMigrations` takes no advisory lock. Whether drizzle-orm's
  node-postgres migrator serialises internally is **its** contract, not this
  package's — **Unverified**, and worth pinning, because CI and a developer
  running the same command against a shared database is an ordinary Tuesday.
- **EC-14 — Plugin order drives migration order.** `❌ NONE`
  The loop preserves `buildPlugins()` order (`apply.ts:27`). The host documents the
  constraint — "`WorkspacesPlugin` follows identity (its `memberships` table
  FK-references identity's `users`, so `users` must be migrated first)"
  (`apps/server/src/plugins.ts:26-29`) — but only in a comment, and the loop that
  depends on it lives in another package with no way to read it → `🐞 BUG-nx-03`.
  (The nearby "all modules are global, so DI is order-independent" parenthetical
  at `:37-38` is about `ContentPlugin`'s host-owned tables, not the array as a
  whole — checked, and it is not the contradiction it first looks like.)
- **EC-15 — A migration fails partway through the plugin list.** `❌ NONE`
  Earlier plugins are committed, later ones never attempted, the pool is closed by
  the `finally`, and the executor rejects. Re-running resumes correctly. The
  **property is good**; the reporting is not — there is no "applied N of M" line
  and no indication which plugins already landed.
- **EC-16 — Ctrl+C during `db:studio`.** `❌ NONE`
  `execFileSync` throws when the child is terminated by a signal, so the executor
  rejects and Nx marks the target **failed** for what is the documented way to stop
  it ("runs in the foreground until interrupted (Ctrl+C)", `studio.ts:29`). SIGINT
  also reaches the parent, so the `finally { rmSync }` (`:65-67`) may not run and
  the temp dir leaks. The leaked file contains no secret (only
  `process.env.DATABASE_URL`), so this is untidiness, not exposure. Folded into
  `🐞 BUG-nx-06`.
- **EC-17 — 🔒 `--host=0.0.0.0` on `db:studio`.** `❌ NONE`
  Accepted verbatim (`studio.ts:53-55`); the schema describes `host` neutrally
  (`db-studio/schema.json:12-15`). Studio is an unauthenticated full read/write
  database browser → `🐞 BUG-nx-05`.
- **EC-18 — `--port=0` on `db:studio`.** `❌ NONE`
  Silently ignored (`if (options.port)`), so an operator asking for an ephemeral
  port gets 4983. Cosmetic.
- **EC-19 — A non-numeric `--port`.** `❌ NONE`
  `schema.json` declares `"type": "number"`, so Nx's option validation rejects it
  before the executor runs. Cleared.
- **EC-20 — A hostile `--name` on `db:generate`.** `❌ NONE`
  `execFileSync(process.execPath, args)` with an argv array and **no shell**
  (`generate.ts:25`), so `; rm -rf /` is a literal migration name. Same for
  `--host`/`--port` on studio and every `npm publish` flag. **Checked and cleared
  across all four executors** — nothing in this package builds a shell string.
- **EC-21 — `db:generate` in CI where drizzle-kit prompts.** `❌ NONE`
  `stdio: 'inherit'` (`generate.ts:25`) means drizzle-kit's interactive
  rename-vs-drop prompt reaches the terminal. Interactively that is right; on a
  non-TTY CI runner the behaviour is drizzle-kit's to define, and nothing here
  passes a non-interactive flag or a timeout. Unverified, and a plausible way for
  a CI job to hang.
- **EC-22 — `db:generate` when there are no schema changes.** `❌ NONE`
  drizzle-kit prints "No schema changes, nothing to migrate" and exits **0**, so
  the executor returns `success: true` and Nx shows green. A developer who ran the
  command *because* they changed the schema gets a green tick and no file. Benign
  alone; compounding with `🐞 BUG-nx-01`, it is how a schema/migration drift
  (`.cursor/BUGBOT.md`, "Schema/migration drift") ships unnoticed.

### The publish slot, breaker and retry ladder

- **EC-23 — A publish that outlives `staleAfter`.** `❌ NONE`
  `DEFAULT_STALE_AFTER = 15 * 60_000` (`throttle.ts:34`), and the lock's mtime is
  written once at acquisition and never refreshed. The executor's own default
  ladder sleeps 30+60+120+240+300 s = **12.5 minutes** before the sixth attempt,
  plus six upload attempts. A peer then finds the lock "stale", steals it, and two
  publishes run at once — defeating the serialisation the whole file exists for →
  `🐞 BUG-nx-04`.
- **EC-24 — The lock is read between `open('wx')` and the pid write.** `❌ NONE`
  The window leaves an empty file; `holderIsAlive` parses `''` → NaN → returns
  `true` ("treated as alive"), so the reader waits rather than stealing
  (`throttle.ts:124-143`). **Checked and cleared** — the comment at `:118-123`
  names this case exactly.
- **EC-25 — pid reuse.** `❌ NONE`
  `process.kill(pid, 0)` can report a recycled pid as alive; the age check is the
  documented backstop (`:104`). Acceptable.
- **EC-26 — `EPERM` from `process.kill`.** `❌ NONE`
  Treated as alive; only `ESRCH` proves absence (`:139-141`). Correct.
- **EC-27 — A crashed publisher leaves a lock.** `❌ NONE`
  The next acquirer finds the pid dead and steals immediately rather than waiting
  15 minutes (`:104-107`). Correct, and the reason the pid check exists.
- **EC-28 — Two releases from different machines on a shared filesystem.** `❌ NONE`
  `open(…, 'wx')` is not atomic on NFS. Not a scenario this workspace has; noted so
  nobody assumes otherwise.
- **EC-29 — `spacing` evaluated inside the slot.** `❌ NONE`
  `spacing` is a **function** called after the lock is held (`throttle.ts:63`), so a
  package that has since learned it is blocked by a peer does not sit out the gap
  first. Deliberate and correct (`:22-26`).
- **EC-30 — `ORTHA_PUBLISH_DELAY=0`.** `❌ NONE`
  `0` is finite and `>= 0`, so it wins and disables the gap entirely. Undocumented
  but coherent.
- **EC-31 — `retryableReason` matches the bare substring `network`.** `❌ NONE`
  `publish.ts:193` — any npm output containing "network" anywhere becomes
  retryable. The other clauses are anchored (`\be50[0-9]\b`, explicit error codes);
  this one is not. No `@ortha-cms/*` name or dependency contains it, so it is not
  reachable here. Recorded, not filed.
- **EC-32 — `isAlreadyPublished` false positives.** `❌ NONE`
  Three narrow phrases, all npm's own wording (`:142-152`). Cleared.
- **EC-33 — `formatNpmError` on mixed stdout/stderr.** `❌ NONE`
  Slices from the first `{` to the last `}` and `JSON.parse`s it; a slice spanning
  two documents fails the parse and falls back to the raw output (`:206-225`).
  Cleared.
- **EC-34 — A scoped name in the probe URL.** `❌ NONE`
  `name.replace('/', '%2f')` replaces only the first occurrence, which is exactly
  right for `@scope/name` (`registry.ts:44`). Cleared.
- **EC-35 — The probe on a 5xx or a private registry needing auth.** `❌ NONE`
  Anything that is not 404 and not `ok` collapses to `'unknown'` → publish anyway.
  Correct: a probe must never be why a release fails.
- **EC-36 — 🔒 `--otp` on the process table.** `❌ NONE`
  Passed as a CLI argument (`publish.ts:107`), so it is visible in `ps` for the
  lifetime of the child. An OTP is single-use and short-lived, so the exposure is
  minimal — but a `--registry` carrying credentials would leak the same way.
  Recorded.
- **EC-37 — `packageRoot` missing because `pack` did not run.** `❌ NONE`
  `readFileSync(join(packageRoot,'package.json'))` throws ENOENT and the executor
  rejects with a raw fs error rather than "run `pack` first"
  (`release-publish/executor.ts:91-93`). `dependsOn: ['pack']` in `targetDefaults`
  normally prevents it; a hand-run `nx run x:nx-release-publish --skip-nx-cache`
  after `rm -rf dist` reproduces it.
- **EC-38 — `NX_DRY_RUN=true` vs `--dry-run`.** `❌ NONE`
  Either enables dry run (`:109`), which then skips the probe, the spacing and the
  breaker. Consistent.

### 4A. Accessibility & Section 508 Conformance

**Applicability first, because most of it does not apply.** `@ortha-cms/nx`
renders no user interface, produces no electronic content, and is `private`
developer tooling that ships to nobody. WCAG 2.1 is scoped to web content, so
**every perceivable/operable success criterion in the §4A checklist — 1.1.1,
1.3.x, 1.4.x, 2.1.x, 2.4.x, 3.x, 4.1.x — is Not Applicable to this unit.** Revised
508's Chapter 5 (Software, 502/503) governs software offered as an ICT product; a
build-time Nx plugin in a monorepo is not procured, installed or operated as one.
**504 (Authoring Tools) is likewise Not Applicable** — this package authors no
content and ships no template; the authoring-tool provisions bite on
`content/admin`, `wysiwyg-admin` and `media-admin` instead.

What *is* worth testing is the one thing this unit genuinely produces for a human:
**terminal output**, consumed by an operator who may be using a screen reader, a
braille display, a high-contrast terminal, or a CI log viewer. The findings below
cover only that, and are deliberately few.

#### ♿ A11Y-nx-01 — Every status this package prints is carried by words, not colour
**WCAG:** 1.4.1 Use of Colour (A) — by analogy · **508:** 503 (analogous) · **Verdict: Supports**
**Location:** `packages/nx/src/lib/drizzle/apply.ts:32-40`; `packages/nx/src/executors/release-publish/executor.ts:98, 105, 128, 204-236`
This package emits **no ANSI escapes at all**. Outcomes are distinguished by the
words `Applying migrations:` / `Migrations complete.` / `Published` / `Skipped` /
`Failed to publish` / `Would publish`, and by the stream (`console.log` vs
`console.warn` vs `console.error`). Strip all colour — `NO_COLOR=1`, a braille
display, a plain CI log — and every outcome is still unambiguous. Recorded as a
positive so a future "let's add chalk" change is a deliberate regression rather
than an accident. (The colour that *does* appear comes from Nx's TUI and from
drizzle-kit's own output, neither of which this unit controls.)

#### ♿ A11Y-nx-02 — Failures are unstructured stack traces with no machine-readable form
**WCAG:** 3.3.1 Error Identification (A) — by analogy · **508:** 503 (analogous) · **Verdict: Partially Supports**
**Location:** `packages/nx/src/executors/db-generate/executor.ts:25` and `packages/nx/src/executors/db-migrate/executor.ts:43` (neither wraps its call); contrast `packages/nx/src/executors/db-studio/executor.ts:40-45`
`db:studio` gets this right — a missing URL produces one sentence naming the
variable and the file to set it in. Its two siblings do not: a drizzle-kit
non-zero exit surfaces as an `execFileSync` `Error` with the full argv in the
message, and a failed migration surfaces as a raw Postgres error, both printed by
Nx as a multi-frame stack. There is no exit-code taxonomy beyond 0/1 and no
`--json` output, so a CI system cannot distinguish "could not reach the database"
from "a migration file is invalid" without parsing English.
**What the operator experiences:** a screen-reader or braille user reading a
20-line stack has to find the one relevant line in it; a log-viewer user gets the
same. `release-publish` shows the better pattern — `formatNpmError`
(`publish.ts:206-225`) extracts npm's `code`/`summary`/`detail` into three lines.
**Remediation:** wrap the `db-generate` and `db-migrate` calls the way
`db-studio` guards its URL, and print an "applied N of M plugins" summary before
rethrowing (see `🐞 BUG-nx-06`).

#### ♿ A11Y-nx-03 — Third-party interactive prompts and animations pass through unmediated, with no non-interactive mode
**WCAG:** 2.2.1 Timing Adjustable (A), 3.2.2 On Input (A) — by analogy · **508:** 503.2 (platform preferences) · **Verdict: Partially Supports**
**Location:** `packages/nx/src/lib/drizzle/generate.ts:25` and `packages/nx/src/lib/drizzle/studio.ts:61-64` (`stdio: 'inherit'`)
Inheriting stdio hands drizzle-kit the terminal directly. That brings in its
spinner animation and, on an ambiguous diff, its arrow-key
"is this column renamed or created?" prompt — a control that exists only as a
redrawn line of text, is not announced as a form control, and has no timeout. This
package offers no flag to force a non-interactive run and no way to answer such a
prompt from arguments, so a user who cannot operate an inline selector cannot
complete `db:generate` for a rename.
**Remediation:** not this unit's to fix in full (the prompt is drizzle-kit's), but
a documented non-interactive path — or at minimum a note in AGENTS.md that a
rename requires an interactive terminal — would close the gap. See also EC-21,
where the same behaviour is a CI-hang risk.

#### ♿ A11Y-nx-04 — Web-content and authoring-tool provisions
**WCAG:** all perceivable/operable/understandable/robust SC · **508:** E205.4, 502, 503.4, 504 · **Verdict: Not Applicable**
No UI, no electronic content, no media, no author-facing editor, no shipped
template. Recorded explicitly rather than omitted, so a reviewer can see the
determination was made rather than skipped.

## 5. E2E Coverage Map

**There is no automated coverage of this package of any kind.**
`find packages/nx -name "*.spec.ts"` returns nothing; no file under
`apps/admin-e2e/src/**` or `apps/server-e2e/src/**` imports `@ortha-cms/nx`
(`grep -rn "@ortha-cms/nx" apps` matches only prose in `apps/server/drizzle.config.ts:6`
and `apps/server-e2e/drizzle.config.ts:11`); and neither harness is capable of
driving it — `apps/admin-e2e` is Playwright against the SPA and `apps/server-e2e`
is supertest against a booted Nest app. The whole table below is therefore ❌, and
that is the finding, not an omission.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1–F8 target inference | — | — | ❌ NONE — nothing snapshots the inferred target graph, so a change to `src/index.ts` is caught only when a human notices a target missing |
| F9–F10 `db:generate` | — | — | ❌ NONE |
| F11 `db:migrate` executor | — | — | ❌ NONE |
| F12 `applyPluginMigrations` | `apps/server-e2e/src/support/global-setup.ts:45-62` | a **structurally identical re-implementation** of the same loop (the log strings differ, and it has neither the empty-list early return nor the `Migrations complete.` line) — `new Pool` → `drizzle` → `for (plugin of plugins) migrate(db, { migrationsFolder: plugin.migrations.dir(), migrationsTable: plugin.migrations.table })` → `finally pool.end()` — whose own comment says it applies migrations "exactly as `server:db:migrate` does" | ❌ NONE — the copy is exercised by every server e2e run; **the production function is not imported and not covered** → `🐞 BUG-nx-07` |
| F13–F14 `db:studio` | — | — | ❌ NONE |
| F15 `createTsJiti` | — | — | ❌ NONE — the legacy-decorator behaviour it exists for is verified only by `db:migrate` not crashing when a human runs it |
| F16–F25 the publish path | — | — | ❌ NONE — `npm run release:dry-run` is the only rehearsal, and it deliberately skips the probe, the spacing and the breaker (`executor:118, 156-163`), i.e. **every mechanism worth testing** |
| F26 `executors.json` | — | — | ❌ NONE |

**Coverage tally:** `26 features · 0 ✅ · 0 ⚠️ · 26 ❌`

**Nearest indirect signal:** the Release GitHub Actions workflow and
`npm run release` exercise F5–F7 and F16–F25 in anger, once per release; every
`npm run dev` and `nx run-many -t build` exercises F5. Neither asserts anything.

## 6. 🐞 Potential Bugs

### 🐞 BUG-nx-01 — `db:generate`'s cache inputs name a directory five of the eight schema-owning projects do not use, so a schema edit does not invalidate the cache · Severity: High

**Location:** `packages/nx/src/index.ts:37-49`
**Category:** correctness / data-integrity (schema drift)

> **Each link verified separately, and the table below is exhaustive rather than
> sampled** — every `drizzle.config.ts` in the repository was opened and its
> `schema` field read (`find . -name drizzle.config.ts -not -path '*/node_modules/*'`
> returns exactly the eight rows listed). Confirmed from source: the input glob is a
> single hardcoded literal applied to every drizzle project (`src/index.ts:46`); five
> of the eight configs point their `schema` outside `src/lib/schema/`; and
> `migrations/` is a declared **output** (`:47`).
> **Unverified —** two links are documented Nx semantics rather than things this
> checkout could execute (`node_modules` is absent): that a target's explicit
> `inputs` *replace* rather than extend the `default` named input, and that a cache
> hit *restores declared outputs over the working tree*. The first is what makes the
> hash blind to the schema; the second is what turns a stale hit from "did nothing"
> into "overwrote your migration". The severity would survive losing the second: a
> silent no-op on the command `.cursor/BUGBOT.md` tells you to run after every schema
> edit is already High.

**What the code does:**
```typescript
'db:generate': {
    executor: '@ortha-cms/nx:db-generate',
    options: { cwd: projectRoot, config: 'drizzle.config.ts' },
    cache: true,
    inputs: ['{projectRoot}/src/lib/schema/**/*'],
    outputs: ['{projectRoot}/migrations']
}
```
The input glob is a single hardcoded path, applied to **every** project that has
a `drizzle.config.ts`. Declaring `inputs` explicitly **replaces** Nx's default
`{projectRoot}/**/*`, so nothing else about the project contributes to the hash.

**Why it is wrong:** the actual `schema` each config points at is not that path
for most projects. Every `drizzle.config.ts` in the repo, read:

| Project | `schema` in its `drizzle.config.ts` | Covered by `src/lib/schema/**/*`? |
| --- | --- | --- |
| `packages/identity/server` | `./src/lib/schema/index.ts` | ✅ |
| `packages/database` | `./src/lib/schema/index.ts` | ✅ |
| `packages/activity/server` | `./src/lib/schema/index.ts` | ✅ |
| `packages/workspaces/server` | `./src/lib/workspace/infrastructure/schema/index.ts` | ❌ |
| `packages/media/server` | `./src/lib/infrastructure/schema/index.ts` | ❌ |
| `packages/copilot/server` | `./src/lib/*/infrastructure/schema/index.ts` | ❌ |
| `apps/server` | `./src/content/index.ts` | ❌ |
| `apps/server-e2e` | `./src/support/content/index.ts` | ❌ |

The three that match are the three that predate the ADR-0003 layered layout; the
five that do not are exactly the ones that adopted it. For those five, the
declared input glob matches **no files at all**, so the task's hash depends on
nothing but the target's own options and Nx's runtime inputs — and the
`migrations/` directory is a declared **output**, so a hit does not merely skip
the work, it **restores the cached directory over the working tree**, including
drizzle's `meta/_journal.json` snapshot.

`.cursor/BUGBOT.md` names the invariant this defeats: "**Schema/migration
drift.** After editing a plugin's Drizzle schema, generate its migration
(`nx run <plugin>:db:generate`) and commit the SQL." The command that instruction
tells you to run is the one that can silently do nothing.

**Repro:**
1. `npx nx run @ortha-cms/media-server:db:generate --name=qa_one` → a migration is
   emitted (first run, cold cache).
2. Realise the schema was wrong. Edit
   `packages/media/server/src/lib/infrastructure/schema/media-asset.ts`.
3. `npx nx run @ortha-cms/media-server:db:generate --name=qa_one` (same name).
→ Observed: Nx reports the task as cached; drizzle-kit is never invoked; no new
SQL is written; and the cached `migrations/` is restored, discarding the file
from step 1 if you had edited it. → Expected: a cache miss and a regenerated
migration.
4. Contrast: `npx nx run @ortha-cms/identity-server:db:generate --name=qa_one`
after editing identity's schema **does** miss the cache — the glob covers it.

**Why it has not bitten yet:** the usual workflow passes a *new* `--name` each
time, and the option is part of the hash, so the common path accidentally busts
the cache. The bug shows up on the iterate-on-one-migration loop, which is the
normal way anyone actually writes a migration.

**Blast radius:** the five layered plugins — including `media`, `copilot` and
both content-owning apps. The failure is silent and green: a developer commits a
schema change with no migration, CI passes (nothing generates migrations in CI),
and the drift surfaces at runtime as a query against a column that does not exist.

**Suggested fix:** derive the inputs from the project rather than hardcoding
them — at minimum include `{projectRoot}/drizzle.config.ts` and
`{projectRoot}/src/**/schema/**/*`, or read the `schema` field out of the config
during inference. Failing that, set `cache: false` on `db:generate`: it is a
manual, once-per-change command whose cost is a second, and a wrong cache here is
far more expensive than a cold run.

---

### 🐞 BUG-nx-02 — `db:migrate` never checks that a database URL was resolved, so a missing `DATABASE_URL` silently targets `pg`'s default connection · Severity: Medium

**Location:** `packages/nx/src/executors/db-migrate/executor.ts:27-46`; `packages/nx/src/lib/drizzle/apply.ts:23`; `apps/server/ortha.config.ts:80-82`
**Category:** correctness (operational safety)

> **Verified:** the missing guard, the `?? ''` fallback and the asymmetry with `db:studio` are all
> confirmed from source (both executors read below). **Downgraded from High 🔒** on verification:
> the operation is CREATE-heavy DDL into an unintended database, which pollutes rather than
> destroys, it is reachable only on a developer machine (this target exists in no deployed
> host), and it is neither an auth/authz nor a data-leak concern, so the 🔒 marker does not
> apply. **Unverified —** `pg`'s exact behaviour for `connectionString: ''` could not be executed
> here (`node_modules` is absent in this checkout); the claim below rests on reading `pg`'s
> documented `ConnectionParameters` fallback order, not on a run.

**What the code does:**
```typescript
const config = configModule.default;
…
const plugins = pluginsModule.buildPlugins(config);
await applyPluginMigrations(plugins, config.database.url);
```
and, inside:
```typescript
const pool = new Pool({ connectionString: databaseUrl });
```
There is no guard between them. The host resolves the URL as
`process.env['DATABASE_URL'] ?? ''` (`ortha.config.ts:81`), so with the variable
unset the value handed to `pg` is the **empty string**. `pg` treats a falsy
`connectionString` as absent and falls back to its environment defaults:
`PGHOST` (default `localhost`), `PGPORT` (5432), `PGUSER` (the OS user),
`PGDATABASE` (defaults to the user name), and `PGPASSWORD`/`~/.pgpass`.

**Why it is wrong:** the sibling executor in the next directory does exactly the
check that is missing here:
```typescript
const url = configModule.default.database?.url;
if (!url) {
    throw new Error(
        'DATABASE_URL is not set — Drizzle Studio needs a live database ' +
            'connection. Set it in your .env before running db:studio.'
    );
}
```
(`db-studio/executor.ts:38-45`). `db:studio` only *reads*; `db:migrate` runs DDL.
The one that mutates is the one without the guard.

Two outcomes, both bad:
- **No Postgres listening on localhost** → `ECONNREFUSED` surfaced as a raw stack
  trace, with no mention of `DATABASE_URL`. Merely unhelpful.
- **A Postgres reachable at libpq's defaults** — a `docker compose up -d` on the
  default port, a Homebrew/`apt` local server, or a shell where `PGHOST`/
  `PGDATABASE` are exported for another project — → every plugin's DDL is applied
  to **whatever database that resolves to**, and the run prints
  `Migrations complete.` The log never names the target: `applyPluginMigrations`
  logs the plugin and the tracking table (`apply.ts:32-34`) and nothing else.

**Repro:**
1. `unset DATABASE_URL` and remove it from `.env`.
2. `export PGDATABASE=some_other_project` (or simply have a local Postgres whose
   default database matches your username).
3. `npx nx run server:db:migrate`.
→ Observed: `Applying migrations: database → __drizzle_migrations_database` … and
`Migrations complete.` — against `some_other_project`. `psql some_other_project -c
'\dt'` now shows `users`, `workspaces`, `outbox_events`, `media_asset`, and eight
`__drizzle_migrations_*` tables.
→ Expected: the same actionable refusal `db:studio` gives.

**Blast radius:** any developer or CI job whose environment is not what they
assume. The operation is `CREATE`-heavy DDL against an unintended database: it
adds this repo's tables and eight `__drizzle_migrations_*` journals to whatever
`pg` resolved to. That is pollution a `DROP` can undo, not destruction — which is
why this is Medium and not High. It is mitigated in practice by the convention
that `.env` always exists, and by `db:migrate` being a developer-machine target
that no deployed host runs.

**Suggested fix:** hoist `db:studio`'s guard into a shared helper both executors
call (the config-loading is already shared via `createTsJiti`), and have
`applyPluginMigrations` refuse an empty/blank URL outright. Additionally, log the
resolved target — host, port and database name, never the password — before the
first `migrate()` call, so the output answers "where did this go?".

---

### 🐞 BUG-nx-03 — Migration order is taken from the host's plugin array with no way to declare a migration dependency · Severity: Low

**Location:** `packages/nx/src/lib/drizzle/apply.ts:16, 27-39`; the order it consumes is `apps/server/src/plugins.ts:54-60`
**Category:** correctness (ordering invariant)

> **Corrected on verification.** The original filing claimed the host's comment
> "says the order does not matter", contradicting itself. It does not: the comment
> block opens `Order matters: DatabasePlugin must come first…` and states the
> identity→workspaces FK constraint explicitly (`apps/server/src/plugins.ts:26-29`).
> The `all modules are global, so DI is order-independent` parenthetical
> (`:37-38`) is scoped to `ContentPlugin`'s host-owned collection tables, not to
> the array as a whole. With the "contradiction" removed, what remains is a real
> but much smaller finding — the constraint is prose-only and undeclarable — so
> the severity drops from Medium to Low.

**What the code does:**
```typescript
const withMigrations = plugins.filter((plugin) => plugin.migrations);
…
for (const plugin of withMigrations) {
    …
    await migrate(db, { migrationsFolder: migrations.dir(), migrationsTable: migrations.table });
}
```
Sequential, in array order, with no declared dependency between plugins and no
sort.

**Why it is wrong:** the ordering constraint is real and is stated only as prose,
in a different package from the loop that depends on it. The host's comment says
"`WorkspacesPlugin` follows identity (its `memberships` table FK-references
identity's `users`, so `users` must be migrated first)"
(`apps/server/src/plugins.ts:26-29`), and `workspaces-server`'s own
`drizzle.config.ts` repeats it: "the generated SQL references `users(id)` without
creating it (identity owns and migrates that table, **applied first by the host's
db:migrate**)".

So a real ordering constraint lives in comments, and is consumed by a loop in a
different package that knows nothing about it. A `ServerPlugin` has a `migrations`
descriptor with a `dir` and a `table` (per the `server-plugin` skill) and **no way
to declare that its migrations depend on another plugin's**. Nothing detects a bad
order until Postgres raises `relation "users" does not exist` on a fresh database — and on an
already-migrated database it does not fail at all, so the mistake ships and only
bites the next person who provisions from scratch.

**Repro:**
1. In `apps/server/src/plugins.ts`, swap `IdentityPlugin(...)` and
   `WorkspacesPlugin()` in the returned array.
2. Drop and recreate the database, then `npx nx run server:db:migrate`.
→ Observed: `Applying migrations: database …`, `Applying migrations: workspaces
…`, then a Postgres error that `users` does not exist. Nothing beforehand warns
that the reorder was unsafe, and the DI behaviour is genuinely unaffected — which
is exactly why the mistake is easy to make.
→ Expected: either the loop orders by declared dependencies, or the reorder is
rejected with a message naming the constraint.

**Blast radius:** anyone editing `plugins.ts` — the file every new plugin is
registered in. Recoverable (fix the order, re-run) and warned about in the file's
own comment, which is why this is Low; the cost is that the warning is prose a
loop in another package cannot read.

**Suggested fix:** let a `migrations` descriptor declare `after: string[]` (plugin
names) and topologically sort `withMigrations` in `applyPluginMigrations`;
alternatively, sort by an explicit numeric ordinal on the descriptor. Either way
the constraint moves out of prose and into the data the loop already reads.

---

### 🐞 BUG-nx-04 — The publish lock's staleness window is shorter than the executor's own worst-case retry ladder, so a retrying publish gets its slot stolen · Severity: Medium

**Location:** `packages/nx/src/lib/release/throttle.ts:34, 88-116, 145-152`; the ladder at `packages/nx/src/executors/release-publish/executor.ts:49-54` and `packages/nx/src/lib/release/publish.ts:87-93`
**Category:** race

**What the code does:**
```typescript
const DEFAULT_STALE_AFTER = 15 * 60_000;   // throttle.ts:34
…
if (!holderIsAlive(lockFile) || age(lockFile) > staleAfter) {
    rmSync(lockFile, { force: true });
    continue;
}
…
function age(file: string): number {
    return Date.now() - statSync(file).mtimeMs;
}
```
The lock's mtime is set once — `writeFileSync(lockFile, pid)` at acquisition
(`:98`) — and **never refreshed** while the holder works. `withPublishSlot` holds
the lock across the spacing wait *and* the entire `publish()` call (`:62-75`), and
that call is `publishWithRetry`, whose defaults are `retries: 5`,
`retryBackoff: 30_000`, `maxRetryBackoff: 300_000`.

**Why it is wrong:** the two numbers are set in different files and do not agree.
The default ladder sleeps `30 + 60 + 120 + 240 + 300 = 750 s` — **12 minutes 30
seconds** — before the sixth and final attempt, before counting the six `npm
publish` uploads themselves. A rate-limited registry is precisely the condition
that both (a) triggers the full ladder and (b) makes each upload slow. So the
worst case the retry design explicitly plans for is also the case that exceeds the
15-minute steal threshold, and the holder is still alive the whole time — the pid
check passes, so only the age check fires.

Once stolen, two `npm publish` processes run concurrently against the same
account, which is exactly the burst the throttle exists to prevent; and the
original holder's `finally` will later `rmSync` a lock it no longer owns
(`:72-75`), releasing the thief's slot and potentially cascading to a third.
Raising `ORTHA_PUBLISH_RETRIES` — the documented remedy for a stricter CI limit
(`executor:66-68`) — makes it strictly worse: at `retries: 8` the ladder alone is
`30+60+120+240+300+300+300+300 = 1650 s`, 27 minutes.

**Repro (deterministic, without npm):** call `withPublishSlot` with a `publish`
that sleeps 16 minutes, and from a second process call `withPublishSlot` on the
same directory. → Observed: the second process steals the lock at the 15-minute
mark while the first is still inside `publish()`. → Expected: it keeps waiting
while the holder is demonstrably alive.

**Blast radius:** a release that is already being rate-limited — i.e. the exact
run this machinery exists to rescue. It does not corrupt anything (npm rejects a
duplicate version with `EPUBLISHCONFLICT`, which the executor treats as success),
but it removes the serialisation just when it matters.

**Suggested fix:** refresh the lock's mtime periodically while it is held (a
heartbeat, or a `utimesSync` before each retry sleep), and/or derive
`staleAfter` from the configured ladder rather than a fixed constant so the two
cannot drift apart. The pid liveness check already handles the crash case, which
is what `staleAfter` was really for.

---

### 🐞 BUG-nx-05 — `db:studio` accepts any `--host`, so one flag exposes an unauthenticated full-access database browser to the network · Severity: Medium · 🔒

**Location:** `packages/nx/src/lib/drizzle/studio.ts:52-58`; `packages/nx/src/executors/db-studio/schema.json:12-15`; documented at `packages/nx/AGENTS.md:102-103` and the root `AGENTS.md:162`
**Category:** permission-bypass (exposure)

> **Unverified —** the half of this finding that sets its severity, that Drizzle
> Studio's local gateway performs **no authentication of its own**, is a property of
> `drizzle-kit` and cannot be confirmed from this repository (`node_modules` is
> absent here and no drizzle-kit source is vendored). What *is* confirmed from
> source is everything this package controls: `--host` is forwarded verbatim with
> no allowlist, no default, and no warning (`studio.ts:52-58`), and both AGENTS.md
> files describe it as a plain convenience. If Studio does authenticate, this drops
> to a documentation gap.

**What the code does:**
```typescript
const args = [bin, 'studio', `--config=${configPath}`];
if (options.host) {
    args.push(`--host=${options.host}`);
}
```
The value is forwarded verbatim, with no allowlist, no warning, and no default
stated in the executor (drizzle-kit's own default, `127.0.0.1`, is mentioned only
in the schema's description).

**Why it is wrong:** Drizzle Studio is a full read/write database browser with
**no authentication of its own** — it serves a local gateway that
`local.drizzle.studio` connects to, and anything that can reach the port can
read and modify every table. The executor has already gone to real trouble to
protect the credential (an ephemeral config, the URL passed only through the
child's env, never written to disk — `studio.ts:14-29, 41-50`), which shows the
threat model was considered; the network surface was not. Both AGENTS.md files
document `--host` as a plain convenience ("optional `--host` / `--port` to change
where Studio binds") with no caveat.

**Repro:**
1. `npx nx run server:db:studio --host=0.0.0.0`
2. From another machine on the same network: `curl http://<dev-machine>:4983/`
→ Observed: Studio's gateway answers; the development database — including the
`users` table with its password hashes and the `sessions` table — is reachable by
anyone on the LAN, coffee-shop Wi-Fi included. Nothing in the output says the bind
address changed from loopback.
→ Expected: at minimum a printed warning naming the exposure; ideally a refusal
unless an explicit `--allow-remote`-style opt-in accompanies a non-loopback host.

**Blast radius:** developer machines only (this target does not exist in
production), but the credential-hygiene work elsewhere in the same file sets an
expectation this undercuts. Low likelihood, high impact.

**Suggested fix:** default and document `127.0.0.1`; when `host` is anything else,
print a prominent warning naming the exposure, and consider requiring a second
flag. Passing the port through is fine as-is.

---

### 🐞 BUG-nx-06 — Two of the three DB executors surface raw exceptions, and `db:studio` reports its documented exit as a failure · Severity: Low

**Location:** `packages/nx/src/executors/db-generate/executor.ts:24-26`; `packages/nx/src/executors/db-migrate/executor.ts:42-45`; `packages/nx/src/lib/drizzle/apply.ts:27-43`; `packages/nx/src/lib/drizzle/studio.ts:60-67`
**Category:** ux-state (operator legibility)

> **Unverified —** the Ctrl+C half. That `execFileSync` throws on a
> signal-terminated child is documented Node behaviour, but whether Nx ends up
> printing the target as *failed* depends on whether the SIGINT that reaches the
> parent kills it first, and that could not be executed here. The unwrapped-error
> half (`db-generate`, `db-migrate`) and the missing `finally` guarantee are
> confirmed from source.

**What the code does:** `db-generate` calls `runDrizzleKitGenerate` unwrapped, so
a non-zero drizzle-kit exit throws an `execFileSync` `Error` whose message is the
full command line. `db-migrate` calls `applyPluginMigrations` unwrapped, so a bad
migration surfaces as a raw Postgres error — after a sequence of
`Applying migrations: <plugin> → <table>` lines with **no closing summary**, so
the operator must count log lines to learn how many plugins committed before the
failure. And `runDrizzleKitStudio` runs `execFileSync` in the foreground; a
signal-terminated child makes `execFileSync` throw, so **Ctrl+C — the documented
way to stop Studio (`studio.ts:29`) — makes Nx print the target as failed**, and
because SIGINT also reaches the parent, the `finally { rmSync(dir) }` at `:65-67`
may never run, leaving an `ortha-studio-*` directory in `$TMPDIR`.

**Why it is wrong:** the third executor in the same folder demonstrates the
standard — `db-studio`'s missing-URL error is one sentence naming the variable and
the file to set it in (`db-studio/executor.ts:40-45`), and `release-publish`'s
`formatNpmError` (`publish.ts:206-225`) reduces npm's JSON blob to
code/summary/detail. The DB path does neither, and it is the path a developer
touches most often.

**Repro:**
1. Break a schema file and run `db:generate` → a stack trace whose first useful
   line is drizzle-kit's, several frames down.
2. Put invalid SQL in the third plugin's `migrations/` and run `db:migrate` on a
   fresh database → three `Applying migrations:` lines, then a Postgres error, and
   nothing stating that plugins 1–2 committed and 4–6 never ran.
3. `npx nx run server:db:studio`, then Ctrl+C → Nx reports the target failed;
   `ls $TMPDIR/ortha-studio-*` may still list a directory.
→ Expected: a one-line diagnosis for (1) and (2) plus an "applied N of M" summary,
and a clean exit for (3).

**Blast radius:** friction only, on the commands developers run daily. No data
risk; the leaked temp file contains no secret.

**Suggested fix:** wrap both calls and rethrow with a short, actionable message
(keeping the original as `cause`); print `Applied N of M plugin migration sets`
in `applyPluginMigrations`'s `finally`; and in `runDrizzleKitStudio` treat a
`SIGINT`/`SIGTERM` termination as a normal exit and register a signal handler so
the temp directory is removed.

---

### 🐞 BUG-nx-07 — The migration apply loop is re-implemented in the e2e harness under a comment asserting equivalence, so the shipped function has no coverage and the two can drift · Severity: Low

**Location:** `packages/nx/src/lib/drizzle/apply.ts:12-44` vs `apps/server-e2e/src/support/global-setup.ts:45-62`
**Category:** correctness (duplication) / test-coverage

**What the code does:** `global-setup.ts` re-implements the loop step for step —
`new Pool({ connectionString })`, `drizzle(pool)`, `for (const plugin of plugins)
{ if (!plugin.migrations) continue; migrate(db, { migrationsFolder:
plugin.migrations.dir(), migrationsTable: plugin.migrations.table }) }`,
`finally { await pool.end() }` — under a comment stating it applies each plugin's
descriptor "**exactly as `server:db:migrate` does**, so the schema under test is
the real shipped schema for every plugin".

**Why it is wrong:** the claim is a promise the code cannot keep, because nothing
enforces it. `@ortha-cms/nx`'s AGENTS.md gives the rationale for keeping this
logic in `src/lib/` as plain functions: "This keeps the logic testable without Nx
and lets a standalone CLI reuse it later." The one consumer in the repo that
could reuse it — a harness whose whole purpose is to reproduce production
behaviour — does not. Two consequences: `applyPluginMigrations` has **zero**
coverage, direct or indirect (§5), and any change to it (an advisory lock for
EC-13, an ordering fix for `🐞 BUG-nx-03`, the "applied N of M" summary from
`🐞 BUG-nx-06`) leaves the e2e suite testing a schema produced by a different
code path than production migrations.

**Repro:**
1. `grep -rn "@ortha-cms/nx" apps/server-e2e` → no import; only prose in
   `apps/server-e2e/drizzle.config.ts:11`.
2. Add a `console.log('marker')` to `applyPluginMigrations` and run the server
   e2e suite. → Observed: never printed. → Expected, given the comment's claim:
   printed once per run.

**Blast radius:** the correctness of a claim the test harness makes about itself.
No user impact today, because the two are currently equivalent in effect — they
already differ in their logging (`apply.ts:19, 32-34, 40` vs
`global-setup.ts:54`), which is the drift starting.

**Suggested fix:** have `global-setup.ts` import `applyPluginMigrations` from
`@ortha-cms/nx` (it is a plain function with no Nx dependency, which is exactly
what the AGENTS.md designed for), deleting the copy. That also gives the function
its first real exercise, on every e2e run.

---

**Tally:** 7 🐞 — 0 Critical · 1 High · 3 Medium · 3 Low (one 🔒) · **0 deleted** on
verification · 6 corrected in place · 4 carrying an `Unverified —` qualifier
(BUG-nx-01's two Nx cache semantics, BUG-nx-02's `pg` empty-string fallback,
BUG-nx-05's Drizzle Studio auth model, BUG-nx-06's Ctrl+C exit status). Two were
downgraded: BUG-nx-02 High 🔒 → Medium (DDL pollution, not data loss, and not a 🔒
category) and BUG-nx-03 Medium → Low (its "contradictory documentation" mechanism
did not survive reading the comment).
**♿ tally:** 4 ♿ — 1 Supports · 2 Partially Supports · 0 Does Not Support · 1 Not Applicable.

**Checked and cleared:** no executor builds a shell command string — all four use
`execFileSync` with an argv array, so a migration `--name`, a studio `--host`, and
every npm flag are inert against injection (EC-20); the Studio credential is never
written to disk, the ephemeral config references `process.env.DATABASE_URL` and
the URL travels only in the child's env, and the temp dir is created with
`mkdtempSync`'s 0700 mode (`studio.ts:39-50, 61-64`); `db:generate` genuinely
needs no database and no secret, and the committed drizzle configs carry no
`dbCredentials`; the migration pool is closed in a `finally` on every path,
including failure (`apply.ts:41-43`), and no pool is opened at all when no plugin
ships migrations; `db:migrate` and `db:studio` are correctly `cache: false` and
`pack` is correctly `cache: false` with a stated reason; the publish lock's
empty-file window is handled (an unparseable lock reads as alive, EC-24), a
crashed holder is detected by pid rather than waited out, and `EPERM` is
correctly not treated as absence; `spacing` is evaluated **inside** the slot so a
package that has bowed out does not sit out the gap; the registry probe collapses
every failure to `'unknown'` so it can never be the reason a release fails, and it
escapes a scoped name correctly; a dry run writes nothing and waits for nothing;
`already-published` is treated as success so a resumed release is cheap and safe;
`nx-release-publish`'s executor is deliberately declared in both `src/index.ts`
and `nx.json` with the reason written down; and the private-package guard keeps
this plugin itself out of the release.

## 7. Recommended E2E Tests

This package needs **unit and integration tests, not e2e** — neither existing
harness can drive an Nx plugin. The proposals below name the file each belongs
in; `packages/nx` currently has no test target, so item 1 includes standing one
up (`@nx/jest` already excludes only `apps/server-e2e/**`, `nx.json:87`).

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | package unit (new `jest`/`vitest` target on `packages/nx`) | `src/index.spec.ts` | call `createNodesV2[1]` with a synthetic file list and assert the emitted targets for each shape: a drizzle config, an ortha config, a public package, a **private** package, a package with no `tsconfig.lib.json`, a nameless manifest, a malformed manifest, and a `package.json` outside `packages/` | F1 ❌, F2 ❌, F5–F8 ❌ |
| 2 | package unit | `src/index.spec.ts` (same file) | for **every** `drizzle.config.ts` in the repo, assert that the inferred `db:generate` `inputs` glob matches the file its config's `schema` field points at — a table-driven test that fails today for five projects | 🐞 BUG-nx-01 |
| 3 | package unit | `src/lib/drizzle/apply.spec.ts` (against a `@testcontainers/postgresql` instance, mirroring `apps/server-e2e`) | an empty/blank URL is **refused** before any connection is attempted; two plugins apply in array order under separate tracking tables; a re-run is a no-op; a failure in plugin 3 leaves 1–2 committed and 4+ untouched and still closes the pool | 🐞 BUG-nx-02, F12 ❌, EC-15 |
| 4 | package unit | `src/lib/drizzle/apply.spec.ts` | two concurrent `applyPluginMigrations` calls against one database either serialise or fail cleanly — pinning whatever drizzle actually guarantees | EC-13 (Unverified) |
| 5 | package unit | `src/lib/release/throttle.spec.ts` | with a `publish` that outlives `staleAfter`, a second `withPublishSlot` on the same dir does **not** steal the lock while the holder's pid is alive; plus the covered-today behaviours (empty lock reads as alive, dead pid is stolen immediately, spacing evaluated inside the slot, stamp written on failure) | 🐞 BUG-nx-04, F19 ❌ |
| 6 | package unit | `src/lib/release/publish.spec.ts` | `retryableReason` / `isRateLimit` / `isAlreadyPublished` against captured real npm output for a 429, a 503, an `EPUBLISHCONFLICT`, `ECONNRESET`, and a plain manifest error; assert a creation 429 returns `creation-blocked` after **one** attempt; assert the `network` substring does not match an unrelated payload | 🐞 (EC-31), F21–F22 ❌ |
| 7 | package unit | `src/lib/release/registry.spec.ts` | `probeRegistry` against a stubbed `fetch`: 404 → `name-absent`, 200 with the version → `version-published`, 200 without → `name-exists`, 500/throw → `unknown`; a scoped name is escaped once; `registryTokenFromEnv` precedence | F17–F18 ❌ |
| 8 | package unit | `src/executors/release-publish/executor.spec.ts` | the breaker: a `creation-blocked` outcome writes the flag; a peer creating a different new name returns `blocked-by-peer` **without** calling publish; an existing name is unaffected; a dry run skips the probe, the spacing and the breaker | F20 ❌, F25 ❌ |
| 9 | integration (replace the copy) | `apps/server-e2e/src/support/global-setup.ts` | import `applyPluginMigrations` from `@ortha-cms/nx` instead of re-implementing it, so every e2e run exercises the shipped function | 🐞 BUG-nx-07, F12 ❌ |
| 10 | package unit | `src/executors/db-studio/executor.spec.ts` | a blank/absent URL throws the actionable message; `--port=0` is (or is not) forwarded — pinning the intent; a non-loopback `--host` emits a warning | 🐞 BUG-nx-05, EC-18, F13 ❌ |
| 11 | package unit | `src/lib/drizzle/studio.spec.ts` | the ephemeral config contains `process.env.DATABASE_URL` and **not** the URL itself; the temp dir is removed on a normal exit **and** on a signal | 🐞 BUG-nx-06, F14 ❌ |
| 12 | package unit | `src/lib/jiti.spec.ts` | `createTsJiti` loads a fixture module using legacy decorators with a definite-assignment field (`@IsString() email!: string`) — the exact construct `jiti.ts:8-12` says the default transform crashes on | F15 ❌ |
| 13 | CI guard (a lint-style script, not a spec) | `tools/` or a `db:check` target | run every project's `db:generate` in a scratch checkout and fail if it produces a diff — the standing answer to `.cursor/BUGBOT.md`'s "schema/migration drift", and the thing that would have caught 🐞 BUG-nx-01 in CI rather than at runtime | 🐞 BUG-nx-01, EC-22 |

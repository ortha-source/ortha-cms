# @ortha-cms/nx

The Ortha CMS **Nx plugin**. Adds first-class `nx` targets for database
work and is the home for any future Ortha-specific Nx commands. Sits
alongside the `@nx/*` plugins in the root `nx.json`.

## Package

- Name: `@ortha-cms/nx`
- Registered in `nx.json` under `plugins` (`"@ortha-cms/nx"`).
- Consumed from source like the other workspace packages. Loaded directly
  as a TypeScript Nx plugin (no build step).

## What it provides

- **`createNodesV2` inference** (`src/index.ts`) — targets appear
  automatically, the same way `@nx/js` infers `typecheck`:
    - a project with a `drizzle.config.ts` gets a cacheable **`db:generate`**
    - a project with an `ortha.config.ts` (the host) gets **`db:migrate`** and
      **`db:studio`**
    - a package under `packages/` with a `tsconfig.lib.json` gets a cacheable
      **`build`** (`tsc --build`, emitting JS + `.d.ts` to `dist/`), and a
      publishable one also gets **`pack`** and an **`nx-release-publish`**
      pointed at what `pack` staged. `@nx/js` infers no `build` here because
      our manifests point at source rather than output, which is exactly the
      thing a release has to undo — see [`docs/releasing.md`](../../docs/releasing.md)

        `nx-release-publish` is the one inferred target that is **also** named in
        the root `nx.json`, and it has to be: Nx adds an implicit
        `nx-release-publish` to every non-private package and applies it after
        inference. Where the two disagree on the executor, Nx's wins outright and
        drops the inferred `options` with it — so the `executor` is declared in
        `targetDefaults` as well, and `dependsOn` lives there alone.

- **Executors** (`executors.json`):
    - `db-generate` — runs `drizzle-kit generate` for one plugin's schema.
      Cacheable (inputs: schema files; outputs: the `migrations` dir). Needs
      no database and no secrets — generation only diffs against the snapshot.
    - `db-migrate` — applies every plugin's migrations. Loads the host's
      `ortha.config.ts` + `buildPlugins()` via `jiti` (transpiling with `swc`
      in **legacy-decorator** mode, since the plugin graph it pulls in uses
      `experimentalDecorators` and jiti's bundled babel otherwise defaults to
      stage-3 decorators and crashes), then applies each plugin's `migrations`
      (see `ServerPlugin.migrations`) under its own tracking table.
      `cache: false` (side-effecting).
    - `db-studio` — launches `drizzle-kit studio` against the host database.
      Resolves the connection URL from the host's `ortha.config.ts` (loaded via
      the same `jiti`+`swc` helper as `db-migrate`), the single place that reads
      `DATABASE_URL`. The committed drizzle configs are schema-only (no
      secrets), so this synthesizes an **ephemeral** config in a temp dir that
      reads `process.env.DATABASE_URL` — the URL is passed through the child's
      env and never written to disk. Studio introspects the live DB, so no
      schema is needed. `cache: false` (side-effecting, long-running).
    - `release-publish` — publishes one staged package to npm, in place of
      `@nx/js:release-publish`. npm rate-limits an account's writes and a
      lockstep release fires ~37 of them, so every publish takes a turn
      through a workspace-wide slot (a file lock under `dist/.release-publish`)
      that serialises them and leaves a gap in between, and a publish refused
      with a 429, a 5xx or a dropped socket is retried with exponential
      backoff. Defaults — 5s gap, 5 retries from 30s, capped at 5min — are
      target options, overridable per run with `ORTHA_PUBLISH_DELAY`,
      `ORTHA_PUBLISH_RETRIES` and `ORTHA_PUBLISH_RETRY_BACKOFF`. A dry run
      waits for nothing: it writes nothing to rate-limit.

        Each publish is preceded by a registry **probe** (`lib/release/registry.ts`)
        — a `GET`, which npm does not meter like a write. It answers whether the
        version is already published (skip, sending nothing), whether the name
        exists (a version bump), or whether the name is absent (a **creation**).

        That distinction matters, because **creating a name is a different limit
        from writing too fast** and retrying cannot beat it: 0.1.0 created 25
        names then hit a wall the next two releases never got past, while bumps
        on existing names kept succeeding throughout. So a 429 on a creation is
        terminal — one attempt, an actionable message — and it trips a flag beside
        the lock so packages queued behind it bow out without spending a request.
        One blocked release costs one rejected write, not one per package. Only
        npm support (or waiting out their schedule) clears it; see
        [`docs/releasing.md`](../../docs/releasing.md#creating-a-package-name-is-a-different-limit).

## Architecture

- **Thin executors over a core lib.** All logic lives in `src/lib/drizzle/`
  (`generate.ts`, `apply.ts`, `studio.ts`) and `src/lib/release/`
  (`publish.ts`, `throttle.ts`) as plain functions; the executors
  are adapters. This keeps the logic testable without Nx and lets a standalone
  CLI reuse it later if prod/CI migrations ever need to run without Nx. The
  shared `src/lib/jiti.ts` builds the `jiti`+`swc` (legacy-decorator) loader
  the host-config executors (`db:migrate`, `db:studio`) use to import the
  TypeScript `ortha.config.ts` at runtime.
- **Generate is per-plugin; apply is host-level.** Each workspace plugin
  owns its `drizzle.config.ts` and generates its own `migrations/`. The host
  applies all of them. npm-installed plugins ship their SQL pre-generated;
  the apply path is identical because each plugin advertises its own
  `migrations.dir`.
- **CommonJS.** This package compiles to CJS (no `"type": "module"`), so use
  `require`/`__dirname`/`__filename`, never `import.meta`.

## Commands

- `nx run <plugin>:db:generate --name=<migration_name>` — generate a plugin's migration
- `nx run server:db:migrate` — apply all plugins' migrations (needs `DATABASE_URL`)
- `nx run server:db:studio` — open Drizzle Studio on the host DB (needs
  `DATABASE_URL`; optional `--host` / `--port`)

## Adding a new command

1. `src/executors/<name>/{executor.ts,schema.json}` — keep logic in `src/lib/`.
2. Register it in `executors.json`.
3. (Optional) infer it in `createNodesV2` so it auto-attaches to projects.

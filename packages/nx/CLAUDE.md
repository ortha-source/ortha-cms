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
  - a project with an `ortha.config.ts` (the host) gets **`db:migrate`**
- **Executors** (`executors.json`):
  - `db-generate` — runs `drizzle-kit generate` for one plugin's schema.
    Cacheable (inputs: schema files; outputs: the `migrations` dir). Needs
    no database and no secrets — generation only diffs against the snapshot.
  - `db-migrate` — applies every plugin's migrations. Loads the host's
    `ortha.config.ts` + `buildPlugins()` via `jiti`, then applies each
    plugin's `migrations` (see `ServerPlugin.migrations`) under its own
    tracking table. `cache: false` (side-effecting).

## Architecture

- **Thin executors over a core lib.** All logic lives in `src/lib/drizzle/`
  (`generate.ts`, `apply.ts`) as plain functions; the executors are
  adapters. This keeps the logic testable without Nx and lets a standalone
  CLI reuse it later if prod/CI migrations ever need to run without Nx.
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

## Adding a new command

1. `src/executors/<name>/{executor.ts,schema.json}` — keep logic in `src/lib/`.
2. Register it in `executors.json`.
3. (Optional) infer it in `createNodesV2` so it auto-attaches to projects.

# OrthaCms — Nx monorepo

> **This is the canonical context file for AI agents.** It is tool-agnostic and
> read natively by Cursor, OpenAI Codex, Gemini CLI, and others. Claude Code
> reads it via the sibling `CLAUDE.md` (`@AGENTS.md` import). Every directory
> with project-specific context follows the same pair: `AGENTS.md` holds the
> content, `CLAUDE.md` imports it. Edit `AGENTS.md`, never the importer.

**Shared-context map** — start here, then dive in:

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — how the system is built (plugin hosts, resolve-from-source, request flow, migrations)
- [`CONTEXT-MAP.md`](CONTEXT-MAP.md) — glossary + the full project map (every app & package, one line each)
- [`DESIGN.md`](DESIGN.md) — product & design intent (owned by Design; partly `TODO:`)
- [`docs/adr/`](docs/adr/README.md) — Architecture Decision Records (why things are the way they are)
- [`docs/design/`](docs/design/) — engineering design docs for work that is proposed but not yet built (currently: [`copilot.md`](docs/design/copilot.md))
- [`README.md`](README.md) — human-facing project overview & getting started
- `.cursor/BUGBOT.md` — recurring bug-patterns reviewers and agents must watch for

## Project overview

- `apps/admin` — React 19 + Vite SPA (admin UI)
- `apps/server` — NestJS API
- `packages/design-system` — `@ortha-cms/design-system`, shadcn/ui library
- `packages/wysiwyg/{core,admin}` — the custom **block editor**.
  `@ortha-cms/wysiwyg-core` is a zero-dependency, DOM-free kernel (document
  model, extensible block schema, HTML parse/sanitize/serialize) used by **both**
  runtimes; `@ortha-cms/wysiwyg-admin` is the React editor, built on **TipTap 3**
  (the schema, commands and every contenteditable edge case are TipTap's; the
  value still leaves through core's sanitizer). Backs the `wysiwyg`
  content field type, whose stored value is plain sanitized HTML.
- `packages/bootstrap/{admin,server}` — the application **hosts** that turn a
  list of plugins into a running app
    - `@ortha-cms/bootstrap-admin` — `createAdmin({ plugins })`: mounts the React
      root, router, and plugin-contributed routes
    - `@ortha-cms/bootstrap-server` — `createServer({ plugins })`: runs each
      plugin's `onPluginInit`, imports its module, applies global prefix +
      `ValidationPipe`
- `packages/database` — `@ortha-cms/database`, the database **plugin**:
  owns one Drizzle/`pg` connection, opens it in `onPluginInit`, and exposes
  it via DI (`@InjectDatabase()`, global `DatabaseModule`) and plain
  `getDatabase()`/`getPool()`. Also provides the shared tactical-DDD
  infrastructure ([ADR-0003](docs/adr/0003-tactical-ddd-inside-plugins.md)):
  `UnitOfWork`, the transactional outbox (`OutboxWriter` / `OutboxDispatcher`),
  and the `DomainEvent` contract. It owns exactly **one** table — `outbox_events`
  — the sanctioned exception to "no schema", shipped with its own migrations.
- `packages/identity/server` — `@ortha-cms/identity-server`, the identity
  **plugin**: owns the auth/RBAC schema (Drizzle tables in `src/lib/schema`)
  and **ships its own migrations** (`drizzle.config.ts` + committed
  `migrations/`). Opens no connection; the host applies its migrations.
- `packages/nx` — `@ortha-cms/nx`, the workspace **Nx plugin**: infers and
  implements the `db:generate` / `db:migrate` targets (Drizzle migration
  tooling). Registered in `nx.json`.

## Package layout

Packages are either **flat** (`packages/<name>`, e.g. `design-system`) or
**grouped** by domain with an `admin`/`server` split
(`packages/<group>/{admin,server}`, e.g. `bootstrap`). The npm package name
stays hyphenated regardless of nesting: `packages/bootstrap/admin` is published
as `@ortha-cms/bootstrap-admin`. The root `workspaces` globs (`packages/*` and
`packages/*/*`) cover both shapes.

## How packages resolve

Workspace packages are consumed **from source** — their `exports` point at
`./src/index.ts` and `tsconfig.base.json` sets
`customConditions: ["@ortha-cms/source"]`. No build step is needed to consume a
package; the admin app's Vite transpiles the design-system source directly.

## Commands

- `npx nx <typecheck|build|lint|test|serve> <project>`
- **`npm run dev`** — the whole stack in **one terminal**. Runs four continuous
  tasks, each in its own Nx Terminal UI pane (arrow keys to switch, and two can
  be pinned side by side):
    - `server:dev:build` — webpack in watch mode; compile + type errors land here
      instead of scrolling past the API logs
    - `server:dev:run` — `node --watch` on `apps/server/dist/main.js`; Nest logs only
    - `admin:dev` — the Vite dev server (proxies `/api` → `:3000`)
    - `admin:dev:typecheck` — `tsc --build --watch`, because **Vite never
      typechecks**; this is the pane that catches admin type errors

    Needs Postgres (`docker compose up -d`) and a `.env`, same as `nx serve server`.
    `npm run start:server` / `start:admin` still run either half on its own.

    There are **three** server targets, not two, and the ordering matters:
    `dev:prebuild` does a one-shot dev build so `dist/main.js` exists before
    `dev:run` starts — `node --watch` **cannot recover from a missing entry
    point**, it stays alive with nothing to watch and never boots. Both watch
    tasks depend on it so they never race on `dist/`. The watcher sets
    `NX_WATCH_BUILD=true`, which turns off webpack's `output.clean` so its first
    compile can't delete the file `dev:run` is holding open.

    Don't reach for `readyWhen` to sequence a `continuous` task — on match Nx
    fires that task's _exit_ callbacks, so it is reported as "continuous but
    exited with code 0" and the whole run fails.

- **API reference** — a running server serves the generated OpenAPI document as
  a Scalar reference on `http://localhost:3000/reference` (raw JSON at
  `/reference/json`). On outside production; `API_DOCS=true|false` overrides.
  See [`packages/bootstrap/server/AGENTS.md`](packages/bootstrap/server/AGENTS.md)
- `npx nx sync` — run after changing cross-project dependencies (updates TS project references)
- **Database / migrations** (provided by `@ortha-cms/nx`; needs a `.env` with
  `DATABASE_URL`, and Postgres via `docker compose up -d`):
    - `npx nx run <plugin>:db:generate --name=<name>` — generate that plugin's
      Drizzle migration from its schema (per-plugin; commit the emitted SQL).
      Inferred on any project with a `drizzle.config.ts`. Needs no database.
    - `npx nx run server:db:migrate` — apply every plugin's pending migrations.
      Inferred on the host (the project with `ortha.config.ts`).
    - `npx nx run server:db:studio` — open Drizzle Studio on the host database
      (introspects the live DB; needs `DATABASE_URL`). Also inferred on the
      host. Optional `--host` / `--port` to change where Studio binds.
- Package manager: **npm workspaces** (not pnpm/yarn)

## Conventions

- Prettier: 4-space indent, single quotes
- shadcn / design-system work is governed by the shadcn skill and
  [`packages/design-system/AGENTS.md`](packages/design-system/AGENTS.md)
- Authoring or extending a NestJS **server plugin** (`packages/<group>/server`)
  is governed by the `server-plugin` skill — the `ServerPlugin` factory +
  dynamic-module pattern, `@InjectDatabase()` DI, config injection, and the
  Drizzle schema/migrations descriptor
- **Tactical DDD inside plugins** ([ADR-0003](docs/adr/0003-tactical-ddd-inside-plugins.md)):
  we are migrating each plugin from feature-then-kind to a layered
  `domain / application / infrastructure / http(presentation)` layout
  (aggregates, value objects, repository ports, use-cases, an outbox for domain
  events). The rollout is **incremental** — each package's own `AGENTS.md`
  declares which layout it is in, and the `server-plugin` / `admin-plugin` skills
  document both modes. The core rule: `domain/` imports no framework
  (Nest/Drizzle/React). Reference: `packages/workspaces/{server,admin}`.
- Admin i18n: `react-intl` with the host's single `IntlProvider`; each
  component **co-locates** its own `const messages = defineMessages({ … })`
  (no shared `messages.ts`). See
  [`packages/bootstrap/admin/AGENTS.md`](packages/bootstrap/admin/AGENTS.md)

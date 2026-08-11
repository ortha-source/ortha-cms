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
- [`docs/design/`](docs/design/) — engineering design docs for work that is proposed but not yet built (currently: [`copilot.md`](docs/design/copilot.md), [`graphql-api.md`](docs/design/graphql-api.md))
- [`README.md`](README.md) — human-facing project overview & getting started
- `.cursor/BUGBOT.md` — recurring bug-patterns reviewers and agents must watch for

## Project overview

- `apps/admin` — React 19 + Vite SPA (admin UI)
- `apps/server` — NestJS API
- `packages/design-system` — `@ortha-cms/design-system`, shadcn/ui library
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
- `packages/copilot/*` — the AI copilot. `domain` holds the framework-free
  `ModelProvider` port, the offer-time capability profile and the proposal
  contracts; `server` is the plugin (`CopilotPlugin`) with the SSE run route,
  the bounded run engine, and the write path — a `propose` tool's change is
  recorded as a `copilot_proposals` row and applied immediately, gated only by
  the caller's own permissions ([ADR-0009](docs/adr/0009-copilot-applies-directly.md));
  `admin` is the two chat surfaces — the docked panel over any page, and the
  full-page **Agents view** at `/workspaces/:id/agents` (thread rail + one
  conversation, with a CMS ⇄ Agents switch in the workspace sidebar) — sharing
  one transcript, composer and change card;
  `provider-anthropic` / `provider-openai` / `provider-fake` are the three
  shipped adapters, constructed at the composition root. Only
  `provider-anthropic` may import a vendor SDK
  ([ADR-0004](docs/adr/0004-model-agnostic-copilot-provider.md)). Its tools live
  in the shared registry, marked `surfaces: ['copilot']`
  ([ADR-0007](docs/adr/0007-one-tool-registry-two-surfaces.md)).
- `packages/tools/server` — `@ortha-cms/tools-server`, the shared agent **tool
  registry**: the transport-neutral `ToolDefinition` contract and the one place
  a tool call is authorized. Two consumers import its global `ToolsModule` — the
  MCP endpoint and the copilot's run loop — so both see one instance, and a tool
  declares which `surfaces` it is offered to
  ([ADR-0007](docs/adr/0007-one-tool-registry-two-surfaces.md)). **Omitting the
  field means both**, so adding a tool anywhere means deciding who it is for —
  the checklist is in
  [`packages/tools/server/AGENTS.md`](packages/tools/server/AGENTS.md#adding-a-tool-decide-surfaces-deliberately).
- `packages/content/graphql` — `@ortha-cms/content-graphql`, the public content
  API over **GraphQL** (`POST /api/v1/graphql`). A protocol **adapter** over
  `content/server`'s `public-api/`, not a second API: same bearer tokens, same
  guards, same scopes, same visibility rules, and resolvers that assemble the
  existing DTOs rather than reaching for the database
  ([ADR-0008](docs/adr/0008-graphql-as-a-protocol-adapter.md)). Its schema is
  built **per workspace content-grant set**, so introspection cannot enumerate
  types the workspace was not granted.
- `packages/mcp/server` — `@ortha-cms/mcp-server`, the **MCP plugin**: the
  Model Context Protocol endpoint (`POST /api/v1/mcp`) that lets an external
  agent do content CRUD with an API token
  ([ADR-0006](docs/adr/0006-cms-as-an-mcp-server.md)). Owns the protocol and
  nothing else — the registry lives in `tools/server` and the tools in
  `content/server`, which is what lets a handler call `PublicEntriesQuery`
  directly instead of re-implementing the rules it enforces. Off unless
  `MCP_ENABLED=true`.
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

A group is not limited to `admin`/`server`: it holds however many packages the
domain needs, named for what they are. `content` has four — `domain` (the
framework-free kernel), `server`, `admin`, and `graphql` (the public API's
second protocol); `copilot` has six.

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
- **Releasing to npm** — every `packages/` package publishes together, in
  lockstep. `npm run release` from a clean checkout of `main` versions, tags,
  publishes and opens the GitHub Release, reading `NPM_TOKEN` / `GITHUB_TOKEN`
  from `.env`; `npm run release:dry-run` rehearses it. The **Release** Actions
  workflow does the same unattended. A package's tarball is not its checked-in
  manifest: `build` compiles it and `pack` stages a rewritten manifest under
  `dist/pack/`, because the workspace resolves from source and a consumer
  cannot. The publishes are **throttled and retried** — npm rate-limits an
  account's writes and 37 tarballs go out in one run, so they are serialised
  with a gap and a 429 is backed off rather than failing the release. See
  [`docs/releasing.md`](docs/releasing.md)
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

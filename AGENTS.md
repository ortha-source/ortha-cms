# Ortha CMS — Nx monorepo

> **This is the canonical context file for AI agents.** It is tool-agnostic and
> read natively by Cursor, OpenAI Codex, Gemini CLI, and others. Claude Code
> reads it via the sibling `CLAUDE.md` (`@AGENTS.md` import). Every directory
> with project-specific context follows the same pair: `AGENTS.md` holds the
> content, `CLAUDE.md` imports it. Edit `AGENTS.md`, never the importer.

**Shared-context map** — start here, then dive in:

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — how the system is built (plugin hosts, resolve-from-source, request flow, migrations)
- [`CONTEXT-MAP.md`](CONTEXT-MAP.md) — glossary + the full project map (every app & package, one line each)
- [`docs/adr/`](docs/adr/README.md) — Architecture Decision Records (why things are the way they are)
- [`docs/artifacts/`](docs/artifacts/) — one dossier per package group, each ending in its numbered invariants
- [`docs/design/`](docs/design/) — engineering design docs for features with phases still unbuilt: [`copilot.md`](docs/design/copilot.md), [`mail.md`](docs/design/mail.md), [`protection.md`](docs/design/protection.md)
- [`README.md`](README.md) — human-facing project overview & getting started
- `.cursor/BUGBOT.md` — recurring bug-patterns reviewers and agents must watch for

## Project overview

The full map — every app and package, one line each — is
[`CONTEXT-MAP.md`](CONTEXT-MAP.md). In brief:

- `apps/admin` / `apps/server` — the reference app: a React 19 + Vite SPA and a
  NestJS API, each little more than a plugin list (`apps/admin/src/plugins.ts`,
  `apps/server/src/plugins.ts`). `apps/{admin,server}-e2e` test them.
- `packages/bootstrap/*` — the **hosts**: `createAdmin({ plugins })` and
  `createServer({ plugins })`. They own no domain logic.
- `packages/database` — the one Drizzle/`pg` connection (`@InjectDatabase()`)
  plus `UnitOfWork`, the transactional outbox and the `DomainEvent` contract. Its
  only table is `outbox_events`; no other table may be added here.
- `packages/identity/*` — auth, sessions, RBAC, API tokens and SSO (the
  `SsoProvider` port and its `provider-*` adapters).
- `packages/{users,workspaces,activity,api-tokens,shell}/*` — members, the
  tenancy boundary (the [ADR-0003](docs/adr/0003-tactical-ddd-inside-plugins.md)
  reference implementation), the audit log, the token page and the admin chrome.
- `packages/content/*` — the code-defined content model, entries, the public
  REST API, and its GraphQL adapter (`content/graphql`).
- `packages/{i18n,media,wysiwyg,insights,query-builder}/*` — localization, the
  media library and its storage adapters, rich text, dashboards, filter UI.
- `packages/{segments,alarms,protection,transfer}/*` — reader entitlements,
  non-blocking content checks, publish approvals, export/import.
- `packages/{webhooks,mail}/*` — outgoing webhooks and mail, both delivered by a
  worker from a queue, never from inside a transaction
  ([ADR-0016](docs/adr/0016-webhooks-deliver-from-a-queue.md)).
- `packages/copilot/*` — the AI copilot. **Only `provider-anthropic` may import
  a vendor SDK** ([ADR-0004](docs/adr/0004-model-agnostic-copilot-provider.md)).
  `provider-fake` is a **private test fixture**: published nowhere, registered
  by `server-e2e` and never by a host.
- `packages/tools/server` + `packages/mcp/server` — the shared agent tool
  registry (copilot and MCP both consume it) and the MCP endpoint. A tool's
  `surfaces` field **defaults to both** when omitted, so adding a tool means
  deciding who it is for — see
  [`packages/tools/server/AGENTS.md`](packages/tools/server/AGENTS.md#adding-a-tool-decide-surfaces-deliberately)
  ([ADR-0007](docs/adr/0007-one-tool-registry-two-surfaces.md)).
- `packages/schema-builder/*` — a visual content-type editor that **writes
  code** ([ADR-0020](docs/adr/0020-schema-builder-writes-code.md)). **Development
  only**: plan/apply need `SCHEMA_BUILDER=true`, a non-production `NODE_ENV` and
  the source tree; it edits only files whose first line is
  `// @orthacms-generated`.
- `packages/design-system`, `packages/utils/*` — the shadcn/ui library and
  shared plumbing (`apiClient`, slots, env readers).
- `packages/{nx,cli,create-orthacms-app}` — the workspace Nx plugin, the
  `orthacms` command (`dev` / `build` / `start` / `migrate` / `generate` /
  `content sync` / `studio`), and the scaffolder. The Nx database targets are
  adapters over the CLI, so this repo and a generated app migrate through one
  implementation. Every published package must be classified in
  `create-orthacms-app`'s `features.ts`, or its tests fail.

## Package layout

Packages are either **flat** (`packages/<name>`, e.g. `design-system`) or
**grouped** by domain with an `admin`/`server` split
(`packages/<group>/{admin,server}`, e.g. `bootstrap`). The npm package name
stays hyphenated regardless of nesting: `packages/bootstrap/admin` is published
as `@orthacms/bootstrap-admin`. The root `workspaces` globs (`packages/*` and
`packages/*/*`) cover both shapes.

A group is not limited to `admin`/`server`: it holds however many packages the
domain needs, named for what they are — a framework-free `domain` kernel, a
second protocol (`content/graphql`), or `provider-*` adapters for a swappable
backend.

## How packages resolve

Workspace packages are consumed **from source** — their `exports` point at
`./src/index.ts` and `tsconfig.base.json` sets
`customConditions: ["@orthacms/source"]`. No build step is needed to consume a
package; the admin app's Vite transpiles the design-system source directly.

## Commands

- `npx nx <typecheck|build|lint|test|serve> <project>`
- **`npm run dev`** — the whole stack in **one terminal**. Runs four continuous
  tasks, each in its own Nx Terminal UI pane (arrow keys to switch, and two can
  be pinned side by side):
    - `server:dev:build` — webpack in watch mode; compile + type errors land here
      instead of scrolling past the API logs
    - `server:dev:run` — `node --watch` on `apps/server/dist/main.js`; Nest logs only
    - `admin:dev` — the Vite dev server (proxies `/api` to `API_PORT`, falling
      back to `PORT`, else `:3000`)
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
- **Releasing to npm** — every `packages/` package except the two private ones
  (`@orthacms/nx`, `@orthacms/copilot-provider-fake`) publishes together, in
  lockstep. `npm run release` from a clean checkout of `main` versions, tags,
  publishes and opens the GitHub Release, reading `NPM_TOKEN` / `GITHUB_TOKEN`
  from `.env`; `npm run release:dry-run` rehearses it. The **Release** Actions
  workflow does the same unattended. A package's tarball is not its checked-in
  manifest: `build` compiles it and `pack` stages a rewritten manifest under
  `dist/pack/`, because the workspace resolves from source and a consumer
  cannot. The publishes are **throttled and retried** — npm rate-limits an
  account's writes and every tarball goes out in one run, so they are serialised
  with a gap and a 429 is backed off rather than failing the release. See
  [`docs/releasing.md`](docs/releasing.md)
- **First-run smoke** — `npm run smoke:scaffold` is what the tarballs have to
  survive before a release means anything: it packs every package, serves
  `dist/pack/` from a throwaway Verdaccio (`@orthacms/*` with no uplink, so a
  missing tarball fails instead of falling back to npmjs), scaffolds with
  `npx create-orthacms-app --yes` in a temp directory **outside** the repo, then
  follows the generated README — `docker compose up`, `migrate`, `npm test`,
  `typecheck`, `build`, `start` — and signs the root admin in over HTTP. Needs
  Docker and a free `:5432`; `--keep` leaves the app behind. The
  `scaffold-smoke` CI job runs it on Node 22 (its bundled npm 10, which is what
  users have) and Node 24
- **Database / migrations** (targets inferred by `@orthacms/nx`, which also
  infers every package's `build` / `pack` / release targets; needs a `.env` with
  `DATABASE_URL`, and Postgres via `docker compose up -d`):
    - `npx nx run <plugin>:db:generate --name=<name>` — generate that plugin's
      Drizzle migration from its schema (per-plugin; commit the emitted SQL).
      Inferred on any project with a `drizzle.config.ts`. Needs no database.
    - `npx nx run server:db:migrate` — apply every plugin's pending migrations.
      Inferred on the host (the project with `orthacms.config.ts`).
    - `npx nx run server:db:studio` — open Drizzle Studio on the host database
      (introspects the live DB; needs `DATABASE_URL`). Also inferred on the
      host. Optional `--host` / `--port` to change where Studio binds.
    - **`npx nx run server:dev:reset`** — drop and recreate the dev database,
      migrate it and run the dev seed (`server:dev:seed`). `--restore-model`
      also puts `apps/server/src/content` and `migrations` back to what git has,
      after a schema-builder experiment. Refuses `NODE_ENV=production` and a
      non-local `DATABASE_URL`. The `dev-seed` CI job runs it from empty on every
      PR. See [`apps/server/AGENTS.md`](apps/server/AGENTS.md#the-dev-seed)
    - `npx nx run server:content:sync` — rewrite the host's generated content
      manifest (`src/content/index.ts`) after adding, renaming or removing a
      type file; `orthacms content sync` is the same command in a generated
      app.
- Package manager: **npm workspaces** (not pnpm/yarn)

## Conventions

- Prettier: 4-space indent, single quotes
- shadcn / design-system work is governed by the shadcn skill and
  [`packages/design-system/AGENTS.md`](packages/design-system/AGENTS.md)
- Authoring or extending a NestJS **server plugin** (`packages/<group>/server`)
  is governed by the `server-plugin` skill — the `ServerPlugin` factory +
  dynamic-module pattern, `@InjectDatabase()` DI, config injection, and the
  Drizzle schema/migrations descriptor
- **Invariants** — every package dossier in [`docs/artifacts/`](docs/artifacts/)
  ends with a numbered list of invariants: at once a review checklist and a
  draft set of test assertions. Many specs name the one they pin in their title
  (`[segments:I-01]`); keep the habit when a test exists for a documented rule.
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

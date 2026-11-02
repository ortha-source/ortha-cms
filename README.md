# Ortha CMS

[orthacms.com](https://orthacms.com) · [Documentation](https://orthacms.com/docs) · [Quick start](https://orthacms.com/docs/start/quickstart)

A plugin-based CMS built as an [Nx](https://nx.dev) monorepo. A small, generic
**host** turns a list of **plugins** into a running app — capability lives in
plugins, not in the host.

- **`apps/admin`** — React 19 + Vite admin SPA
- **`apps/server`** — NestJS API
- **`packages/*`** — the hosts, and the plugins that hold every capability:
  identity and SSO, users and workspaces, the code-defined content model with
  its REST, GraphQL and MCP APIs, media, localization, the AI copilot, reader
  segments, alarms, publication protection, export/import, webhooks, mail, the
  schema builder — plus the design system and the CLI, Nx plugin and scaffolder.
  [`CONTEXT-MAP.md`](CONTEXT-MAP.md) lists every package.

## Documentation

| Doc                                  | What it covers                                                           |
| ------------------------------------ | ------------------------------------------------------------------------ |
| [`AGENTS.md`](AGENTS.md)             | Canonical context: layout, commands, conventions (read by all AI agents) |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the system is built — plugin hosts, data layer, request flow         |
| [`CONTEXT-MAP.md`](CONTEXT-MAP.md)   | Project map (every app & package) + glossary                             |
| [`docs/adr/`](docs/adr/README.md)    | Architecture Decision Records — the _why_                                |

The reference for people **using** Ortha CMS rather than working on it is the
documentation portal at [orthacms.com/docs](https://orthacms.com/docs).

## Getting started

Prerequisites: Node 22 or newer (CI runs 22 and 24), npm, Docker.

```sh
# 1. Install
npm install

# 2. Configure — copy the example env. It boots as it is; every variable is
#    listed in docs/configuration.md
cp .env.example .env

# 3. Start Postgres
docker compose up -d

# 4. Create the database: migrate it and fill it with the dev seed
npx nx run server:dev:reset

# 5. Run the whole stack — API, admin and both watchers — in one terminal
npm run dev
```

`dev:reset` drops and recreates the database `DATABASE_URL` names, applies every
plugin's migrations and seeds it: accounts for every role and state (password
`ortha-dev-password`), five workspaces, content for every type, and data for
every plugin. It writes the invite links and API tokens it created to
`apps/server/dev/seed/.output.md`. Run it again whenever you want a clean slate;
`npx nx run server:db:migrate` alone still migrates without touching the data.
See [`apps/server/AGENTS.md`](apps/server/AGENTS.md#the-dev-seed).

`npx nx serve server` / `npx nx serve admin` still run either half on its own.
The admin is on <http://localhost:4200>.

The running server documents itself: the interactive API reference is at
<http://localhost:3000/reference> (raw OpenAPI at `/reference/json`). It is on
outside production — set `API_DOCS=true` to publish it from a deployment, or
`API_DOCS=false` to turn it off locally.

## Working with the dev data

`apps/server`'s content model is a development fixture: every type is named for
what it exercises (`field_text`, `rel_self`, `flags_publishable`,
`i18n_relations`, `scenario_review_one`, …), and the dev seed fills each one
with its edge cases. The full list is in
[`apps/server/AGENTS.md`](apps/server/AGENTS.md#the-dev-content-model).

- **Day to day** — `npm run dev`. Sign in as `admin@dev.local` /
  `ortha-dev-password`; every other account, invite link and API token is in
  `apps/server/dev/seed/.output.md`. Want a clean slate? `npx nx run server:dev:reset`.
- **After pulling** a change to `apps/server/src/content`, `apps/server/migrations`
  or `apps/server/dev` — run `dev:reset`, not `db:migrate`. The model's
  migration history may have been rewritten, and the seed may have new records.
- **Trying something in the schema builder** — it writes straight into
  `apps/server/src/content` and `migrations`. When you are done,
  `npx nx run server:dev:reset --restore-model` puts both back to what git has
  and rebuilds the database. Commit a model change only on purpose: CODEOWNERS
  covers those folders.
- **Adding a type to the model**:
    1. create `apps/server/src/content/collections/<area>_<what>.ts` (or
       `pages/` for a single) — one concern per type, named by its prefix;
    2. `npx nx run server:content:sync`, then
       `npx nx run server:db:generate --name=<change>`;
    3. give it records in `apps/server/dev/seed/phases/04-content.ts`;
    4. add its row to the table in `apps/server/AGENTS.md`.

    The `dev-seed` CI job runs `dev:reset` from an empty database on every PR,
    so a seed that no longer fits the model fails there, not on the next
    person's machine.

## Commands

Package manager is **npm workspaces**. Formatting is Prettier (4-space indent,
single quotes). Any target runs as `npx nx run <project>:<target>` (or
`npx nx <target> <project>`), across many projects as
`npx nx run-many -t <target> [-p <projects>]`, and only on what a change touched
as `npx nx affected -t <target>`. `npx nx show project <project>` lists a
project's targets; `npx nx graph` draws the dependency graph.

### npm scripts

| Command                                | What it does                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                          | The whole stack in one terminal: server watch build and runner, admin dev server, admin type-check watcher            |
| `npm run start:server` / `start:admin` | One half on its own (`nx serve server` / `nx serve admin`)                                                            |
| `npm run smoke:scaffold`               | Pack every package, scaffold a fresh app from a local registry, install, migrate, test, build and sign in             |
| `npm run release`                      | Version, changelog, tag, push, publish to npm, open the GitHub Release — see [`docs/releasing.md`](docs/releasing.md) |
| `npm run release:dry-run`              | Rehearse a release: writes, pushes and publishes nothing                                                              |
| `npm run release:publish`              | Publish only — finishes a release that failed part-way                                                                |
| `npm run release:reserve`              | Create missing `@orthacms/*` package names ahead of a release                                                         |

### Database and dev data (`server`)

| Command                                          | What it does                                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `npx nx run server:dev:reset`                    | Drop and recreate the dev database, migrate it, run the dev seed. `--restore-model` also restores the content model from git |
| `npx nx run server:dev:seed`                     | Seed a database that was just migrated (builds the seed first)                                                               |
| `npx nx run server:db:migrate`                   | Apply every plugin's pending migrations                                                                                      |
| `npx nx run <project>:db:generate --name=<name>` | Generate a Drizzle migration from that project's schema — `server` for the content model, `@orthacms/<plugin>` for a plugin  |
| `npx nx run server:db:studio`                    | Open Drizzle Studio on the database (`--host` / `--port` to move it)                                                         |
| `npx nx run server:content:sync`                 | Rewrite `src/content/index.ts` after adding, renaming or removing a type file                                                |

### Apps

| Command                                   | What it does                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npx nx serve server`                     | Build and run the API on `PORT` (3000)                                                                                             |
| `npx nx build server`                     | Production build of the API into `apps/server/dist`                                                                                |
| `npx nx run server:prune`                 | Build plus a pruned lock file and copied workspace modules — a deployable `dist`                                                   |
| `npx nx run server:dev:build` / `dev:run` | The two server halves of `npm run dev`: webpack in watch mode, and `node --watch` on its output (`dev:prebuild` builds once first) |
| `npx nx run admin:dev`                    | The admin's Vite dev server on `ADMIN_PORT` (4200), proxying `/api` to the server                                                  |
| `npx nx run admin:dev:typecheck`          | `tsc --watch` for the admin — Vite never type-checks                                                                               |
| `npx nx build admin` / `preview admin`    | Production build of the admin, and a local preview of it                                                                           |

### Every project

| Command                             | What it does                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `npx nx typecheck <project>`        | Type-check                                                                                   |
| `npx nx lint <project>`             | ESLint                                                                                       |
| `npx nx test <project>`             | Unit tests (Jest for server packages, Vitest for admin ones)                                 |
| `npx nx build <project>`            | Compile a package into its `dist/`                                                           |
| `npx nx run <project>:pack`         | Stage the publishable package under `dist/pack/` (rewritten manifest, verified entry points) |
| `npx nx sync` / `npx nx sync:check` | Bring TypeScript project references in line with the dependency graph / check that they are  |

### End-to-end suites

| Command                               | What it does                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `npx nx e2e server-e2e`               | The API suite against a throwaway Postgres container (needs Docker); `E2E_DATABASE_URL` points it at an existing database instead |
| `npx nx e2e admin-e2e`                | The admin's Playwright suite; it mocks the API, so no server is needed                                                            |
| `npx nx run admin-e2e:e2e-ci--<spec>` | One admin spec on its own, e.g. `e2e-ci--src/content/i18n.spec.ts` (`nx show project admin-e2e` lists them)                       |

The agent-facing version, with the reasons behind each command, is in
[`AGENTS.md`](AGENTS.md#commands).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). In short: sign every commit
(`git commit -s`) to certify the [Developer Certificate of Origin](DCO), and
before changing a plugin read its package `AGENTS.md` and the relevant skill
under `.agents/skills/`. Recurring pitfalls to avoid are listed in
[`.cursor/BUGBOT.md`](.cursor/BUGBOT.md).

## Licence

MIT, for every package. Each `package.json` states it, and a release refuses
to stage a package that omits the field or names a different licence.

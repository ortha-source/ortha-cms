# apps/server

The **API** — a NestJS application. Like the admin app, this is a thin entry
point: it holds almost no logic. It assembles the product by handing a list of
**server plugins** to the `@orthacms/bootstrap-server` host.

## What's here

- `src/plugins.ts` — the **plugin registry**. Adding a feature to the API means
  registering its `ServerPlugin` here. This is the file you edit most.
  **What the order decides is migrations, not DI**: `applyPluginMigrations` walks
  the array with no transaction spanning plugins, so a plugin whose tables
  reference another's must come after it (`workspaces` after `identity`). DI is
  order-independent — every module is global and every `onPluginInit` runs before
  `NestFactory.create` — so `DatabasePlugin` is listed first as a convention, for
  the day a second plugin opens a resource in that hook, not because anything
  breaks today. `src/plugins.spec.ts` asserts the membership and the migration
  order, because a plugin dropped from the array degrades **silently**: the ports
  other plugins bind are `@Optional()`, so removing e.g. `ActivityPlugin` boots
  clean and just stops writing audit rows.
- `orthacms.config.ts` — host config: the flat object naming what this deployment
  runs. It **assembles** rather than derives — one builder per plugin, each in
  its own module under `config/`. It stays the entry point because
  `@orthacms/cli` looks for exactly `dist/server/orthacms.config.js`, `@orthacms/nx`
  infers the migration targets onto the project that has an `orthacms.config.ts`,
  and `src/plugins.ts` and `apps/server-e2e` import its types.
- `config/` — the single place that reads the environment, and it does so
  **only** through the readers (`readEnv`, `requireEnv`, `readPositiveInt`,
  `readList`, `readFlag`, `readEnum`, `readTrustProxy`, `readNodeEnv`) in
  `@orthacms/utils-server`, shared with the scaffolder's template so a
  generated app validates its environment the same way. These modules name the
  variables and the defaults; the readers decide what a value has to look like.
  **No module here writes `process.env[…]`** — a test asserts it. `readEnv` is
  where "empty means absent" is decided, and `.env.example` ships forty-two keys
  with nothing on the right-hand side, so a raw `process.env['X'] ?? default`
  hands the blank line the win: `SSO_OIDC_NAME=` produced a provider named `''`
  and a callback path of `/api/auth/sso//callback`, at boot, in silence.
  Nothing conditional is spread into a config object — `when(…)` yields a block
  or `undefined`, `defined(…)` drops the keys that were never set, because
  plugins merge as `{ ...DEFAULTS, ...config }` and an explicit `undefined`
  erases a default instead of leaving it. Both are shared too.
  Values are **validated at import**: a missing `DATABASE_URL`, a numeric
  setting that is not a plain positive integer, or a `NODE_ENV` that is not one
  of `development` / `test` / `production` refuses to load rather than booting a
  deployment that looks configured (`src/orthacms.config.spec.ts`, which exercises
  the real module by re-importing it under a set environment). This project is
  also the migration host: the inferred `db:migrate` target applies every
  plugin's pending migrations.
- `src/content/` — the host's **code-defined content types** (see below).
- `dev/` — the dev seed and `dev:reset` (see [The dev seed](#the-dev-seed)).

## The dev content model

Nothing tests this model: `server-e2e` boots its own
(`apps/server-e2e/src/support/content`) and `admin-e2e` mocks the API. It exists
for **developing by hand**, so every type is named for what it exercises, not
for a domain — `field_text`, not `article`. Three rules keep it that way:

- **One type, one concern.** `field_*` and `rel_*` carry no flags, so `required`
  fails on save and an error there is about the field, never about publishing.
  A feature that needs a combination gets a `scenario_*` type of its own.
- **Prefix by area**: `field_`, `rel_`, `flags_`, `i18n_`, `single_`,
  `scenario_`. `content sync` reads two flat folders, so the prefix is the only
  grouping there is — and it sorts the admin sidebar into the same sections.
  Labels follow it: `Field · Text`, `Rel · Self`.
- **A new type comes with a row in the table below and records in the seed.**
  CODEOWNERS covers `src/content/`, `migrations/` and `dev/`: the schema builder
  writes here, so an experiment lands in a diff by default — commit it only on
  purpose, and `npx nx run server:dev:reset --restore-model` throws it away.

| Type                                                 | Exercises                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `field_text`                                         | required, min/max length, pattern, the slug / textarea / email / color widgets |
| `field_richtext`                                     | required, bounded, structure checking on and off                               |
| `field_number`                                       | decimal, integer, bounds, money                                                |
| `field_boolean`                                      | optional (null) and required                                                   |
| `field_date`                                         | date, datetime, required                                                       |
| `field_select`                                       | select and multiselect, optional and required                                  |
| `field_json`                                         | optional and required JSON                                                     |
| `field_media`                                        | single and multiple, by kind, by MIME type, unrestricted                       |
| `field_defaults`                                     | a `defaultValue` on every type that takes one                                  |
| `field_layout`                                       | groups (one collapsed), rows, half width, a hidden field                       |
| `rel_target`                                         | the target of every `rel_*` link, with inverse fields; what Library shares     |
| `rel_many_to_one`                                    | required with RESTRICT, optional with SET NULL                                 |
| `rel_one_to_one`                                     | a unique link                                                                  |
| `rel_many_to_many`                                   | an ordered join-table link                                                     |
| `rel_self`                                           | parent, related and the children inverse                                       |
| `flags_none` / `_publishable` / `_paranoid` / `_all` | the same two fields under each set of type flags                               |
| `i18n_fields`                                        | localized and shared fields of every kind                                      |
| `i18n_target`                                        | a translated target: a synced link to it is **mirrored**                       |
| `i18n_relations`                                     | shared, mirrored and independent (`syncAcrossLocales: false`) links            |
| `scenario_sibling_sync`                              | shared required values every translation depends on — the sibling-sync dialog  |
| `scenario_review_one` / `_two` / `_off`              | publish protection: one approval, two without bypass, switched off             |
| `single_plain` / `single_i18n`                       | a single with no flags; a publishable, translated one                          |

## Content types (`src/content/`)

The host defines its content model here — the collections and pages the
`ContentPlugin` serves, and whose generated tables the host owns.

- `src/content/index.ts` — the **one aggregation point**, and a **generated**
  file ([ADR-0020](../../docs/adr/0020-schema-builder-writes-code.md)). It
  exports the `contentTypes` array (which `plugins.ts` registers with
  `ContentPlugin`) and **re-exports every generated table** for drizzle-kit to
  diff. Never edit it by hand.
- `src/content/collections/` — one file per collection (a `collection(...)`).
- `src/content/pages/` — one file per single page (a `single(...)`).

**Adding a type:** create `content/collections/<name>.ts` exporting a
collection named `<name>` (or `content/pages/<name>.ts` exporting a single),
then `npx nx run server:content:sync` rewrites `index.ts`, sorted collections
then pages. drizzle-kit only diffs **top-level table exports**, so the manifest
re-exports every main table and every many-relation join table (via
`joinTableOf`). Then `npx nx run server:db:generate --name=<change>` and commit
the SQL — `drizzle.config.ts` points `schema` at `src/content/index.ts`.

`src/content/index.spec.ts` guards exactly that. It fails when the file is not
what `content sync` would write, or when a module on disk is not registered,
and it derives the complete set of
generated tables from `contentTypes` (each type is `{ table, joinTables }`) and
fails if any of them is not a top-level export here — so the forgotten join table
is a red test instead of a `relation … does not exist` on a production write. The
generic version of this problem, for any plugin's schema barrel, is ORT-130.

## The dev seed

`npx nx run server:dev:reset` drops and recreates the database `DATABASE_URL`
names, clears the local media blobs, applies every plugin's migrations and runs
`server:dev:seed`. It refuses `NODE_ENV=production` and a non-local host
(`ORTHACMS_ALLOW_REMOTE_RESET=true` overrides the latter). The seed itself
refuses a database that already has workspaces — it creates, it never converges.

What it writes, and why each record exists, is printed to
`dev/seed/.output.md` (git-ignored) with the secrets nothing else can show
again: invite and reset links, API tokens. Every account's password is
`ortha-dev-password`. In short:

- **People** — admins, contributors, a viewer, two custom roles (`reviewer`,
  `no_delete`), and the states: disabled, pending invite, expired invite, live
  reset link, SSO-only, in no workspace.
- **Workspaces** — `main` (everything), `library` (shared), `consumer` (reads
  Library's published records), `archived` (shared but archived: a dead grant),
  `empty` (no types).
- **Content** — for every type its edge cases: empty and full records, every
  lifecycle state, every translation-group shape, every link shape.
- **Plugins** — media of every kind, protection in every review state, segments,
  saved views, alarm findings open and resolved (in Main and Library), copilot
  history (shown once the copilot is enabled), API tokens in every state,
  webhook endpoints and a delivery log.
- **Inbox** — written by the producers as the phases above run (review
  requests, ready to publish, stale approvals, alarm findings); the `inbox`
  phase marks read what each person has dealt with, and `backdate` moves those
  into the past, so `/inbox` has a Today and an Earlier. Sign in as
  `reviewer@dev.local`, or as `admin@dev.local` for two workspaces.
- **Time** — the last phase spreads it all over four months, so Insights has
  something to draw.

How it is built (`dev/seed/`):

- `main.ts` boots the **real plugin list** as an application context and runs
  the phases in `phases/` in order; each is one area. Phases find each other's
  records by **key** (`ctx.entry('flags_pub_modified')`), never by id.
- It **writes through the services** the HTTP routes use —
  `EntryWriterService`, `PublishEntryUseCase`, `UploadAssetUseCase`,
  `EntryReviewService`, … — because a row inserted behind a service's back has
  no revision, no outbox event and no activity, and protection reads an entry
  without a head revision as unprotected. Raw SQL is kept for what no service
  does (custom roles, expired tokens, backdated timestamps), and each place says
  why. `content-writer.ts` is the shared create / edit / publish / trash helper;
  it gives a new translation the group's shared values, as the editor does — a
  sibling created without them would clear them for the whole group.
- It is **built with webpack** (`dev:seed:build`, `webpack.seed.config.js`)
  rather than run with `tsx`: Nest's DI reads constructor types from
  `emitDecoratorMetadata`, which esbuild does not emit. `tsconfig.seed.json`
  type-checks it; `dev/**` is exempt from the module-boundary rule, like
  server-e2e's support harness, because it reaches use cases plugins do not
  export.
- Webhook endpoints are seeded **last but one**, on `*.invalid` hosts, with
  every retryable delivery scheduled a month out — otherwise the content writes
  above would fan out into real requests.
- The **`dev-seed` CI job** runs `dev:reset` from an empty database on every PR.
  A seed that only runs on someone's machine is broken by the first renamed
  field and found out by the next person to need it.

When a plugin gains a state worth seeing, add it to its phase; when a type is
added, give it records in `04-content.ts`.

## How it fits

- The host (`createServer({ plugins })`) runs each plugin's `onPluginInit`,
  imports its NestJS module, and applies the global `/api` prefix + a
  `ValidationPipe`. It also generates the OpenAPI document from the assembled
  controllers + DTOs and serves it as a Scalar reference on `/reference`
  (JSON on `/reference/json`), configured by `orthacms.config.ts`'s `docs`.
- Cross-cutting guards are global: `AuthGuard` (session), `PermissionsGuard`
  (RBAC), `OriginGuard` (CSRF on state-changing POSTs).
- Each plugin owns its Drizzle schema + migrations; the shared
  `@orthacms/database` plugin owns the single connection.

## Working here

- Authoring or changing a server plugin is governed by the **`server-plugin`**
  skill (`ServerPlugin` factory + dynamic module, both folder layouts — the
  layered ADR-0003 one and the older feature-then-kind one — `@InjectDatabase()`
  DI, schema/migrations descriptor, and the authorization / data-integrity
  invariants).
- Migrations: `npx nx run <plugin>:db:generate --name=<name>` to generate,
  `npx nx run server:db:migrate` to apply. Commit emitted SQL.
- E2E coverage lives in `apps/server-e2e` (testcontainer + supertest) — see the
  **`server-e2e`** skill.
- Common back-end traps: `.cursor/BUGBOT.md` (Server section).

See [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) for the full picture.

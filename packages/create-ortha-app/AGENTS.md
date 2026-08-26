# create-ortha-app

The scaffolder. `npx create-ortha-app my-cms` writes an Ortha CMS app that
consumes every package from npm.

## Package

- Name: **`create-ortha-app`** — unscoped, so `npx create-ortha-app` and
  `npm create ortha-app` both work. It is the one package in this workspace
  outside the `@orthacms` scope, which is why `nx.json`'s `release.projects`
  names it explicitly alongside the `@orthacms/*` glob.
- Binary: `create-ortha-app`
- Released **in lockstep** with everything else.

## The version mechanism

The scaffolder stamps **its own version** into every `@orthacms/*` dependency of
the generated app (`__ORTHA_VERSION__`). Since the release is lockstep, its
version *is* the matching set — so `npx create-ortha-app@0.4.0` generates a
0.4.0 app, and a generated app is internally consistent by construction.

They are pinned **exactly**, no caret, and the generated README says to upgrade
them together. A partial upgrade can leave two copies of a shared package in
`node_modules` — two React context instances, and an admin whose sidebar
silently stops talking to its provider.

Reading the version from the manifest rather than resolving `latest` from the
registry is also what makes `create-ortha-app@<old>` reproducible.

## Keeping the template current

Two upkeep rules, both enforced by tests rather than by memory.

**Releasing does not require a template edit.** Every `@orthacms/*` dependency
is written as `__ORTHA_VERSION__` and stamped with the scaffolder's own version
at render time, so a lockstep release bumps the whole generated set with nothing
to update here. There is no version list to fall behind.

**Adding a package does require one.** Every published `@orthacms/*` package
must be classified in [`src/lib/features.ts`](src/lib/features.ts) as exactly
one of:

| Group | Meaning |
| --- | --- |
| `CORE_PACKAGES` | every app gets it |
| a `Feature`'s `packages` | installed when that feature is chosen |
| `TRANSITIVE_PACKAGES` | an internal detail of another package; deliberately not declared. **Currently empty** |

`features.spec.ts` enumerates the workspace and fails on anything unclassified,
so a new package cannot merge without someone deciding whether a new app gets
it. Without that guard the template just falls a release behind: the package
publishes, nothing references it, and nobody notices until a user asks why the
feature they read about is missing.

**Everything reachable is declared.** A generated app's manifest lists every
`@orthacms/*` package it could import, the extension points included —
`content-domain`, `copilot-domain`, `tools-server`, `query-builder-admin`. All
four arrive transitively anyway, so an import resolves on npm's flat
`node_modules` regardless; declaring them is what makes that resolution
something the app owns. An undeclared import works until a version conflict
nests a copy, and never works under pnpm.

That leaves exactly five packages out of a default app, and
`features.spec.ts` asserts the list in full: the two hosted copilot backends,
`content-graphql`, `mcp-server`, and the unreleased S3 adapter.

Note what "optional" does and does not mean for the last two.
`content-server` depends on `mcp-server`, so it is on disk in every generated
app whatever the user picked. Optional means **not registered** — the plugin is
absent from `plugins.ts` and its config block from `ortha.config.ts` — which is
why a default app answers `404` on `/api/v1/mcp` rather than failing to
resolve anything.

## Feature selection

The wizard asks three questions; everything else is installed unconditionally.

| Question | Kind | Default |
| --- | --- | --- |
| Where should uploads be stored? | single | Local filesystem |
| AI copilot — which model backends? | multiple | none |
| Which protocols should the content API speak? | multiple | REST (locked) |

Both multi-selects default to **nothing extra**, deliberately: a hosted copilot
provider sends workspace content to a third party (ADR-0005 §10), and an
endpoint nobody asked for is still an endpoint.

REST is shown **`locked`** — ticked, dimmed, and skipped by the cursor — rather
than left out of the question. "Which protocols does this app speak?" is a more
useful thing to answer than "do you want these two extras", and the answer reads
as a complete set only if the one you always get is in it. `--protocols none`
still yields REST; it is not something a flag can switch off.

The storage question is **skipped while only one adapter is available** — S3 is
listed in the registry and marked `available: false` because the package has
never been released, and a question with a single possible answer is noise
pretending to be a choice. It appears the moment S3 ships.

**The copilot itself is core, not a choice.** `copilot-server` and
`copilot-admin` are in `CORE_PACKAGES`, and `CopilotPlugin` is registered on
both sides of every generated app, because its server half arrives regardless —
five core plugins (`content`, `activity`, `i18n`, `media`, `users`) depend on
`copilot-server` to contribute their tools, so the code is on disk whatever the
manifest says, and leaving it undeclared bought only a missing chat panel.
`COPILOT_ENABLED` defaults to `false`, and since that flag unregisters the
copilot's routes, a generated app ships with the surfaces **absent** rather than
present-and-refusing.

What the question picks is which **backends** to add, and picking none is a
complete answer: an app with no backend has the plugin installed and nothing
registered, so `COPILOT_ENABLED` has to stay `false` until one is configured —
enabling it with an empty provider list refuses to boot.
`copilot-provider-fake` is never offered because it is not a published package
at all. It was once shipped as an offline stand-in (ADR-0004 §3) and registered
last in every generated app, which made it the whole catalogue of any deployment
that configured nothing — so a keyless install answered every question with a
canned sentence instead of failing. It is now a private test fixture of the CMS
repo.

Every question has a flag (`--media`, `--copilot`, `--protocols`, each taking a
comma-separated list or `none`), and `--yes` plus any non-TTY takes the defaults
without asking. A scaffolder that blocks on a prompt in CI hangs the job until
it times out.

## Templates

**One** template, `templates/default` — a working CMS with **no content types**.
The user defines their own; the generated README and a comment in the template's
`plugins.ts` say how, including the `drizzle.config.ts` and `migrations`
descriptor to add at that point. `ContentPlugin({ types: [] })` is valid and
owns no tables, which is what lets the app migrate and boot before any content
type exists.

Templates are **data, not source**, and this workspace has to be told so in four
separate places — each of which failed loudly the first time:

| Where | Why |
| --- | --- |
| `.nxignore` | Nx inference walks every directory. Left visible, `@orthacms/nx` infers a `db:migrate` target onto `templates/default/src/server` — a directory with no project name — and **the whole project graph fails to build**, taking every `nx` command in the repo with it |
| `tsconfig.lib.json` `exclude` | `tsc --build` would compile app-shaped files against this workspace's resolve-from-source setup |
| `eslint.config.mjs` `ignores` | Same, for lint |
| `.prettierignore` | The files carry `__PLACEHOLDER__` tokens inside JSON |

### File naming

Two renames happen at scaffold time (`RENAMES` in `src/lib/template.ts`):

- **`_gitignore` → `.gitignore`.** npm silently refuses to publish a file named
  `.gitignore`, so a template carrying one ships without it and every generated
  app starts by offering to commit `node_modules`. Nothing about the tarball
  looks wrong. create-vite and create-next-app use the same workaround.
- **`*.tmpl` → the real name.** Keeps a `package.json` out of the root
  `workspaces` globs, which would otherwise read the template directory as a
  package of its own.

`pack.mjs` stages `templates/` verbatim and adds it to `files`, the same way it
handles a plugin's `migrations/`.

## The generated app

```
my-cms/
├── package.json          one package — not workspaces; see below
├── tsconfig.json         references the four apps
└── apps/
    ├── server/           ortha.config.ts, src/{main,plugins}.ts, jest.config.js
    ├── admin/            index.html, vite.config.mts, src/
    ├── server-e2e/       jest.config.js, src/{api.spec,global-setup,support}
    └── admin-e2e/        playwright.config.ts, src/{auth.spec,support}
```

**The same four apps this repo is built from**, so anyone who has read the
Ortha source finds the same shape in their project — and `LAYOUT` in
`@orthacms/cli` has one tree to describe rather than two.

Still **one** `package.json`, deliberately: npm workspaces would let the two
halves resolve different copies of a shared package, and `pack.mjs` pins
internal deps per release, so a split risks two `@orthacms/design-system`
instances — two React contexts, and a UI that silently stops talking to itself.

`apps/server/tsconfig.json` sets `rootDir` to the app directory, which is what
makes the compiled paths predictable: `apps/server/ortha.config.ts` →
`dist/server/ortha.config.js`, `apps/server/src/main.ts` →
`dist/server/src/main.js`. Those exact strings are `LAYOUT`'s
`compiledConfig` / `serverEntry`; change the `rootDir` without changing them
and `ortha start` reports a missing entry point rather than a moved one.

The admin's Vite config lives **inside** `apps/admin` and sets its own `root`,
so the CLI passes `--config apps/admin/vite.config.mts`. Without the flag Vite
finds no config in the working directory and builds from its defaults —
silently, producing a bundle from the wrong root.

Three things the generated app does differently from this repo's `apps/*`, each
because it consumes packages from npm rather than from source:

1. **No webpack.** `tsc` only, so `node_modules` stays on disk and every
   plugin's `join(__dirname, '../../../migrations')` still resolves.
2. **`@source "../../../node_modules/@orthacms"`** in `styles.css`. Tailwind
   excludes `node_modules` from content detection, so without this the entire
   admin renders unstyled — and nothing errors. It must stay a **bare
   directory**: a `@source` containing a glob is still filtered through the
   ignore rules, so `@orthacms/*/dist/**/*.js` matches nothing and the emitted
   stylesheet is the theme block alone (~15 kB, no component utilities). Only a
   literal directory path is registered as an explicit content root that
   bypasses those rules.
3. **`staticDir`**, so one process serves the API and the admin on one origin.
   `apps/*` splits them because Vite serves the admin there; a deployment has no
   dev proxy, and identity's `SameSite=lax` session cookie needs same-origin.

## Conditional blocks

One template serves every feature combination through `ortha:if` markers
(`src/lib/conditionals.ts`):

```ts
// ortha:if copilot
import { CopilotPlugin } from '@orthacms/copilot-server';
// ortha:end
```

`ortha:if`, `ortha:ifnot` and `ortha:end`, on any comment syntax, so the same
directive works in TypeScript, YAML, `.env` and Markdown. Marker lines are
always stripped; blocks nest, and an inner block inside a dropped one stays
dropped. An unclosed block **throws** — silently swallowing the rest of
`plugins.ts` would produce an app that boots with no API rather than one that
fails to render.

`package.json` deliberately does **not** use them: dropping lines from JSON is
how you get a trailing comma and an app that cannot be installed, blaming the
template rather than the feature that was switched off. Its dependency map is
assembled in `features.ts` and re-sorted instead.

## The terminal UI

`src/lib/ui.ts` — boxes, colour, and arrow-key/space-bar pickers, hand-rolled
with **no dependencies**. This package is what `npx` downloads before anything
else exists, so every dependency is weight on the first thing a new user waits
for. It degrades on `NO_COLOR`, a dumb terminal, a non-TTY and `--yes`.

The one hazard to know: the pickers put stdin in raw mode, and a process that
exits while still raw leaves the user's terminal with no echo — they have to
type `reset` blind. Restoring it lives in a `finally`.

## The generated app's own tests

A scaffolded app ships a working test setup, because a starter that cannot be
tested teaches people not to.

| Suite | Runner | Why that one |
| --- | --- | --- |
| `apps/server/**/*.spec.ts` | Jest + `@swc/jest` | NestJS DI reads `emitDecoratorMetadata`; Vitest's esbuild transform does not emit it, and providers resolve as `undefined` with no error naming the cause |
| `apps/admin/src/**/*.spec.{ts,tsx}` | Vitest + jsdom, configured in `apps/admin/vite.config.mts` | It is a Vite app; sharing the config is the only way tests and app agree on resolution |
| `apps/server-e2e` | Jest + supertest, real Postgres | Boots **this app** through `createServer` — a harness that mirrors the bootstrap can never fail on a bootstrap defect |
| `apps/admin-e2e` | Playwright, Vite dev server, `/api` mocked | Drives the UI with no backend: fast, hermetic, and a failure means the UI is wrong |

The e2e split mirrors `apps/server-e2e` and `apps/admin-e2e` in this repo, for
the same reason: testing the API through a browser is slower and blames the UI
for server bugs.

Two runners is the honest answer here rather than a compromise: each half has a
different toolchain and neither transform serves both.

The shipped specs assert what breaks quietly — the plugin lists and their
order. They are **feature-aware**: the expected server list carries `ortha:if`
blocks for `content-graphql` and `mcp`, so it stays correct whatever the wizard
was asked for.

### The server e2e database

It manages its own: `<database>_e2e`, created and migrated on first run through
`applyPluginMigrations` — the same function `ortha migrate` calls, so the schema
under test is the real one rather than a hand-rolled mirror.

Four things there took a run to get right:

- **The derivation is idempotent.** `global-setup` runs in Jest's main process
  and points `DATABASE_URL` at the test database; workers fork from it and
  inherit that value, so a naive append derives `app_e2e_e2e` in the worker and
  every test fails against a database nobody created.
- **`global-setup` imports the config dynamically.** A static import is hoisted
  above every statement, so it would run before `.env` is loaded and before the
  URL is repointed — and the suite would fail on a variable sitting in a file
  two lines away.
- **`transformIgnorePatterns` un-ignores `@scalar`.** `createServer` pulls in
  the API-reference renderer, published ESM-only, and Jest is CommonJS: without
  it the run dies on `Unexpected token 'export'` pointing at a file nobody in
  the app wrote.
- **`assertDisposable` refuses the development database.** The suite truncates
  every table, and `E2E_DATABASE_URL` can be set to anything. Check before the
  first `TRUNCATE`, not after.

Three more details worth not re-discovering:

- **`jest.setup.js` supplies placeholder secrets.** The specs import
  `ortha.config.ts`, which deliberately refuses to load without `DATABASE_URL`.
  Nothing connects — the plugin list is a pure function of the config — so
  placeholders are what let `npm test` run in CI with no `.env`.
- **`tsconfig.server.json` excludes `**/*.spec.ts`**, or `ortha build` compiles
  the tests into `dist/server` and ships them.
- **The Vite config is `.mts`.** The app is `"type": "commonjs"`, and Vite warns
  (and will eventually fail) on ESM syntax in a config loaded as CJS.
- **The server e2e specs read `ALLOWED_ORIGIN` from the config.** Login is
  guarded by an origin allow-list that follows `ADMIN_PORT`, so a hardcoded
  `:4200` fails on any app whose admin runs elsewhere — as a confusing `403`
  rather than "wrong origin".

## Tests

`npx nx test create-ortha-app` — the package-coverage guard, the conditional
processor, and the scaffolded output for several feature combinations (nothing
optional, one copilot provider, both, and every protocol).

The end-to-end path (publish to a local registry → scaffold → install → migrate
→ build → boot) is not automated yet; see the PR that introduced this package
for the manual run.

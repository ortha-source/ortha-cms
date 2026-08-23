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
| `TRANSITIVE_PACKAGES` | arrives via another package; deliberately not declared |

`features.spec.ts` enumerates the workspace and fails on anything unclassified,
so a new package cannot merge without someone deciding whether a new app gets
it. Without that guard the template just falls a release behind: the package
publishes, nothing references it, and nobody notices until a user asks why the
feature they read about is missing.

Note what "optional" does and does not mean. `content-server` depends on
`copilot-server`, `mcp-server` and `tools-server`, so those are on disk in every
generated app whatever the user picked. Optional means **not registered** — the
plugin is absent from `plugins.ts`, its config block is absent from
`ortha.config.ts`, and its admin package is not installed.

## Feature selection

The wizard asks three questions; everything else is installed unconditionally.

| Question | Kind | Default |
| --- | --- | --- |
| Where should uploads be stored? | single | Local filesystem |
| AI copilot — which model backends? | multiple | none |
| Extra APIs, alongside REST | multiple | none |

Both multi-selects default to **nothing**, deliberately: a copilot provider
sends workspace content to a third party (ADR-0005 §10), and an endpoint nobody
asked for is still an endpoint.

The storage question is **skipped while only one adapter is available** — S3 is
listed in the registry and marked `available: false` because the package has
never been released, and a question with a single possible answer is noise
pretending to be a choice. It appears the moment S3 ships.

Choosing any copilot provider also pulls in `copilot-server`, `copilot-admin`
and `copilot-provider-fake`. The fake adapter is not offered as a choice: it is
a shipped adapter rather than test scaffolding (ADR-0004 §3), needs no key and
no network, and is registered last so it is the default only when it is the only
one — which is what makes the chat work in a clone with nothing configured.

Every question has a flag (`--media`, `--copilot`, `--api`, each taking a
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
├── ortha.config.ts is at src/server/ — see LAYOUT in @orthacms/cli
├── src/server/{main,plugins,ortha.config}.ts
├── src/admin/{main.tsx,plugins.ts,styles.css}
├── tsconfig.server.json     rootDir: src/server → a FLAT dist/server
└── tsconfig.admin.json      noEmit; Vite builds the bundle
```

Three things the generated app does differently from this repo's `apps/*`, each
because it consumes packages from npm rather than from source:

1. **No webpack.** `tsc` only, so `node_modules` stays on disk and every
   plugin's `join(__dirname, '../../../migrations')` still resolves.
2. **`@source "../../node_modules/@orthacms/*/dist/**/*.js"`** in `styles.css`.
   Tailwind excludes `node_modules` from content detection, so without this the
   entire admin renders unstyled — and nothing errors.
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

## Tests

`npx nx test create-ortha-app` — the package-coverage guard, the conditional
processor, and the scaffolded output for several feature combinations (nothing
optional, one copilot provider, both, and the extra APIs).

The end-to-end path (publish to a local registry → scaffold → install → migrate
→ build → boot) is not automated yet; see the PR that introduced this package
for the manual run.

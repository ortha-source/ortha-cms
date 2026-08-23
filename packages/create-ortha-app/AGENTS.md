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

## Tests

`npx nx test create-ortha-app` — covers rendering, the renames, the exact pins,
and that no placeholder survives into a scaffolded file.

The end-to-end path (publish to a local registry → scaffold → install → migrate
→ build → boot) is not automated yet; see the PR that introduced this package
for the manual run.

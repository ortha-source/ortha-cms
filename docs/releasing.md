# Releasing to npm

Every package under `packages/` is published to the `@ortha-cms` scope in one
lockstep release: one version, one tag, one GitHub Release, 37 tarballs.

## Running a release from your machine

Check out `main`, pull, and run:

```sh
npm run release:dry-run     # rehearse — writes nothing, pushes nothing, publishes nothing
npm run release             # version → changelog → tag → push → publish → GitHub Release
npm run release:publish     # publish only, to finish a partly failed release
npm run release -- 1.2.0    # force a version instead of deriving one
```

`nx release` asks for confirmation before it publishes. **Read that prompt.**
A publish cannot be undone and a version number can never be reused; the
prompt is the last point at which a mistake is free. Pass `--yes` only for an
unattended run.

### Credentials

Both live in `.env` at the workspace root, which is git-ignored.
[`.env.example`](../.env.example) documents them. `tools/release/release.mjs`
loads the file before handing off; anything already exported in your shell
wins over it.

|                |                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NPM_TOKEN`    | An npm automation token with publish rights on the `@ortha-cms` scope. It is handed to npm as configuration in the child process, never written to an `.npmrc`. Leave it empty to publish as whoever `npm login` logged in as. |
| `GITHUB_TOKEN` | A token with `repo` access. `nx release` creates the GitHub Release with it.                                                                                                                                                   |

### What it refuses to do

`nx release` commits, tags and **pushes** the new version before it publishes
or creates the release, so a problem found at that point leaves a tagged
commit and an empty registry. The preflight checks therefore run first and
refuse to start when you are not on `main` (override with `--allow-branch`),
the working tree is dirty, the branch is behind `origin/main`, npm has no
usable credentials, or `GITHUB_TOKEN` is missing.

## Running it from CI

The **Release** workflow in the Actions tab does the same thing unattended:
leave the version input empty to derive the bump, or type an explicit one, and
tick **dry-run** to rehearse. It needs one repository secret, `NPM_TOKEN`.

## What is released

|            |                                                                     |
| ---------- | ------------------------------------------------------------------- |
| Scope      | every project matching `@ortha-cms/*` except `@ortha-cms/nx`        |
| Versioning | **fixed** — all packages move together, always the same version     |
| Specifier  | conventional commits (`feat:` → minor, `fix:` → patch, `!` → major) |
| Tag        | `v{version}`                                                        |
| Changelog  | one workspace-level `CHANGELOG.md`, no per-project files            |

That is **38 packages under `packages/`, of which 37 publish**. The one that
does not is `@ortha-cms/nx`: it is `private`, workspace tooling wired into this
repo's `nx.json`, not something a consumer installs.

The apps (`apps/admin`, `apps/server`) are private and never publish. They are
the reference host, not a distributable.

Nesting does not matter to the release. Both shapes the repo uses — flat
(`packages/database`) and grouped (`packages/content/server`) — are picked up
the same way, because packages are discovered by walking for `package.json`
rather than by matching a fixed depth. A package nested deeper still builds,
packs and publishes correctly.

What a deeper package would _not_ get is npm workspace linking: the root
`workspaces` globs are `packages/*` and `packages/*/*`, so `packages/a/b/c`
is never symlinked into `node_modules` and nothing in the repo can import it.
Keep to the two documented shapes; if a third level is ever wanted, add the
glob to the root manifest at the same time.

## How a tarball is built

Workspace packages are consumed **from source** — their `exports` point at
`./src/index.ts` and `tsconfig.base.json` supplies the `@ortha-cms/source`
condition (see [AGENTS.md](../AGENTS.md), "How packages resolve"). A consumer
installing from npm has neither, so the checked-in manifest is not the one
that ships.

Three inferred targets do the work; all three come from
[`@ortha-cms/nx`](../packages/nx/AGENTS.md), so a new package gets them by
existing.

1. **`build`** — `tsc --build tsconfig.lib.json`, emitting JS and `.d.ts` into
   the package's `dist/`. Server packages compile to CommonJS, which is what
   their `nodenext` module setting and the absent `"type": "module"` add up
   to; admin packages compile to ESM for a bundler, which is the only way
   they are ever consumed.
2. **`pack`** — [`tools/release/pack.mjs`](../tools/release/pack.mjs) assembles
   a publishable package root at `dist/pack/<projectRoot>/`: the build output,
   any non-TS asset that sat beside the source (`styles.css`), the
   `migrations/` folder if the plugin ships one, the LICENSE and README, and a
   **rewritten `package.json`** whose `exports` point at `./dist` and whose
   workspace dependencies are pinned to the released version instead of `"*"`.
3. **`nx-release-publish`** — publishes that staging directory rather than the
   project root, via `packageRoot`.

The staging directory lives at the workspace root, not beside the package, on
purpose: the root `workspaces` globs cover `packages/*`, so a staging
directory inside a flat package is read as a second workspace of the same
name, and npm then refuses to run at all.

### Two things `pack` refuses to ship

Both were real bugs when this was set up, and both fail the release rather
than reaching the registry.

- **An entry point that was not built.** Every path in the generated `exports`
  must exist in the staging directory.
- **A phantom dependency.** A package that imports something only the
  _workspace root_ declares resolves fine here — npm hoists it — and is simply
  missing from a consumer's tree. Type-only imports count; they end up in the
  `.d.ts`.

## Adding a package

Nothing to wire up. Put it under `packages/` with a `package.json` and a
`tsconfig.lib.json` and it joins the next release. Declare every dependency it
imports in its **own** manifest — `pack` will not let a phantom through — and
give `react`/`react-dom` as `peerDependencies` for an admin package, matching
its siblings.

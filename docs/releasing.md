# Releasing to npm

Every package under `packages/` is published to the `@ortha-cms` scope in one
lockstep release: one version, one tag, one GitHub Release, 37 tarballs.

## Running a release

From the **Actions** tab, run the **Release** workflow. It typechecks, builds,
versions, tags, publishes, and opens the GitHub Release. Leave the version
input empty to let the conventional commits since the last tag pick the bump,
or type an explicit one (`1.2.0`, `minor`, `prerelease`). Tick **dry-run** to
rehearse the whole thing without publishing or pushing.

Locally, the same pipeline runs as:

```sh
npm run release:dry-run     # rehearse — writes nothing, publishes nothing
npm run release             # version → changelog → tag → publish → GitHub Release
npm run release:publish     # publish only, e.g. after a partly failed release
```

A local run needs `npm login` for the `@ortha-cms` scope and a `GITHUB_TOKEN`
in the environment for the GitHub Release step. The workflow is the normal
path; the local commands exist for recovery and for looking at what a release
would do.

## What is released

|            |                                                                     |
| ---------- | ------------------------------------------------------------------- |
| Scope      | every project matching `@ortha-cms/*` except `@ortha-cms/nx`        |
| Versioning | **fixed** — all packages move together, always the same version     |
| Specifier  | conventional commits (`feat:` → minor, `fix:` → patch, `!` → major) |
| Tag        | `v{version}`                                                        |
| Changelog  | one workspace-level `CHANGELOG.md`, no per-project files            |

`@ortha-cms/nx` is `private` and stays out: it is workspace tooling, wired
into this repo's `nx.json`, not something a consumer installs.

The apps (`apps/admin`, `apps/server`) are private and never publish. They are
the reference host, not a distributable.

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

# OrthaCms — Nx monorepo

- `apps/admin` — React 19 + Vite SPA (admin UI)
- `apps/server` — NestJS API
- `packages/design-system` — `@ortha-cms/design-system`, shadcn/ui library
- `packages/bootstrap/{admin,server}` — the application **hosts** that turn a
  list of plugins into a running app
  - `@ortha-cms/bootstrap-admin` — `createAdmin({ plugins })`: mounts the React
    root, router, and plugin-contributed routes
  - `@ortha-cms/bootstrap-server` — `createServer({ plugins })`: builds the
    Nest app, imports each plugin's module, applies global prefix +
    `ValidationPipe`

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
- `npx nx sync` — run after changing cross-project dependencies (updates TS project references)
- Package manager: **npm workspaces** (not pnpm/yarn)

## Conventions

- Prettier: 4-space indent, single quotes
- shadcn / design-system work is governed by the shadcn skill and
  [`packages/design-system/CLAUDE.md`](packages/design-system/CLAUDE.md)

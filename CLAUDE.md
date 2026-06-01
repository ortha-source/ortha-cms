# OrthaCms — Nx monorepo

- `apps/admin` — React 19 + Vite SPA (admin UI)
- `apps/server` — NestJS API
- `packages/design-system` — `@ortha-cms/design-system`, shadcn/ui library

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

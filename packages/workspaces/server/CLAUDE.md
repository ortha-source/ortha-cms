# @ortha-cms/workspaces-server

The **workspaces plugin** for the Ortha CMS server. It owns the read surface for
workspaces: `GET /api/workspaces` lists the workspaces the current user belongs
to, each with its embedded member roster. Read-only for now — create / update /
delete and membership mutation are later tickets.

## Package

- Name: `@ortha-cms/workspaces-server`
- Import: `import { WorkspacesPlugin } from '@ortha-cms/workspaces-server'`
- Grouped package (`packages/workspaces/server`), server-only. Consumed from
  source (`exports` → `./src/index.ts`); no build step.
- Register it in `createServer({ plugins })` **after** `IdentityPlugin` — it
  reads identity's tables and depends on identity's global `AuthGuard`.

## Key exports

- `WorkspacesPlugin()` — factory returning a `ServerPlugin` (no config).
- `WorkspacesModule` — the global NestJS module.
- `WorkspaceView` / `WorkspaceMemberView` — the read API's response shape.

## Architecture

- **Reads identity's schema; owns none.** The `workspaces`, `memberships`, and
  `users` tables live in `@ortha-cms/identity-server`, which ships their
  migrations. This plugin imports those tables from identity's barrel and
  **only reads** them — it never writes or migrates them, ships no
  `drizzle.config.ts` / `migrations/`, and attaches no `migrations` descriptor
  to its plugin factory. A schema change to those tables is an **identity**
  change. This is a deliberate coupling (the alternative — moving the schema —
  was deferred).
- **No config.** The read surface has nothing to configure, so
  `WorkspacesModule.forRoot()` and `WorkspacesPlugin()` take no argument and
  there is no config interface / token. (A deviation from the `server-plugin`
  skill's config step, which is conditional on there being config.)
- **Auth is inherited.** Identity registers a global `AuthGuard` (`APP_GUARD`),
  so the route is authenticated automatically; the controller reads the user via
  `@CurrentUser()` and scopes the list to that user's memberships. No
  `RequirePermission` (that decorator does not exist in identity yet).
- **`color` / `status` are not persisted.** They are admin-only presentation,
  derived client-side; the API returns only real columns plus the member join.
- **Two queries, grouped in memory.** `WorkspacesService.listForUser` fetches the
  user's workspaces, then their members, and stitches them — avoids a 3-way join
  repeating workspace columns per member. See the JSDoc there for the index
  rationale.

## Conventions

- `interface` for type contracts; JSDoc on every exported symbol; `import type`
  for type-only imports; no `.js` extensions in TS imports.
- DB access: `@InjectDatabase()` annotated as `Database` (not `NodePgDatabase`),
  Drizzle used directly in the service (no repository wrapper).
- Feature-then-kind layout under `src/lib/workspaces/`
  (`controllers/`, `services/`, `types/`).

## Commands

- `npm exec nx typecheck @ortha-cms/workspaces-server`
- `npm exec nx lint @ortha-cms/workspaces-server`

# Context Map

A single index of *what lives where* and *what the words mean*. When an agent or
a new engineer needs to find the right package or decode a term, start here.

## Project map

Every app and package, one line each. Each package's own `AGENTS.md` has the
detail.

### Apps (`apps/`)

| Project | Package name | What it is |
|---|---|---|
| `admin` | — | React 19 + Vite SPA. The admin UI. Composes admin plugins via `createAdmin`. |
| `server` | — | NestJS API. Composes server plugins via `createServer`. Owns `ortha.config.ts`. |
| `admin-e2e` | — | Playwright Page-Object e2e suite for the admin SPA (`/api` mocked). |
| `server-e2e` | — | In-process testcontainer + supertest e2e suite for the API. |

### Packages (`packages/`)

| Project | Package name | Role |
|---|---|---|
| `bootstrap/admin` | `@ortha-cms/bootstrap-admin` | **Host.** `createAdmin({ plugins })` — React root, router, providers. |
| `bootstrap/server` | `@ortha-cms/bootstrap-server` | **Host.** `createServer({ plugins })` — Nest app, `/api` prefix, validation. |
| `database` | `@ortha-cms/database` | **Plugin.** One Drizzle/`pg` connection via DI. Owns no schema. |
| `identity/server` | `@ortha-cms/identity-server` | **Plugin.** Auth, sessions, RBAC schema + migrations, workspaces. |
| `identity/admin` | `@ortha-cms/identity-admin` | **Plugin.** Login page + auth client state. |
| `users/server` | `@ortha-cms/users-server` | **Plugin.** Member management API (list/invite/edit/disable/sessions). |
| `users/admin` | `@ortha-cms/users-admin` | **Plugin.** Members roster, invite flow, user detail tabs. |
| `workspaces/admin` | `@ortha-cms/workspaces-admin` | **Plugin.** Workspace list + create wizard. |
| `activity/server` | `@ortha-cms/activity-server` | **Plugin.** Audit-event schema + read API. |
| `activity/admin` | `@ortha-cms/activity-admin` | **Plugin.** Global & user-scoped activity logs. |
| `shell/admin` | `@ortha-cms/shell-admin` | **Plugin.** Authenticated chrome (toolbar, layout). Defines `NAVBAR_START_SLOT`. |
| `query-builder/admin` | `@ortha-cms/query-builder-admin` | Admin filter/query-builder UI. |
| `design-system` | `@ortha-cms/design-system` | shadcn/ui component library + Tailwind. Governed by the `shadcn` skill. |
| `utils/admin` | `@ortha-cms/utils-admin` | Shared admin plumbing: `apiClient`, `queryClient`, slots, error handling. |
| `utils/server` | `@ortha-cms/utils-server` | Shared server utilities. |
| `nx` | `@ortha-cms/nx` | **Nx plugin.** Infers the `db:generate` / `db:migrate` targets. |

> Regenerate this table whenever an app or package is added/removed/renamed.

## Glossary

- **Host** — the app shell (`bootstrap-admin` / `bootstrap-server`) that turns a
  plugin list into a running app. Owns no domain logic.
- **Plugin** — a unit of capability. Admin plugins contribute routes/slots;
  server plugins contribute a NestJS module + (optionally) schema & migrations.
- **`AdminPlugin` / `ServerPlugin`** — the plugin factory + contract for each
  runtime. See [`ARCHITECTURE.md`](ARCHITECTURE.md).
- **Slot** — a named UI extension point (e.g. `NAVBAR_START_SLOT`) a plugin
  defines and others contribute into, with no direct coupling.
- **`@InjectDatabase()`** — DI token for the shared Drizzle connection from
  `@ortha-cms/database`.
- **Resolve-from-source** — workspace packages are consumed straight from
  `src/index.ts` with no build step (`@ortha-cms/source` TS condition).
- **RBAC** — role-based access control. One global role per user (`admin`,
  `contributor`, `viewer`) → permission keys (`resource:action`), enforced by
  `@RequirePermissions` + `PermissionsGuard` (server) and `useHasPermission`
  (admin).
- **Workspace** — a tenant/grouping. **Membership** — an M:N user↔workspace link.
- **Activity event** — an append-only audit row, written *in the same
  transaction* as the mutation it records.
- **`workspace_content`** — ⚠️ an access-control mapping (workspace → code-defined
  content slug), **not** a content-storage table. There is no content CMS yet.
- **ADR** — Architecture Decision Record. See [`docs/adr/`](docs/adr/README.md).

## Skills (machine-readable context)

Authoring conventions are encoded as skills under `.agents/skills/` and
`.claude/skills/`: `server-plugin`, `admin-plugin`, `accessibility`,
`admin-e2e`, `server-e2e`, `shadcn`. Prefer the skill over reverse-engineering a
convention from code.

<!-- TODO: add domain/business glossary terms (non-technical) as the product grows. -->

# Architecture

How OrthaCms is built. For the *why* behind these choices, see
[`docs/adr/`](docs/adr/README.md). For the project inventory and glossary, see
[`CONTEXT-MAP.md`](CONTEXT-MAP.md).

## 1. The big idea: a plugin host

OrthaCms is not a monolith with features bolted on. It is a small, dumb **host**
that turns *a list of plugins* into a running application. The host owns no
domain logic — no auth, no users, no content. All capability lives in plugins.

There are two hosts, one per runtime:

- **`@ortha-cms/bootstrap-admin`** — `createAdmin({ plugins })` mounts the React
  root, the router, the providers (TanStack Query, `IntlProvider`), and the
  routes each plugin contributes.
- **`@ortha-cms/bootstrap-server`** — `createServer({ plugins })` runs each
  plugin's `onPluginInit`, imports its NestJS module, and applies the global
  `/api` prefix + `ValidationPipe`.

Adding a capability = adding a plugin and registering it. You never edit the
host. Registration happens in:

- `apps/admin/src/main.tsx` — the admin plugin list
- `apps/server/src/plugins.ts` — the server plugin list

## 2. Plugins come in pairs

Most domains ship an **admin** plugin and a **server** plugin:

```
packages/<group>/admin    → AdminPlugin  (React routes, slots, layout)
packages/<group>/server   → ServerPlugin (NestJS module, schema, migrations)
```

Some are single-runtime (`design-system`, `query-builder/admin`, `database`,
`nx`). The npm name is always hyphenated regardless of nesting:
`packages/bootstrap/admin` → `@ortha-cms/bootstrap-admin`.

### Server plugin contract

```ts
interface ServerPlugin {
  name: string;
  module: Type | DynamicModule;            // the NestJS module
  onPluginInit?(): void | Promise<void>;   // setup hook, run in registration order
  migrations?: { dir: () => string; table: string }; // owned Drizzle migrations
}
```

Authoring rules live in the **`server-plugin`** skill: the `ServerPlugin`
factory + dynamic-module pattern, feature-then-kind folder layout
(`feature/{controllers,services,dto,errors,types}`), `@InjectDatabase()` DI,
config injection, and the schema/migrations descriptor.

### Admin plugin contract

```ts
type AdminPlugin = {
  name: string;
  routes?: RouteItem[];          // React Router routes (lazy / code-split)
  layout?: ReactNode;            // optional authenticated shell
  slots?: SlotContribution[];    // contributions to named extension points
};
```

Authoring rules live in the **`admin-plugin`** skill: the per-module
`<name>/index.ts(x)` layout, lazy routes, the per-hook data layer
(`apiClient` + TanStack Query, each hook owning its request fn),
`useHasPermission` gating, and co-located `react-intl` messages.

## 3. Packages resolve from source

Workspace packages are consumed **without a build step**. Their `exports` point
at `./src/index.ts`, and `tsconfig.base.json` sets
`customConditions: ["@ortha-cms/source"]`. The admin app's Vite transpiles
design-system (and every other package's) source directly. Run `npx nx sync`
after changing cross-project dependencies to update TS project references.

## 4. The data layer

- **One connection.** `packages/database` (`@ortha-cms/database`) owns a single
  Drizzle/`pg` pool, opened in its `onPluginInit` (which must run first). It is
  exposed via DI (`@InjectDatabase()`, a global `DatabaseModule`) and via plain
  `getDatabase()` / `getPool()`. It owns **no schemas and no migrations**.
- **Each plugin owns its schema + migrations.** e.g. `identity/server` owns the
  auth/RBAC tables in `src/lib/schema` and ships committed SQL in `migrations/`
  with its own `drizzle.config.ts`. Generate per-plugin
  (`nx run <plugin>:db:generate --name=<name>`); the host applies all pending
  migrations (`nx run server:db:migrate`).
- **Migration tooling** is provided by the `@ortha-cms/nx` workspace plugin,
  which infers the `db:generate` / `db:migrate` targets.

## 5. Request flow (admin → API → DB)

1. A user action fires a TanStack Query mutation via the shared `apiClient`
   (axios, `/api` base URL).
2. The NestJS server receives it. A global **`AuthGuard`** validates the
   session (DB-backed, revocable, httpOnly cookie).
3. **`PermissionsGuard`** + `@RequirePermissions('users:read')` enforce RBAC
   (roles → permissions). State-changing POSTs additionally pass an
   **`OriginGuard`** (CSRF defense).
4. The service runs the mutation, often in a transaction, and records an audit
   row via `ActivityService.record(...)` **using the same transaction** — so
   the audit commits if and only if the mutation does.
5. The response returns; React Query updates client state.

## 6. Extension points (admin slots + server DI ports)

Two parallel mechanisms let a plugin extend another with **no direct coupling**:

**Admin — named slots.** Plugins contribute UI into slots defined by other
plugins, as pure data. Example: `shell` defines `SIDEBAR_NAV_SLOT`; the
workspaces, users, and activity plugins each register nav entries into it (and
the workspace shell defines `WORKSPACE_NAV_SLOT` / `WORKSPACE_SECTION_SLOT` for
its interior). Slots are wired once at boot (`slot._register(items)`) and read
sorted by consumers (`slot.getItems()`). The shell's sidebar also has a
route-scoped **dynamic region** (`useSidebarContent`) the workspace shell takes
over — a runtime override alongside the boot-time slots. The Content Library
defines five of its own (records toolbar/columns/filter-fields, entry
sidebar/params) that `i18n/admin` fills — because slots are **boot-frozen**, an
item may even expose a hook the render site calls in a loop.

**Server — DI ports (inversion).** The *depended-upon* plugin declares a
`Symbol` token + interface and injects it `@Optional()`; the *implementing*
plugin binds it in its module. identity declares `CONTENT_CATALOG` /
`ACTIVITY_RECORDER` (bound by content / activity); content declares
`CONTENT_ENTRY_EXTENSION` (bound by `i18n/server` to add row-per-locale scoping,
create stamping, shared-field sync, and locale filters to the entries pipeline
without content knowing what a locale is). Keeps the package graph acyclic.

## 7. Security posture (today)

- Sessions: DB-backed, revocable, signed token in an httpOnly cookie.
- Passwords: bcrypt. Invite/reset tokens: SHA-256 hashed at rest.
- Login is rate-limited (`@nestjs/throttler`).
- RBAC is a single global role per user (`admin` / `contributor` / `viewer`);
  memberships are M:N workspace links (no per-workspace role yet).

## 8. What does **not** exist yet

Worth knowing before you plan: there is **no content model** (articles, pages,
media, fields, drafts/versions) — `workspace_content` is an access-control map,
not content storage. There is no queue/worker, no search, no embeddings, no
websockets/streaming, and no LLM integration. See the AI-native research notes
if that roadmap is in scope.

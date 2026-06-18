---
name: server-plugin
description: Authoring, modifying, or reviewing an Ortha CMS NestJS server plugin (packages/<group>/server, e.g. identity-server). Covers the ServerPlugin factory + dynamic-module pattern, feature-then-kind folder layout, @InjectDatabase DI, config injection, Drizzle schema + migrations descriptor, lifecycle hooks, and the review-critical authorization/data-integrity invariants (permission-by-constant guards, lock contended invariants instead of count-then-write, preserve filters/validation when consolidating endpoints, no enumeration signal). Use when creating a new server plugin, adding controllers/services/schema/DTOs, or reviewing a change to one.
user-invocable: false
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(npx nx *), Bash(npm exec nx *), Bash(npm install), Bash(git mv *)
---

# Ortha CMS server plugins

A **server plugin** is a workspace package under `packages/<group>/server` (e.g.
`packages/billing/server` → `@ortha-cms/billing-server`) that contributes
features to the NestJS API. It is **not an app**: it exports a factory the host
(`@ortha-cms/bootstrap-server`) assembles into a running server.

> **Reference implementation:** `packages/identity/server` is the fullest
> worked example in the repo — when a detail here is unclear, read it. The
> examples below use a made-up `widgets` plugin so they describe the _shape_,
> not any one implementation.

> Plugins are consumed **from source** (`exports` → `./src/index.ts`,
> `customConditions: ["@ortha-cms/source"]`). No build step; the host transpiles
> the plugin's TS directly. Never add a build to consume a plugin.

## When this applies

- Creating a new `packages/<group>/server` plugin.
- Adding a controller, service, DTO, schema table, or migration to an existing
  plugin.
- Wiring a plugin into the host (`apps/server/src/plugins.ts`).

---

## The five non-negotiables

1. **A plugin is a `ServerPlugin` factory**, not a module you import directly.
2. **One global dynamic module per plugin** (`XModule.forRoot(config)`).
3. **Group code by feature, then by kind within each feature.**
4. **The DB client is injected from `@ortha-cms/database`** — a plugin never
   opens a connection or registers a db provider.
5. **Config is injected, never read from `process.env`.** Only
   `apps/server/ortha.config.ts` reads the environment.

---

## Folder layout — group by feature, then by kind

Each domain owns **one folder** under `src/lib/`; **inside** it, files are
bucketed by kind — `controllers/`, `services/`, `guards/`, `seeders/`, `dto/`,
`errors/` — one class per file:

```
packages/<group>/server/
  src/
    index.ts                       # public barrel — the package's API
    lib/
      <plugin>.module.ts           # the one dynamic module
      <plugin>.tokens.ts           # DI tokens (dependency-free)
      widgets/                     # ← a FEATURE folder, grouped by kind inside
        controllers/
          create-widget.controller.ts
          list-widgets.controller.ts
        services/
          widget.service.ts
        guards/
          widget-owner.guard.ts
        seeders/                   # OnApplicationBootstrap providers (+ their helpers)
          widget-defaults.seeder.ts
        dto/
          create-widget.dto.ts
        errors/                    # one error class per file, fronted by index.ts
          widget-not-found.error.ts
        widget.constants.ts        # non-class feature DATA stays at feature root
      reports/                     # ← another feature folder
        services/
          report.service.ts
        report.constants.ts
      schema/                      # Drizzle tables + barrel
      types/                       # shared, public type contracts
      utils/                       # PACKAGE-LEVEL cross-cutting only
        <plugin>-plugin.ts         # the factory — the one thing that belongs here
  drizzle.config.ts                # only if the plugin owns schema
  migrations/                      # committed SQL (only if it owns schema)
  package.json
  tsconfig.json / tsconfig.lib.json
  CLAUDE.md
```

**Feature first, kind second.** A logical change still stays inside one feature
folder; the kind-subfolders keep that folder navigable as it grows ("all
services" = `widgets/services/`). Each typed building block gets a folder —
`controllers/`, `services/`, `guards/`, `seeders/`, plus the standing
`dto/` and `errors/` (the latter fronted by an `index.ts` barrel). Use a folder
even at one file, for consistency across features.

**What stays at the feature root.** Non-class feature **data** — constants, a
role/permission matrix, a pure helper used only by that feature — lives directly
in the feature folder (`widgets/widget.constants.ts`), not in a kind-subfolder.
Kind-folders are for the typed components (controllers/services/guards/seeders),
not for every file.

**Package-level vs feature.** `src/lib/utils/` is for **package-level**
cross-cutting only (the plugin factory); the module + tokens sit at `src/lib/`
root; `schema/` and `types/` are package-level folders.

---

## Creating a new plugin — step by step

### 1. `package.json`

```jsonc
{
    "name": "@ortha-cms/<group>-server",
    "version": "0.0.1",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "exports": {
        ".": {
            "types": "./src/index.ts",
            "import": "./src/index.ts",
            "default": "./src/index.ts"
        },
        "./package.json": "./package.json"
    },
    "files": ["src", "migrations"], // drop "migrations" if no schema
    "dependencies": {
        "@nestjs/common": "^11.0.0",
        "@ortha-cms/bootstrap-server": "*",
        "@ortha-cms/database": "*", // only if DB-backed
        "drizzle-orm": "^0.36.0", // only if DB-backed
        "class-validator": "^0.15.1" // only if it has DTOs
    },
    "devDependencies": {
        "drizzle-kit": "^0.31.0" // only if it owns schema
    }
}
```

Match versions to existing packages (grep the repo) rather than inventing them.
The npm name stays **hyphenated** regardless of the nested folder
(`packages/<group>/server` → `@ortha-cms/<group>-server`).

### 2. Config contract + token

Config is part of the plugin's public, SemVer'd API. Define the interface in
`src/lib/types/`, and a **dependency-free** token module so providers reference
it without an import cycle with the module:

```ts
// src/lib/<plugin>.tokens.ts
import { Inject } from '@nestjs/common';
export const X_CONFIG = Symbol('X_CONFIG');
export const InjectXConfig = (): ParameterDecorator => Inject(X_CONFIG);
```

The host supplies the values from `apps/server/ortha.config.ts`
(`plugins.<name>`), which is the **only** reader of `process.env`.

### 3. The dynamic module

```ts
// src/lib/<plugin>.module.ts
@Module({})
export class XModule {
    static forRoot(config: XPluginConfig): DynamicModule {
        return {
            module: XModule,
            global: true, // services injectable from any plugin
            controllers: [
                /* feature controllers */
            ],
            providers: [
                { provide: X_CONFIG, useValue: config }
                /* feature services, OnApplicationBootstrap providers */
            ],
            exports: [X_CONFIG /*, services other plugins inject */]
        };
    }
}
```

`global: true` is the norm — a plugin's services are then injectable from
anywhere without re-importing the module.

### 4. The plugin factory (the package's entry point)

```ts
// src/lib/utils/<plugin>-plugin.ts
export interface XServerPlugin extends ServerPlugin {
    xConfig: XPluginConfig;
}

export function XPlugin(config: XPluginConfig): XServerPlugin {
    return {
        name: 'x',
        module: XModule.forRoot(config),
        xConfig: config,
        // ONLY if the plugin owns schema — the host's db:migrate reads this:
        migrations: {
            dir: () => join(__dirname, '../../../migrations'),
            table: '__drizzle_migrations_x' // a per-plugin migrations table
        }
    };
}
```

### 5. Barrel — `src/index.ts`

Export the public API only: the `XPlugin` factory + its plugin type, the config
types, the module, the schema, and any service/type a **consumer outside the
package** injects. Keep internals (tokens, feature errors used only internally)
out of the barrel until something external needs them.

### 6. Register with the host

```ts
// apps/server/src/plugins.ts — order matters: DatabasePlugin first
return [
    DatabasePlugin({ connectionString: config.database.url }),
    XPlugin(config.plugins.x)
];
```

Add the typed config block to `apps/server/ortha.config.ts` under
`plugins.x`, env-sourced, with literals for stable tuning.

### 7. Wire it up

```bash
npx nx sync                               # after changing cross-project deps
npx nx run-many -t typecheck lint -p @ortha-cms/<group>-server server
```

---

## Database access

Inject the shared Drizzle client — **never** register your own:

```ts
import { InjectDatabase, type Database } from '@ortha-cms/database';

@Injectable()
export class WidgetService {
    constructor(@InjectDatabase() private readonly db: Database) {}
}
```

- Annotate as **`Database`** (the alias owned by `@ortha-cms/database`), not
  `NodePgDatabase` — a dialect change then stays a one-line edit there.
- **Use Drizzle directly in services.** This repo deliberately has **no
  repository-pattern wrapper** — generic NestJS guides add one; we don't.
- pg-specific methods (`onConflictDoNothing`, `lower(...)` via `sql`) are fine;
  they're inherently dialect-bound and that's accepted.

## Schema & migrations (only for DB-backed plugins)

- Tables in `src/lib/schema/*.ts` (Drizzle `pg-core`), re-exported through a
  `schema/index.ts` and the package barrel.
- A plugin **owns its schema and migration files**; it does **not** apply them.
- `drizzle.config.ts` at the package root + committed `migrations/`.
- Generate per-plugin, apply from the host:

```bash
npx nx run @ortha-cms/<group>-server:db:generate --name=<change>   # commit the SQL
npx nx run server:db:migrate                                       # applies all plugins
```

## Lifecycle

- **`OnApplicationBootstrap` provider** — for boot work that needs the DB client
  (seeding, idempotent bootstrap). The client is **injected** via DI; the hook
  runs inside `app.init()`, so a failure aborts boot before serving. This is the
  default (the reference plugin's seeder follows this pattern).
- **`onPluginInit?()`** on the `ServerPlugin` — runs **before** the Nest app
  exists, for opening resources other plugins depend on at construction time
  (only `@ortha-cms/database` needs this). Most plugins leave it unused.

## Controllers, DTOs, validation, errors

> Every controller you add here needs an **e2e suite** in `apps/server-e2e`
> exercising it end-to-end (happy path, authn/authz, validation, guards, side
> effects). That harness is governed by the **`server-e2e`** skill.

- Controllers are **thin**: parse, delegate to a service, map the result. They
  sit under the host's global **`api`** prefix, so `@Controller('widgets')` →
  `/api/widgets/...`.
- **One controller per use case, not a fat resource controller.** Split when
  endpoints diverge in purpose or dependencies — e.g. a `CreateWidgetController`
  (`@Post()`) and a `ListWidgetsController` (`@Get()`) each sharing
  `@Controller('widgets')` (NestJS allows multiple controllers on one prefix; no
  routing conflict). Group only a genuine CRUD resource (list/get/create/delete
  of one thing) into a single controller. Register each in the module's
  `controllers: []`.
- **Isolate transport in a dedicated service; domain services stay
  transport-agnostic.** Express-touching glue (cookies, header parsing) belongs
  in its own injectable service (e.g. a `CookieService` that injects config and
  exposes `setSession(res, …)` / `readSession(req)`), so `AuthService` and the
  like never see `req`/`res`. A dedicated transport service is the _right_ home
  for that glue — the "no `req`/`res`" rule is about **domain** services, not a
  ban on the concept.
- **Reusable primitives are injectable services, not free functions.** Wrap
  things like password/token hashing in a `HashingService` rather than exporting
  loose functions — one tested, mockable provider that call sites inject. Keep
  flow-specific policy (e.g. a login's dummy-hash timing trick) in the service
  that owns the flow, not the primitive.
- DTOs use `class-validator` decorators (`@IsString()`, `@IsInt()`, ...). The
  host already applies a strict global `ValidationPipe`
  (`whitelist` + `forbidNonWhitelisted` + `transform`) in `create-server.ts` —
  **do not** re-register a pipe; just decorate the DTO.
- Domain errors are **transport-agnostic classes**, one per file under
  `<feature>/errors/` (e.g. a `WidgetNotFoundError`); the controller maps them
  to HTTP (`NotFoundException`, etc.). Keep security-sensitive responses generic
  — no enumeration signal.

---

## Authorization & data-integrity invariants

The cross-cutting rules that are easy to get subtly wrong — and the first thing a
careful review checks:

- **Guard every route with a permission, by constant.** Each controller carries
  `@RequirePermissions(PERMISSIONS.X)` using the role matrix's **exported
  constants**, never a raw `'users:read'` literal (a literal silently goes stale
  when a key is renamed — no compile error, the guard just checks a permission no
  role grants). The admin mirrors each with a `useHasPermission` gate, but the
  server is the only real enforcer.
- **Lock contended invariants; don't count-then-write.** A "last active admin",
  "sole owner", "at least one X" rule must read the contended rows `FOR UPDATE`
  (or run the transaction `serializable`) **before** deciding. A bare `count()`
  inside a transaction is **not** race-safe under READ COMMITTED — two
  simultaneous demotions each read the old count, both pass, both commit, and the
  invariant is breached. A JSDoc claiming "the transaction makes this safe" does
  not make it so.
- **Preserve behaviour when an endpoint is consolidated.** Replacing a
  specialized endpoint with a shared one must carry over **every** filter and
  bound it enforced — a `status = 'active'` filter on an assignable-member list,
  a `@MaxLength` on a search term. A silently widened query is a regression no
  type catches: e.g. a shared `GET /users` that backs a member picker and starts
  surfacing pending/disabled accounts as assignable.
- **No enumeration signal** in security-sensitive responses (also under
  Controllers) — keep "this email exists" out of distinguishable errors/timing.
- **Record audit events in-band, not after the fact.** A state-changing
  operation that's audit-worthy records via the `ACTIVITY_RECORDER` token (or
  `ActivityService` for a plugin that may depend on activity), passing the
  mutation's `tx` as the executor — so the audit row commits iff the mutation
  does. Recording out-of-band (post-commit, or via an event emitter) means a
  rolled-back mutation can still leave an audit row, or a committed one can
  silently drop it. Each plugin owns its own kinds. See
  [`packages/activity/server/CLAUDE.md`](../../../packages/activity/server/CLAUDE.md).

## TypeScript conventions (match the existing packages)

- `interface` for type contracts, not `type`.
- **JSDoc on every exported symbol.**
- No `.js` extensions in TS imports.
- Import types with the `type` keyword (`import { type Database }`).
- `experimentalDecorators` + `emitDecoratorMetadata` are on.
- Prettier: 4-space indent, single quotes.

## Cross-origin / cookies (for plugins that set cookies)

The admin app and API run on different origins in dev. The settled approach is a
**same-origin dev proxy** — `apps/admin/vite.config.mts` proxies `/api` to the
API port, keeping cookies first-party (`SameSite=lax`) with no CORS. Only if a
plugin needs true cross-origin should a `cors` option be added to `createServer`
(a host transport concern), never inside the plugin.

---

## New-plugin checklist

- [ ] `packages/<group>/server` with `package.json` (`@ortha-cms/<group>-server`,
      source `exports`, hyphenated name).
- [ ] `tsconfig.json` / `tsconfig.lib.json` mirroring an existing plugin.
- [ ] Config interface in `types/`, token module (`<plugin>.tokens.ts`).
- [ ] `XModule.forRoot()` (`global: true`).
- [ ] Plugin factory in `utils/<plugin>-plugin.ts` (+ `migrations` descriptor if
      DB-backed).
- [ ] Feature folders for each domain (no layer folders).
- [ ] Every controller `@RequirePermissions(PERMISSIONS.*)` (constants, not
      literals), with a matching admin `useHasPermission` gate.
- [ ] Concurrency-sensitive invariants locked (`FOR UPDATE` / serializable), not
      a `count()` inside a transaction; consolidated endpoints keep prior
      filters + validation.
- [ ] State-changing endpoints record an audit event in-band (mutation's `tx` as
      the executor) when the action is audit-worthy.
- [ ] Public barrel `src/index.ts`.
- [ ] Schema + `drizzle.config.ts` + `migrations/` if DB-backed.
- [ ] Registered in `apps/server/src/plugins.ts` (after `DatabasePlugin`) and
      `ortha.config.ts`.
- [ ] A `CLAUDE.md` for the package documenting its decisions.
- [ ] An **e2e suite** in `apps/server-e2e` for any controller it adds — see the
      `server-e2e` skill.
- [ ] `npx nx sync` then `typecheck` + `lint` green; `nx build server` if it has
      controllers.

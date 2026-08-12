# @ortha-cms/bootstrap-server

The server-side **host** for the Ortha CMS. Turns a list of plugins into a
running NestJS app. Owns the cross-cutting wiring that must exist exactly once;
contains no features.

## Package

- Name: `@ortha-cms/bootstrap-server`
- Import: `import { createServer, type ServerPlugin } from '@ortha-cms/bootstrap-server'`
- Server-only. Consumed from source like the other workspace packages.
- Lives at `packages/bootstrap/server` (grouped layout); npm name stays
  hyphenated.

## Conventions

- Uses `interface` for type contracts (not `type`)
- All exported symbols have JSDoc comments
- No `.js` extensions in TypeScript imports
- Types/interfaces go in `src/lib/types/`; plain functions in `src/lib/utils/`;
  the NestJS module in `src/lib/`
- Always import types with the `type` keyword
- `experimentalDecorators` and `emitDecoratorMetadata` are enabled

## Key exports

- `createServer(options)` — bootstraps the app: runs plugin init hooks, imports
  plugin modules, applies global prefix + `ValidationPipe`, generates the
  OpenAPI document + mounts the Scalar reference, listens
- `ServerModule` — dynamic root module; `forRoot(plugins)` imports every
  plugin's module
- `ServerPlugin` — the plugin contract: `{ name, module, onPluginInit? }`
- `CreateServerOptions` — `{ plugins, port?, globalPrefix?, trustProxy?, docs? }`
- `TrustProxySetting` — Express's `trust proxy` value: a hop count, a boolean,
  or a subnet/preset string
- `setupApiDocs(app, plugins, docs?, globalPrefix?)` — the API-reference wiring,
  exported for a host that builds its own `INestApplication`
- `ApiDocsOptions` / `PluginApiDocs` / `ApiSecurityScheme` — the docs contracts

## Architecture

- **Construct + assemble.** `createServer` is the single place the Nest app is
  created. `ServerModule.forRoot(plugins)` collects each plugin's `module` into
  one root module.
- **Lifecycle.** Before `NestFactory.create`, `createServer` runs each plugin's
  `onPluginInit()` **in array order**. This is the hook a plugin uses for setup
  that must complete before the app boots (e.g.
  [`@ortha-cms/database`](../../database/AGENTS.md) opens its connection here).
  Order matters: list resource-providing plugins (database) first.
- **Global policy, once.** The `api` prefix and the strict `ValidationPipe`
  (`whitelist` + `forbidNonWhitelisted` + `transform`) are configured here so no
  plugin repeats them.
- **Proxy trust, once.** `trustProxy` is applied to the Express adapter before
  the prefix, because it decides what `req.ip` resolves to — and a plugin that
  rate-limits or audits by client address is only as correct as that. Unset by
  default: Express then ignores `X-Forwarded-For`, which is right for a
  directly-exposed server and **wrong behind any proxy**, where every caller
  reports the proxy's address and identity's login throttle degenerates into one
  global bucket. Deployments set `TRUST_PROXY` to their hop count. Never trust a
  chain you don't terminate — a spoofable `X-Forwarded-For` makes the limit one
  header away from bypassable.
- **API docs, once.** `setupApiDocs` (`utils/setup-api-docs.ts`) runs after the
  prefix + pipe and before `listen`, so the document describes the real URLs.
  See below.

## API reference (OpenAPI + Scalar)

`createServer` generates the OpenAPI document from the assembled app
(`@nestjs/swagger`) and serves it as a [Scalar](https://scalar.com) API
reference. Two routes, registered on the **http adapter** rather than the Nest
router — so they sit outside the global prefix, outside every guard, and outside
the `ValidationPipe`:

- `GET /reference` — the Scalar UI (HTML that loads Scalar's standalone bundle
  from a CDN and renders the embedded document client-side; point `docs.cdn` at
  a self-hosted copy for an air-gapped deployment)
- `GET /reference/json` — the raw OpenAPI 3.0 document, for codegen

Both paths are configurable (`docs.path` / `docs.jsonPath`). The JSON route is
registered **first**, so it still wins when it lives under the UI mount.

- **Off in production by default.** `docs.enabled` defaults to
  `NODE_ENV !== 'production'`; the host overrides it from `API_DOCS`.
- **Grouped by resource, not by controller.** `autoTagControllers` is disabled
  and `tagByResource` tags each operation with the first route segment after the
  prefix (`/api/content/post` → `content`). The codebase runs one controller per
  use case, so the default would produce ~50 one-operation groups.
- **Schemas come from the DTOs.** The swagger CLI plugin is **not** wired (the
  server builds with webpack + `tsc`), so nothing is inferred: every DTO
  property carries an explicit `@ApiProperty`/`@ApiPropertyOptional`. A new
  property without one is silently absent from the docs — see the
  `server-plugin` skill.
- **Auth is plugin-described.** The host has no guards, so it doesn't invent
  security schemes: a plugin declares its own through `ServerPlugin.docs`
  (`securitySchemes` + `defaultSecurity`), and `setupApiDocs` merges every
  plugin's contribution. `@ortha-cms/identity-server` contributes the
  `ortha_session` cookie and the bearer API token.
- **A plugin with a dynamic contract describes itself.** `ServerPlugin.docs`
  also takes a `decorate(document)` hook, run last (after tagging), in
  registration order. It exists because the scanner only sees static
  TypeScript: `@ortha-cms/content-server` serves every code-defined content type
  through one generic controller set, so it uses this hook to add a schema per
  registered type and attach them to its own routes — see that package's
  `AGENTS.md`. A plugin amends only what it owns; the document is shared.

## Configuration

Options flow from `apps/server/ortha.config.ts` (the single reader of
`process.env`) into `createServer`:

```typescript
// apps/server/src/main.ts
createServer({
    plugins: [DatabasePlugin({ connectionString: config.database.url })],
    port: config.port,
    globalPrefix: config.globalPrefix,
    trustProxy: config.trustProxy,
    docs: config.docs
});
```

## Not owned here (deferred until a plugin needs it)

- Auth guards / sessions, a plugin registry, nav/permission concerns
- Per-operation API docs (summaries, response schemas): the host generates the
  document, but `@ApiOperation`/`@ApiResponse` belong on the plugins' controllers
- Lifecycle beyond `onPluginInit` (no shutdown hook yet)
- Actual endpoints — those live in feature plugins' modules

## Commands

- `npm exec nx typecheck @ortha-cms/bootstrap-server`
- `npm exec nx build @ortha-cms/bootstrap-server`

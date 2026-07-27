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
  plugin modules, applies global prefix + `ValidationPipe`, mounts the API
  reference, listens
- `ServerDocsConfig` — the API-reference options (`enabled` / `path` / `version`)
- `ServerModule` — dynamic root module; `forRoot(plugins)` imports every
  plugin's module
- `ServerPlugin` — the plugin contract: `{ name, module, onPluginInit? }`
- `CreateServerOptions` — `{ plugins, port?, globalPrefix? }`

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

## Configuration

Options flow from `apps/server/ortha.config.ts` (the single reader of
`process.env`) into `createServer`:

```typescript
// apps/server/src/main.ts
createServer({
    plugins: [DatabasePlugin({ connectionString: config.database.url })],
    port: config.port,
    globalPrefix: config.globalPrefix
});
```

## API reference / playground (Scalar)

`createServer` mounts a [Scalar](https://scalar.com) reference over an OpenAPI
document generated from the **live app** at boot — so it can never drift from the
routes actually mounted, and there is no spec file to maintain.

**Two references, because there are two APIs with different callers:**

| path | API | credential |
| --- | --- | --- |
| `/docs` | Admin API — content, media, workspaces, users | `ortha_session` cookie |
| `/docs/public` | External content API (`/api/v1/...`) | `Authorization: Bearer` |

Each also serves its raw spec at `<path>/openapi.json`, for codegen or a client.

- **The split is by route prefix, not Nest module.** The public content
  controllers live in the same `ContentModule` as the admin ones, so
  `SwaggerModule`'s `include` cannot separate them: one document is generated and
  partitioned on `/{prefix}/v1/` (`mount-docs.ts`).
- **Security is stamped per partition**, not by decorating ~40 controllers with
  `@ApiSecurity` — which credential a route wants is exactly what the partition
  already decides. Without the stamp the playground's auth box would apply to
  nothing.
- **Mount order is load-bearing**: `app.use(path, …)` matches by *prefix*, so
  `/docs` would also catch `/docs/public`. The specific routes register first.
- **Off in production by default** (`docsEnabled`): the page is a map of every
  route and auth scheme, so publishing it is opt-in via `API_DOCS=true`.
  `API_DOCS_PATH` moves it.

### Known limitation — thin request schemas

Operations currently document **path params only**. Query DTOs
(`@Query() q: ListEntriesQueryDto`) and request bodies are erased at runtime, so
`?fields=`, `?filter=`, `?page=` and every POST body are absent from the spec and
can't be filled in from the playground.

The usual fix — the `@nestjs/swagger` CLI plugin as a TS transformer — **does not
work in this workspace**: the build compiles through ts-loader against TypeScript
**project references**, and a custom transformer in that setup makes tsc emit
nothing (`TypeScript emitted no output for main.ts`). It was tried and reverted.

Two ways forward, neither blocking the reference's usefulness today:

1. Add explicit `@ApiPropertyOptional()` to the DTO fields that matter, starting
   with `ListEntriesQueryDto`. No build change; couples plugin DTOs to
   `@nestjs/swagger` the way they already couple to `class-validator`.
2. Change the build so the transformer can run (e.g. SWC, or dropping references
   for this target) — larger blast radius, affects every server package.

## Not owned here (deferred until a plugin needs it)

- Auth guards / sessions, a plugin registry, nav/permission concerns
- Lifecycle beyond `onPluginInit` (no shutdown hook yet)
- Actual endpoints — those live in feature plugins' modules

## Commands

- `npm exec nx typecheck @ortha-cms/bootstrap-server`
- `npm exec nx build @ortha-cms/bootstrap-server`

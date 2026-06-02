# @ortha-cms/identity-server

The identity **plugin** for the Ortha CMS server. It is the foundational
package: it answers *"who is this person?"* (authentication) and *"what are they
allowed to do?"* (roles & access control). Invite-only by design — there is no
public registration.

This package is currently **scaffolding only** (epic #3, ticket #4): a no-op
plugin that registers cleanly so later tickets (schema, roles, auth, sessions,
tokens, user management, bootstrap) each have a home.

## Package

- Name: `@ortha-cms/identity-server`
- Import: `import { IdentityPlugin } from '@ortha-cms/identity-server'`
- Grouped package (`packages/identity/server`), server-only. Consumed from
  source like the other workspace packages (`exports` → `./src/index.ts`,
  `customConditions: ["@ortha-cms/source"]`).

## Conventions

- Uses `interface` for type contracts (not `type`)
- All exported symbols have JSDoc comments
- No `.js` extensions in TypeScript imports
- Plain functions go in `src/lib/utils/`; the NestJS module in `src/lib/`;
  types in `src/lib/types/`
- Always import types with the `type` keyword
- `experimentalDecorators` and `emitDecoratorMetadata` are enabled

## Key exports

- `IdentityPlugin(config)` — factory returning a `ServerPlugin`; register it
  **after** `DatabasePlugin` (identity is DB-backed)
- `IdentityPluginConfig` — secrets + session/token settings (public contract)
- `IdentityServerPlugin` — the plugin shape, with `identityConfig` attached
- `IdentityModule` — global NestJS module; currently provides only the config

## Architecture

- **Plugin, not an app.** Mirrors `@ortha-cms/database`: exposes
  `IdentityPlugin(config)` returning the standard
  [`ServerPlugin`](../../bootstrap/server/src/lib/types/server-plugin.ts) shape,
  wired by the host in `apps/server/src/main.ts`.
- **Global DI.** `IdentityModule.forRoot(config)` is `global: true`, so future
  identity services are injectable from any plugin module without an import. The
  resolved config is provided under an internal `IDENTITY_CONFIG` token (not yet
  exported — kept out of the public surface until a consumer injects it).
- **Lifecycle.** `onPluginInit` is currently absent; role seeding (FR-6) and
  idempotent first-admin bootstrap (FR-10) attach there in later tickets.

## Decisions (recorded for the epic)

- **DB-client acquisition (§5).** Identity depends only on the Drizzle **client
  type** (`NodePgDatabase`), never on `@ortha-cms/database`. Chosen: identity
  defines **its own DI token** and the host supplies the client. No client is
  wired in this scaffold — the token + provider land in the schema ticket (#5).
  Rejected: reusing `DATABASE_TOKEN` (runtime coupling to the database *plugin*,
  violating §5).
- **Cross-origin cookies (deferred to #8).** Admin (`:4200`) and API (`:3000`)
  are different origins, and `createServer` configures no CORS. The
  `cookieSameSite` default (`lax`) assumes a **same-origin deployment or a dev
  proxy** (preferred — proxy `/api` → `:3000` in `apps/admin/vite.config.ts`).
  The alternative is separate origins with CORS — if taken, a `cors` option
  belongs on `createServer` (host transport concern), not here. The login ticket
  (#8) owns this decision.
- **Secrets.** `sessionSecret` and `tokenSecret` are kept **distinct** by
  design. They may be empty at boot in this scaffold (no signing yet);
  **fail-fast validation must be added when signing is introduced** (#8/#10).

## Not owned here

- **DB connection / migration *execution*** — receives a Drizzle client; owns
  neither the connection nor the apply step (the host + `@ortha-cms/nx`'s
  `db:migrate` do that). Identity **does** own its schema and migration *files*
  (`src/lib/schema`, `drizzle.config.ts`, the committed `migrations/`), which
  `db:generate` produces.
- **Email / SMTP** — identity emits events / exposes a port; the host delivers
  (#11).
- **CLI** — `bootstrapFirstAdmin(...)` will be a plain method taking the DB
  client; no argv, prompts, or console output (#16).

## Configuration

Config flows from `apps/server/ortha.config.ts` (`plugins.identity`, env-sourced)
into the plugin:

```typescript
// apps/server/src/main.ts
createServer({
    plugins: [
        DatabasePlugin({ connectionString: config.database.url }),
        IdentityPlugin(config.plugins.identity)
    ]
});
```

## Commands

- `npm exec nx typecheck @ortha-cms/identity-server`
- `npm exec nx lint @ortha-cms/identity-server`

# @ortha-cms/database

The database **plugin** for the Ortha CMS server. Owns a single Drizzle ORM
connection (over the `pg` driver) and makes it available to every other plugin.
It also ships the shared **tactical-DDD primitives** every bounded context
builds on: the `DomainEvent` envelope, the `UnitOfWork` transaction boundary,
and the transactional **outbox** (`OutboxWriter` + `OutboxDispatcher`).

This is **infrastructure only** — there is no domain layer here. Feature
plugins own their own tables; this package owns **exactly one** table, the
`outbox_events` outbox (the sanctioned exception to "database owns no schema",
because the outbox is cross-cutting infrastructure, not any one domain's data).

## Package

- Name: `@ortha-cms/database`
- Import: `import { DatabasePlugin, InjectDatabase } from '@ortha-cms/database'`
- Server-only (no admin counterpart). Consumed from source like the other
  workspace packages.

## Conventions

- Uses `interface` for type contracts (not `type`)
- All exported symbols have JSDoc comments
- No `.js` extensions in TypeScript imports
- Plain functions go in `src/lib/utils/`; the NestJS module in `src/lib/`;
  types in `src/lib/types/`
- Always import types with the `type` keyword
- `experimentalDecorators` and `emitDecoratorMetadata` are enabled

## Key exports

- `DatabasePlugin(config)` — factory returning a `ServerPlugin`; opens the
  connection in `onPluginInit`
- `DatabasePluginConfig` — `{ connectionString }`
- `Database` — the Drizzle client type the plugin exposes. **Annotate injected
  clients with this**, not the dialect-specific `NodePgDatabase`, so a dialect
  change is a one-line edit in this package.
- `DatabaseServerPlugin` — the plugin shape, with `databaseConfig` attached
- `initDatabase` / `getDatabase` / `getPool` — the connection singleton
- `DatabaseModule` — global NestJS module providing the Drizzle instance
- `DATABASE_TOKEN` — DI token for the Drizzle instance
- `InjectDatabase` — parameter decorator (`@InjectDatabase()`)
- `DomainEvent` / `createDomainEvent` / `CreateDomainEventParams` — the
  framework-free event envelope and its builder (fills `eventId` + `occurredAt`)
- `DomainEventSubscriber` / `DOMAIN_EVENT_SUBSCRIBERS` — the reactor contract
  and its (default-empty) DI token
- `UnitOfWork` — the transaction-boundary primitive (`run` / `current`)
- `OutboxWriter` — appends events to the outbox in the ambient transaction
- `OutboxDispatcher` — drains the outbox and delivers to subscribers
- `outboxEvents` — the outbox Drizzle table

## Tactical-DDD primitives

These are provided by `DatabaseModule.forRoot()` (global), so any plugin
injects them without importing the module.

- **`DomainEvent`** — a pure-TS envelope: `eventId`, `kind`, `aggregateType`,
  `aggregateId`, `occurredAt`, `payload`. Mint with `createDomainEvent(...)`.
- **`UnitOfWork`** — `run(fn)` executes `fn` inside one transaction; a nested
  `run` **joins** the outer transaction (no new one). Repositories call
  `current()` to get the executor, so every query in the tree joins the active
  transaction implicitly (via `AsyncLocalStorage`) — no `tx` threading. After
  the outermost transaction commits, the outbox is drained best-effort.
- **Outbox** — `OutboxWriter.append(events)` inserts rows using `uow.current()`,
  so the events commit **atomically** with the state change. `OutboxDispatcher`
  drains undispatched rows (`FOR UPDATE SKIP LOCKED`, oldest first), delivers to
  matching subscribers, and stamps `dispatchedAt`; a failing subscriber bumps
  `attempts` and the row is retried. A 5s poll backstop covers a lost
  post-commit drain. **Delivery is at-least-once → subscribers must be
  idempotent.**

### Registering a subscriber

A downstream plugin registers at **runtime** from its own
`OnApplicationBootstrap`: inject `OutboxDispatcher` and call `register(...)`.

```typescript
@Injectable()
export class MyReactor implements OnApplicationBootstrap, DomainEventSubscriber {
    readonly kinds = ['workspace.created'] as const; // or '*' for all kinds
    constructor(private readonly dispatcher: OutboxDispatcher) {}
    onApplicationBootstrap() {
        this.dispatcher.register(this);
    }
    async handle(event: DomainEvent): Promise<void> {
        /* idempotent side effect */
    }
}
```

`register(...)` is the chosen mechanism because Nest cannot merge a
multi-provider token across independent dynamic modules. The
`DOMAIN_EVENT_SUBSCRIBERS` token still exists (default `[]`) for statically
co-located subscribers, and is merged with the runtime-registered ones.

## Architecture

- **Singleton connection.** `db.ts` holds module-level `pool` + `database`.
  `initDatabase` is idempotent; `getDatabase`/`getPool` throw if called first.
  The pool connects lazily (on first query), so booting needs no live DB.
- **Lifecycle.** The connection is opened in the plugin's `onPluginInit`, which
  [`createServer`](../bootstrap/server/src/lib/create-server.ts) runs **in array
  order before** the Nest app is created. List `DatabasePlugin(...)` **first** in
  the `plugins` array — every other plugin (and the global DI provider) can then
  assume a live db.
- **Global DI.** `DatabaseModule.forRoot()` is `global: true`, so any plugin
  module can inject the db without importing it.

## Configuration

The connection string flows from `apps/server/ortha.config.ts`
(`database.url`, sourced from `DATABASE_URL`) into the plugin:

```typescript
// apps/server/src/main.ts
createServer({
    plugins: [DatabasePlugin({ connectionString: config.database.url })]
});
```

## Usage (consuming the db in a plugin)

Inject the Drizzle instance and query against tables the _consuming_ plugin
owns:

```typescript
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { things } from '../schema';

@Injectable()
export class ThingService {
    constructor(@InjectDatabase() private readonly db: Database) {}

    findById(id: string) {
        return this.db.select().from(things).where(eq(things.id, id));
    }
}
```

Use `getDatabase()` / `getPool()` only outside Nest's DI (scripts, seeds).

## Schema & migrations

This plugin owns **one** table — `outbox_events` — and ships its own migration,
exactly like a feature plugin: `src/lib/schema/` + `drizzle.config.ts` +
committed `migrations/`, with a `migrations` descriptor on the plugin
(`__drizzle_migrations_database` tracking table) so the host applies it.
Generate per-plugin, apply from the host:

```bash
npx nx run @ortha-cms/database:db:generate --name=<change>   # commit the SQL
npx nx run server:db:migrate                                 # applies all plugins
```

The `db:generate` target is inferred from `drizzle.config.ts` by
`@ortha-cms/nx`; it never connects to a database.

## Not owned here

- **Feature schemas** — the outbox is the only table here. Every domain table
  belongs to its feature plugin; this package has no domain-schema knowledge.
- **Migration tooling** — the `db:generate` / `db:migrate` targets themselves
  are owned by `@ortha-cms/nx`. The host applies every plugin's migrations.

## Commands

- `npm exec nx typecheck @ortha-cms/database`
- `npm exec nx build @ortha-cms/database`

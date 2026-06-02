# @ortha-cms/database

The database **plugin** for the Ortha CMS server. Owns a single Drizzle ORM
connection (over the `pg` driver) and makes it available to every other plugin.
It owns **no schemas and no migrations** — feature plugins own their own tables.

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
- `DatabaseServerPlugin` — the plugin shape, with `databaseConfig` attached
- `initDatabase` / `getDatabase` / `getPool` — the connection singleton
- `DatabaseModule` — global NestJS module providing the Drizzle instance
- `DATABASE_TOKEN` — DI token for the Drizzle instance
- `InjectDatabase` — parameter decorator (`@InjectDatabase()`)

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

Inject the Drizzle instance and query against tables the *consuming* plugin
owns:

```typescript
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDatabase } from '@ortha-cms/database';
import { things } from '../schema';

@Injectable()
export class ThingService {
    constructor(@InjectDatabase() private readonly db: NodePgDatabase) {}

    findById(id: string) {
        return this.db.select().from(things).where(eq(things.id, id));
    }
}
```

Use `getDatabase()` / `getPool()` only outside Nest's DI (scripts, seeds).

## Not owned here

- **Schemas** — each feature plugin defines its own Drizzle tables; this package
  has zero schema knowledge.
- **Migrations / schema generation** — there is no migration runner or CLI yet.
  The plugin only opens the connection.

## Commands

- `npm exec nx typecheck @ortha-cms/database`
- `npm exec nx build @ortha-cms/database`

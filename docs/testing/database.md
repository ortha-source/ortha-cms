# @ortha-cms/database — Test Artifact

> **Unit:** `packages/database` · **Package:** `@ortha-cms/database` · **Kind:** server plugin (shared infrastructure)
> **Source of truth:** `packages/database/AGENTS.md`
> **Findings verified:** 2026-08-11 — 3 confirmed · 0 deleted · 1 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns.** The single Drizzle/`pg` connection for the whole server, plus the shared
tactical-DDD infrastructure of [ADR-0003](../adr/0003-tactical-ddd-inside-plugins.md):

- the connection singleton — `initDatabase` / `getDatabase` / `getPool` (`src/lib/utils/db.ts`);
- the global `DatabaseModule` and the `@InjectDatabase()` DI seam (`src/lib/database.module.ts`, `src/lib/database.tokens.ts`);
- the `DomainEvent` envelope, `createDomainEvent`, `attachActor`, and the
  `DomainEventSubscriber` contract (`src/lib/events/domain-event.ts`);
- `UnitOfWork` — the transaction boundary, propagated via `AsyncLocalStorage` (`src/lib/uow/unit-of-work.ts`);
- the transactional outbox — `OutboxWriter` (`src/lib/outbox/outbox-writer.ts`) and
  `OutboxDispatcher` (`src/lib/outbox/outbox-dispatcher.ts`);
- **exactly one table**, `outbox_events`, and its migration (`src/lib/schema/outbox-events.ts`,
  `drizzle.config.ts`, `migrations/`).

**Does NOT own.** Any domain schema (every feature plugin ships its own), the migration
*tooling* (`@ortha-cms/nx` owns `db:generate`/`db:migrate`), retries/backoff policy,
a dead-letter queue, a health endpoint, connection-pool tuning, or shutdown
(`packages/bootstrap/server` never calls `enableShutdownHooks` — see
`docs/testing/bootstrap-server.md` `🐞 BUG-bootstrap-server-04`).

**Entry points (exported API — `src/index.ts`)**

| Export | Kind | Where |
| --- | --- | --- |
| `DatabasePlugin(config)` | `ServerPlugin` factory | `src/lib/utils/database-plugin.ts:30` |
| `initDatabase` / `getDatabase` / `getPool` | connection singleton | `src/lib/utils/db.ts:13,26,37` |
| `DatabaseModule.forRoot()` | global dynamic module | `src/lib/database.module.ts:25` |
| `DATABASE_TOKEN` / `InjectDatabase()` | DI token + decorator | `src/lib/database.tokens.ts:15,20` |
| `createDomainEvent` / `attachActor` | event builders | `src/lib/events/domain-event.ts:47,81` |
| `DOMAIN_EVENT_SUBSCRIBERS` | DI token (defaults to `[]`) | `src/lib/events/domain-event.ts:119`, bound at `database.module.ts:37-40` |
| `UnitOfWork` (`run`, `current`) | transaction boundary | `src/lib/uow/unit-of-work.ts:45,70` |
| `OutboxWriter.append(events)` | outbox writer | `src/lib/outbox/outbox-writer.ts:21` |
| `OutboxDispatcher` (`register`, `drain`) | outbox drainer | `src/lib/outbox/outbox-dispatcher.ts:64,76` |
| `outboxEvents` | Drizzle table | `src/lib/schema/outbox-events.ts:22` |
| `Database`, `DatabasePluginConfig`, `DatabaseServerPlugin`, `DomainEvent`, `CreateDomainEventParams`, `DomainEventSubscriber`, `EventActor` | types | `src/lib/types/index.ts`, `src/lib/events/domain-event.ts`, `src/lib/utils/database-plugin.ts:11` |

**No HTTP routes.** This plugin contributes no controller.

**Runtime prerequisites**

- Postgres reachable at `DATABASE_URL` (`docker compose up -d`). Note: the pool connects
  **lazily**, so boot succeeds even with a bad URL (`AGENTS.md`, "The pool connects lazily
  (on first query), so booting needs no live DB") — see EC-04.
- `DatabasePlugin(...)` must be **first** in `apps/server/src/plugins.ts:55`.
- `outbox_events` must exist → `npx nx run server:db:migrate`.
- To observe delivery you need at least one subscriber; today the only one is
  `packages/activity/server/src/lib/activity/infrastructure/audit-event.subscriber.ts`,
  registered at bootstrap (`:36-38`).

**How to exercise it manually**

```bash
docker compose up -d
npx nx run server:db:migrate
npm run dev

# Produce a domain event through a real use case (login writes identity.signed_in
# inside a UnitOfWork — packages/identity/server/src/lib/application/use-cases/login.use-case.ts:68-79)
curl -i -X POST localhost:3000/api/auth/login \
  -H 'Origin: http://localhost:4200' -H 'content-type: application/json' \
  -d '{"email":"<root-admin>","password":"<password>"}'

# Watch the outbox drain
psql "$DATABASE_URL" -c \
  "select id, kind, occurred_at, dispatched_at, attempts from outbox_events order by occurred_at desc limit 10;"

# Watch the audit row the subscriber wrote
psql "$DATABASE_URL" -c "select id, kind, created_at from activity_events order by created_at desc limit 5;"

# Inspect pool usage while under load
psql "$DATABASE_URL" -c "select count(*), state from pg_stat_activity group by state;"
```

**Dependencies.** `pg` ^8.13, `drizzle-orm` ^0.45 (the `.for('update', { skipLocked: true })`
builder and `db.transaction` are both drizzle APIs the dispatcher depends on),
`@nestjs/common` ^11, and `@ortha-cms/bootstrap-server` for the `ServerPlugin` type.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `DatabasePlugin(config)` returns a `ServerPlugin` named `database` carrying `databaseConfig` | `src/lib/utils/database-plugin.ts:33-48` | ⚠️ PARTIAL |
| F2 | `onPluginInit` opens the pool eagerly, before the Nest app exists | `src/lib/utils/database-plugin.ts:37-39` | ⚠️ PARTIAL |
| F3 | `initDatabase` is idempotent — a second call is a no-op | `src/lib/utils/db.ts:13-20` | ❌ NONE |
| F4 | `getDatabase()` / `getPool()` throw a named error before init | `src/lib/utils/db.ts:26-31,37-42` | ❌ NONE |
| F5 | `DatabaseModule.forRoot()` is `global: true` and provides + exports the client and the three primitives | `src/lib/database.module.ts:25-52` | ✅ E2E |
| F6 | `@InjectDatabase()` resolves the Drizzle client in any plugin | `src/lib/database.tokens.ts:20` | ✅ E2E |
| F7 | `DOMAIN_EVENT_SUBSCRIBERS` defaults to `[]` so injection never fails | `src/lib/database.module.ts:37-40` | ✅ E2E |
| F8 | The plugin ships `outbox_events` migrations under `__drizzle_migrations_database` | `src/lib/utils/database-plugin.ts:44-47`, `migrations/` | ⚠️ PARTIAL |
| F9 | `createDomainEvent` fills `eventId` (uuid) and `occurredAt` (now) when omitted | `src/lib/events/domain-event.ts:47-58` | 🧪 UNIT |
| F10 | `attachActor` merges `{ actor: { id, email } }` into each payload without mutating inputs | `src/lib/events/domain-event.ts:81-92` | 🧪 UNIT |
| F11 | `UnitOfWork.run(fn)` executes `fn` in one transaction | `src/lib/uow/unit-of-work.ts:45-53` | ✅ E2E |
| F12 | A **nested** `run` joins the outer transaction rather than opening a new one | `src/lib/uow/unit-of-work.ts:46-49` | ❌ NONE |
| F13 | `UnitOfWork.current()` returns the ambient tx inside `run`, the base connection outside it | `src/lib/uow/unit-of-work.ts:70-72` | ⚠️ PARTIAL |
| F14 | After the outermost commit, the outbox is drained best-effort; failures are swallowed | `src/lib/uow/unit-of-work.ts:55-60` | ⚠️ PARTIAL |
| F15 | `OutboxWriter.append(events)` is a no-op on an empty array | `src/lib/outbox/outbox-writer.ts:22-24` | ❌ NONE |
| F16 | `OutboxWriter.append` inserts through `uow.current()`, so rows commit with the state change | `src/lib/outbox/outbox-writer.ts:26-40` | ✅ E2E |
| F17 | `OutboxDispatcher.drain()` claims ≤100 pending rows `FOR UPDATE SKIP LOCKED`, oldest-`occurredAt` first | `src/lib/outbox/outbox-dispatcher.ts:77-84` | ✅ E2E |
| F18 | A delivered row is stamped `dispatchedAt` | `src/lib/outbox/outbox-dispatcher.ts:100-103` | ✅ E2E |
| F19 | A subscriber throw increments `attempts` and leaves the row undispatched | `src/lib/outbox/outbox-dispatcher.ts:104-113` | ❌ NONE |
| F20 | `subscribersFor(kind)` merges injected + runtime-registered subscribers and filters on `kinds` / `'*'` | `src/lib/outbox/outbox-dispatcher.ts:154-159` | ⚠️ PARTIAL |
| F21 | `register(subscriber)` adds a subscriber at runtime | `src/lib/outbox/outbox-dispatcher.ts:64-66` | ✅ E2E |
| F22 | A 5 s poll backstop drains, guarded against overlapping *poll* runs, with an `unref`'d timer | `src/lib/outbox/outbox-dispatcher.ts:119-125,136-151` | ⚠️ PARTIAL |
| F23 | `onModuleDestroy` clears the poll timer | `src/lib/outbox/outbox-dispatcher.ts:128-133` | ❌ NONE |
| F24 | `outbox_events` schema: uuid PK defaulting random, `attempts` default 0, index on `dispatched_at` | `src/lib/schema/outbox-events.ts:26-46` | ⚠️ PARTIAL |

## 3. Manual Test Plan

### F1 / F2 — Plugin shape and eager connection

**Preconditions:** clean checkout, `.env` present, Postgres up.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx serve server` | Boots; no `Database not initialized` error |
| 2 | Move `DatabasePlugin(...)` from position 0 to last in `apps/server/src/plugins.ts:54-170` and restart | Boot fails at DI instantiation with `Database not initialized. Call initDatabase() first.` from `src/lib/utils/db.ts:28` — the `DATABASE_TOKEN` factory (`database.module.ts:32`) runs `getDatabase()` while building providers |
| 3 | Restore the order | Boots |
| 4 | In a REPL: `const p = DatabasePlugin({connectionString:'x'}); p.name; p.databaseConfig; typeof p.onPluginInit; p.migrations.table` | `'database'`, `{connectionString:'x'}`, `'function'`, `'__drizzle_migrations_database'` |

### F3 — `initDatabase` idempotency

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Node script: `initDatabase({connectionString: A}); const p1 = getPool(); initDatabase({connectionString: B}); const p2 = getPool();` | `p1 === p2` — the second call returns early at `db.ts:15-17` |
| 2 | Confirm the connection string | Still `A`. The second config is **silently discarded**; no warning. See EC-03 |

### F4 — Pre-init guards

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Fresh module registry, call `getDatabase()` first | Throws `Error: Database not initialized. Call initDatabase() first.` |
| 2 | Same for `getPool()` | Same message |

### F5 / F6 / F7 — Global DI

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | With the server running, hit any route backed by a repository (`GET /api/workspaces` with a session cookie) | `200` with rows — the consuming module never imports `DatabaseModule` |
| 2 | Grep any plugin module for `imports: [DatabaseModule]` | No hits — `global: true` (`database.module.ts:27`) is what makes that unnecessary |
| 3 | Boot with **no** plugin providing `DOMAIN_EVENT_SUBSCRIBERS` | `OutboxDispatcher` still instantiates; `injectedSubscribers` is `[]` |

### F8 — Migrations

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `npx nx run server:db:migrate` on an empty DB | A line `Applying migrations: database → __drizzle_migrations_database` appears **first** (registration order) |
| 2 | `psql "$DATABASE_URL" -c "\d outbox_events"` | Columns `id uuid pk`, `kind text not null`, `aggregate_type`, `aggregate_id`, `payload jsonb not null`, `occurred_at timestamptz not null`, `dispatched_at timestamptz null`, `attempts int not null default 0`; index `outbox_events_dispatched_at_idx` |
| 3 | Re-run `db:migrate` | Same log, no DDL, exit 0 |
| 4 | `npx nx run @ortha-cms/database:db:generate --name=noop` | "No schema changes" — generation never connects to a DB |

### F9 / F10 — Event envelope

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `createDomainEvent({kind:'x.y', aggregateType:'x', aggregateId:'1', payload:{}})` | `eventId` is a v4 uuid, `occurredAt` is a `Date` ≈ now |
| 2 | Same call with explicit `eventId`/`occurredAt` | Both preserved verbatim |
| 3 | `const e = [createDomainEvent({…, payload:{a:1}})]; const out = attachActor(e, {id:'u1', email:'a@b.c'})` | `out[0].payload` is `{a:1, actor:{id:'u1',email:'a@b.c'}}`; `e[0].payload` is still `{a:1}` (no mutation); `out !== e` |
| 4 | `attachActor(e, {id:'u1', email:null})` | `payload.actor.email === null` |
| 5 | Pass a payload that already has an `actor` key | It is **overwritten** — `attachActor` spreads `actor` last (`domain-event.ts:87-89`) |

### F11 / F12 / F13 — `UnitOfWork`

**Preconditions:** server running; use `POST /api/auth/login` as the driving use case
(`login.use-case.ts:68-79` wraps session issue + outbox append in one `run`).

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Log in successfully | A session row **and** an `outbox_events` row with `kind='identity.signed_in'` exist |
| 2 | Force the outbox insert to fail (e.g. temporarily drop the `outbox_events` table) and log in | `500`; **no** session row was created — both writes rolled back together |
| 3 | Restore the table; log in again | Both rows present |
| 4 | In a scratch service, call a repository method **outside** any `run` | It executes on the base pool with **no transaction and no error** (`unit-of-work.ts:71`). This silence is the hazard — see `🐞 BUG-database-02` |
| 5 | Call `uow.run(async () => uow.run(async () => …))` | The inner call returns `fn()` directly (`unit-of-work.ts:46-49`); one `BEGIN`/`COMMIT` pair in the Postgres log, not two |

### F14 — Post-commit drain

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Log in and immediately query `outbox_events` | The row usually already has `dispatched_at` set — `run` awaits `dispatcher.drain()` after commit (`unit-of-work.ts:57`) |
| 2 | Register a subscriber that throws, then log in | The login still returns `201` — the drain failure is swallowed (`unit-of-work.ts:58-60`) |
| 3 | Measure login latency with ~100 pending outbox rows | Login is slower by the whole drain — see `🐞 BUG-database-04` |

### F15 / F16 — `OutboxWriter`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `await outbox.append([])` inside a `run` | Returns immediately, no SQL issued (`outbox-writer.ts:22-24`) |
| 2 | `await outbox.append([e1, e2])` inside a `run` | One multi-row `INSERT`; both rows have `dispatched_at IS NULL` and `attempts = 0` |
| 3 | Append two events with the same `eventId` in one call | Postgres `23505` on the uuid PK → the whole transaction rolls back |

### F17 / F18 — Drain claims and stamps

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Insert 150 pending rows with staggered `occurred_at`, then call `drain()` once | Exactly 100 rows get `dispatched_at` — the **oldest 100** by `occurred_at` (`outbox-dispatcher.ts:82-83`) |
| 2 | Run two `drain()` calls concurrently against 200 pending rows | Neither blocks; they claim disjoint sets (`FOR UPDATE SKIP LOCKED`, `:84`); no row is delivered twice within the pair |
| 3 | While a drain is running, `select * from pg_locks where mode='RowExclusiveLock'` | The claimed rows are locked for the duration of the whole batch, **including subscriber I/O** — see `🐞 BUG-database-04` |

### F19 — Failing subscriber

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Register a subscriber for `'*'` whose `handle` always throws; produce one event | Log: `Delivery failed for event <id> (<kind>); will retry`; the row keeps `dispatched_at IS NULL` and `attempts = 1` |
| 2 | Wait 5 s (one poll tick) | `attempts = 2`. Repeat: it climbs without bound and **never stops** — see `🐞 BUG-database-01` |
| 3 | Register a second, *working* subscriber for the same kind and produce one event | On each retry the working subscriber is invoked **again** before the failing one throws — at-least-once, so it must be idempotent (`domain-event.ts:99-101`) |

### F20 / F21 — Subscriber matching and registration

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Register subscriber A with `kinds = ['a.b']` and B with `kinds = '*'`; produce `a.b` then `c.d` | A sees only `a.b`; B sees both |
| 2 | Register the same subscriber instance twice | It is invoked **twice** per event — `register` is a bare `push` (`outbox-dispatcher.ts:65`) with no de-duplication |
| 3 | Restart the server | Runtime registrations are gone until each subscriber's `onApplicationBootstrap` re-runs |

### F22 / F23 — Poll backstop

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Insert a pending row directly with `psql`, touching no HTTP route | Within ~5 s it is delivered and stamped — the poll found it (`outbox-dispatcher.ts:120-122`) |
| 2 | Make the drain take >5 s (slow subscriber); watch the logs | Poll ticks are skipped while `draining` is true (`:137-139`); a **post-commit** drain from a request still overlaps, because it calls `drain()` directly (`unit-of-work.ts:57`) rather than `pollOnce()` |
| 3 | Stop the process with `Ctrl-C` | Exits promptly — the timer is `unref`'d (`:124`). `onModuleDestroy` does **not** run in production (no `enableShutdownHooks`) — see `docs/testing/bootstrap-server.md` `🐞 BUG-bootstrap-server-04` |

### F24 — Schema invariants

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `insert into outbox_events (kind, aggregate_type, aggregate_id, payload, occurred_at) values ('k','a','1','{}', now());` | Succeeds; `id` auto-generated, `attempts` = 0, `dispatched_at` null |
| 2 | Same insert omitting `payload` | `not null` violation |
| 3 | `explain select * from outbox_events where dispatched_at is null order by occurred_at limit 100;` | Uses `outbox_events_dispatched_at_idx` for the filter; note the **sort on `occurred_at` is not indexed** — see EC-24 |

## 4. Edge Cases & Negative Paths

**Connection singleton**

- **EC-01 — `getDatabase()` before `initDatabase()`.** `❌ NONE` Throws a clear named error
  (`db.ts:28`). Correct and legible.
- **EC-02 — Empty connection string.** `❌ NONE` `ortha.config.ts:81` defaults
  `DATABASE_URL` to `''`. `new Pool({ connectionString: '' })` does **not** throw — `pg`
  falls back to `PGHOST`/`PGUSER`/libpq defaults, so the server boots and then fails at the
  first query with a connection error rather than a configuration error.
- **EC-03 — `initDatabase` called twice with different configs.** `❌ NONE` The guard checks
  `database`, so the second config is silently ignored (`db.ts:14-17`). Reachable in tests
  and in a host that calls `createServer` twice.
- **EC-04 — Unreachable database at boot.** `❌ NONE` Documented as intentional
  (`AGENTS.md`: "The pool connects lazily … booting needs no live DB"). The consequence is
  that a wrong `DATABASE_URL` produces a *healthy-looking* process that 500s every request;
  there is no readiness probe anywhere in the repo to catch it.
- **EC-05 — Pool exhaustion.** `❌ NONE` `new Pool({ connectionString })` (`db.ts:18`) sets
  no `max`, no `connectionTimeoutMillis`, no `idleTimeoutMillis`, no `statement_timeout`.
  `pg`'s defaults are `max: 10` and `connectionTimeoutMillis: 0` — **wait forever**. Under
  concurrency a request that cannot get a client hangs indefinitely instead of failing
  fast. → `🐞 BUG-database-03`.
- **EC-06 — Leaked client.** `❌ NONE` All acquisition goes through drizzle's
  `db.transaction` / implicit query, so there is no manual `pool.connect()` to leak — the
  one exception is `getPool()`, exported for "scripts, seeds" (`AGENTS.md`), where a caller
  doing `pool.connect()` without `release()` is unguarded.
- **EC-07 — Pool never drained on shutdown.** `❌ NONE` No `pool.end()` in the production
  tree. Cross-reference `🐞 BUG-bootstrap-server-04`.

**`UnitOfWork`**

- **EC-08 — Repository called outside `run`.** `❌ NONE` `current()` falls back to the base
  connection (`unit-of-work.ts:71`), so the work runs auto-commit with no error and no
  warning. → `🐞 BUG-database-02`.
- **EC-09 — Detached promise inside `run`.** `❌ NONE` A `void doAsync()` started inside
  `run` inherits the `AsyncLocalStorage` store, so it keeps using `tx` **after** the
  transaction has committed and its client has been released — `pg` then throws
  "Cannot use a released client" from a context nobody awaits.
- **EC-10 — `fn` throws inside `run`.** `⚠️ PARTIAL` drizzle rolls back and rethrows; the
  post-commit drain is skipped because `await this.db.transaction(...)` rejected before
  line 57. Exercised implicitly by `apps/server-e2e/src/server/users/invite-user.spec.ts`
  style failure cases, never asserted at this layer.
- **EC-11 — Nested `run` where the inner one wants its own transaction.** `❌ NONE` Not
  expressible — joining is unconditional (`:46-49`). A genuinely-independent sub-unit (e.g.
  "record the failure even though the main work rolls back") has no API.
- **EC-12 — Serialization failure / deadlock inside a transaction.** `❌ NONE` No retry
  wrapper; a `40001`/`40P01` propagates as a 500 to the caller.
- **EC-13 — Long-running `run`.** `❌ NONE` No timeout; a slow `fn` holds a pool client and
  an open transaction for its whole duration, compounding EC-05.

**Outbox — writing**

- **EC-14 — `append` outside a `run`.** `❌ NONE` Inserts the event on its own auto-commit
  statement, so it can commit while the state change rolls back — inverting the whole point
  of the pattern. Same root cause as EC-08 → `🐞 BUG-database-02`.
- **EC-15 — Empty array.** `❌ NONE` Correct no-op (`outbox-writer.ts:22-24`).
- **EC-16 — Non-JSON-serialisable payload.** `❌ NONE` The type says
  `Record<string, unknown>` (`domain-event.ts:20`); a `Date`, `Map`, `BigInt` or circular
  value in the payload either silently changes shape through `jsonb` or throws from the
  driver at insert time, aborting the caller's transaction. Nothing validates it.
- **EC-17 — Very large payload.** `❌ NONE` No size cap; a multi-MB `jsonb` row is accepted
  and then re-read in full on every drain attempt.
- **EC-18 — Duplicate `eventId`.** `❌ NONE` The uuid PK is the idempotency key
  (`outbox-events.ts:25-26`), so re-appending the same event id raises `23505` and rolls
  back the caller's transaction. There is no `onConflictDoNothing` — deliberate for a
  producer, surprising for a retrying one.

**Outbox — dispatching**

- **EC-19 — Poison message (permanently failing subscriber).** `❌ NONE` `attempts` is
  incremented but never read; the drain filters only on `dispatched_at IS NULL` and orders
  oldest-first, so the poison row is re-selected on every tick forever, and ≥100 of them
  block every newer event. → `🐞 BUG-database-01`.
- **EC-20 — Partial subscriber success.** `❌ NONE` Subscribers run sequentially
  (`outbox-dispatcher.ts:97-99`); if the third throws, the first two are re-invoked on
  every retry. Documented as at-least-once (`domain-event.ts:99-101`), so the burden is on
  subscribers — but nothing in the type system or a test enforces idempotency.
- **EC-21 — Dispatcher crash mid-batch.** `❌ NONE` The whole batch is one transaction
  (`:77-115`), so a crash after subscriber 40 rolls back all 40 `dispatchedAt` stamps and
  all 40 side effects are re-delivered on the next drain.
- **EC-22 — A subscriber that writes through `uow.current()`.** `❌ NONE` Outside a `run`,
  `current()` returns the base pool — a **different connection** from the drain's
  transaction. A subscriber that tried to touch `outbox_events` would block on the drain's
  own row locks and self-deadlock (the drain waits for the subscriber, the subscriber waits
  for the drain). Today's only subscriber writes `activity_events` on `this.db`
  (`audit-event.subscriber.ts:50-53`), so it is safe by luck rather than by design.
- **EC-23 — `attempts` overflow.** `❌ NONE` `integer` maxes at 2 147 483 647; at one
  attempt per 5 s that is ~340 years — not a real risk, but it is the only bound.
- **EC-24 — Drain ordering under load.** `❌ NONE` The index is on `dispatched_at` alone
  (`outbox-events.ts:45`); the query also sorts by `occurred_at`, so once the table holds
  many delivered rows Postgres does an index scan plus a sort. A composite
  `(dispatched_at, occurred_at)` partial index would serve it.
- **EC-25 — Table growth.** `❌ NONE` Delivered rows are never pruned. `outbox_events`
  grows without bound; nothing ships a retention job.
- **EC-26 — Ordering guarantees.** `❌ NONE` `orderBy(occurredAt)` gives *approximate*
  per-batch ordering only: two events with the same `occurredAt` (same millisecond — very
  likely for two events appended in one `append` call) have no tiebreaker, and `SKIP
  LOCKED` means concurrent drains reorder across batches. Any subscriber that assumes
  per-aggregate ordering is wrong; nothing documents this.
- **EC-27 — Clock skew.** `❌ NONE` `occurredAt` is `new Date()` on the **app** server
  (`domain-event.ts:55`), not `now()` in Postgres, so two app instances with skewed clocks
  produce a drain order that does not match commit order.
- **EC-28 — Subscriber registered after events already drained.** `❌ NONE` `register` at
  `onApplicationBootstrap` (`audit-event.subscriber.ts:36-38`) can race the poll timer,
  which also starts at `onApplicationBootstrap` (`outbox-dispatcher.ts:119`). Nest's
  ordering across independent modules is not guaranteed, so on a very slow boot the first
  poll tick could drain rows before a subscriber has registered — and those rows are
  stamped delivered, permanently skipping that subscriber.
- **EC-29 — Two app instances.** `⚠️ PARTIAL` `SKIP LOCKED` makes horizontal scaling safe
  for *claiming*, which the class comment claims (`:32-34`). It is not covered by any test,
  and it does not fix EC-28 (each instance registers its own subscribers).

**Idempotency & replay**

- **EC-30 — Re-run a migration.** `⚠️ PARTIAL` drizzle's per-plugin tracking table
  (`__drizzle_migrations_database`) makes `db:migrate` re-entrant; exercised by
  `apps/server-e2e/src/support/global-setup.ts` but never asserted.
- **EC-31 — Re-delivery of an already-processed event.** `⚠️ PARTIAL` The only subscriber
  is idempotent via `onConflictDoNothing` on the event id
  (`audit-event.subscriber.ts:50-53`); asserted indirectly by
  `apps/server-e2e/src/server/activity/activity.spec.ts` (one audit row per action), never
  by forcing a duplicate delivery.

### 4A. Accessibility & Section 508 Conformance

`@ortha-cms/database` renders nothing, serves no route and owns exactly **one** table —
`outbox_events` (`packages/database/src/lib/schema/outbox-events.ts:22`). Every WCAG 2.1 AA
success criterion describes perceivable, operable content; none of them reach a connection
pool, an `AsyncLocalStorage` and an event queue. All of 1.x–4.x, plus 502.2/502.3, 503.2 and
503.4, are therefore **Not Applicable**, and padding them out one by one would be noise.

The one provision that *could* have bitten this unit is **504 (Authoring Tools)**, because a
508 audit of a CMS asks whether the data layer can carry accessibility information at all.
The answer here is that this package is the wrong layer to ask:

| 508 question | Verdict | Justification |
| --- | --- | --- |
| 504.2 — can the layer represent conformant content (headings, lists, `<th>`)? | **Not Applicable** | It stores no content. `DatabasePluginConfig` is one field (`src/lib/types/index.ts:15-18`) and the sole owned table holds event envelopes. Content shape is `content-server`'s. |
| 504.2.1 — is accessibility information preserved across save/reload/copy? | **Not Applicable (pass-through)** | The outbox payload is `jsonb` (`outbox-events.ts:34`) and `DomainEvent.payload` is `Record<string, unknown>` (`src/lib/events/domain-event.ts:20`) — opaque and lossless for anything a producer puts in it. It neither adds nor strips alt text, captions or language markers. Note the JSON round-trip caveat already filed in §4 (a `Date`/`Map`/`BigInt` in a payload does not survive), which would equally mangle a structured accessibility field if a future producer put one there. |
| Can the layer carry **alt text**? | **Not Applicable here — assessed elsewhere** | `alt` lives on the media asset row (`packages/media/server/src/lib/infrastructure/schema/media-asset.ts:62`); its per-occurrence and per-locale limits are filed as `docs/testing/app-server.md` `♿ A11Y-app-server-01`. |
| Can the layer carry a **table caption**? | **Not Applicable here** | No content table is defined by this package; the question belongs to `content-server` and the richtext document format (`docs/testing/wysiwyg-admin.md`). |
| Can the layer carry a **language marker**? | **Not Applicable here — and satisfied upstream** | The non-null `locale` column that gives every i18n entry an explicit language is emitted by `packages/content/server/src/lib/collection/table-builder.ts:204`, not here. |
| 504.3 — does the tool prompt for accessibility information? | **Not Applicable** | No authoring UI. |
| 504.4 — do shipped templates default to conformant output? | **Not Applicable** | Ships no template. |

**No accessibility findings.** Specifically checked and cleared: the package defines no
user-facing string, no colour, no markup and no content column; nothing it stores is
lossy for accessibility metadata beyond the already-recorded JSON round-trip limitation.

**♿ tally:** `0 findings — 0 Supports · 0 Partially Supports · 0 Does Not Support · 9 Not Applicable`

## 5. E2E Coverage Map

There is **no spec that names the outbox, `UnitOfWork`, `OutboxWriter` or `OutboxDispatcher`
directly** — a repo-wide grep of `apps/server-e2e/src` for `outbox`, `OutboxDispatcher`,
`UnitOfWork` returns nothing. Everything below is *incidental* coverage: the primitives are
exercised because real use cases sit on them.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F5/F6 Global DI + `@InjectDatabase()` | `apps/server-e2e/src/support/test-app.ts:36-51` plus every suite | The whole app boots and serves data through injected clients on every run | ✅ E2E — implicit but total: nothing works if this breaks |
| F2 Eager connection in `onPluginInit` | `apps/server-e2e/src/support/test-app.ts:36-38` | The harness mirrors the host's init loop | ⚠️ PARTIAL — the happy path only; no ordering or failure assertion |
| F7 `DOMAIN_EVENT_SUBSCRIBERS` default `[]` | Boot of every suite | Injection succeeds with no static subscriber contributed anywhere | ✅ E2E — implicit |
| F11/F16 `run` + `append` atomicity | `apps/server-e2e/src/server/auth/login.spec.ts` (login) and `apps/server-e2e/src/server/activity/activity.spec.ts` | A successful login yields an audit row; a rejected login yields none | ✅ E2E for the happy path — ⚠️ **no test forces the outbox insert to fail and asserts the state change rolled back**, which is the invariant the pattern exists for |
| F17/F18/F21 drain + stamp + runtime registration | `apps/server-e2e/src/server/activity/activity.spec.ts`, `activity-filter.spec.ts` | Audit rows appear after mutations, so `register` → `drain` → `dispatchedAt` all worked | ⚠️ PARTIAL — asserts the *effect*, never the outbox table's own state (`dispatched_at`, `attempts`), the batch cap, `SKIP LOCKED`, or concurrent drains |
| F13 `current()` inside vs outside `run` | `packages/identity/server/src/lib/infrastructure/persistence/*.repository.ts` used by every auth suite | Repositories join the ambient transaction | ⚠️ PARTIAL — the *outside* branch (silent auto-commit) is never exercised |
| F14 post-commit best-effort drain | Same auth/activity suites | Audit rows are present immediately after the mutation returns, i.e. the post-commit drain ran synchronously | ⚠️ PARTIAL — the swallow-on-failure branch (`unit-of-work.ts:58-60`) is untested |
| F8 migrations | `apps/server-e2e/src/support/global-setup.ts` | `outbox_events` exists in the testcontainer | ⚠️ PARTIAL |
| F9/F10 `createDomainEvent` / `attachActor` | `packages/activity/server/src/lib/activity/infrastructure/audit-event-mapping.spec.ts:2-3,28,32` | Builds events exactly as a producer does and asserts the actor is recoverable from the payload | 🧪 UNIT — in a *consuming* package; `packages/database` itself ships **zero** unit tests |
| F3, F4, F12, F15, F19, F20, F22, F23, F24 | — | — | ❌ NONE |

**Coverage tally:** `24 features · 4 ✅ · 8 ⚠️ · 10 ❌ · 2 🧪`

## 6. 🐞 Potential Bugs

### 🐞 BUG-database-01 — A permanently-failing event is retried forever and blocks every newer event behind it; `attempts` is written but never read · Severity: High

**Location:** `packages/database/src/lib/outbox/outbox-dispatcher.ts:77-113`, with `packages/database/src/lib/schema/outbox-events.ts:39-40`
**Category:** data-loss (delivery stall)

**What the code does:**

```ts
const rows = await tx
    .select().from(outboxEvents)
    .where(isNull(outboxEvents.dispatchedAt))
    .orderBy(outboxEvents.occurredAt)
    .limit(DRAIN_BATCH_SIZE)              // 100
    .for('update', { skipLocked: true });
…
} catch (error) {
    this.logger.error(`Delivery failed for event ${row.id} …; will retry`, …);
    await tx.update(outboxEvents).set({ attempts: row.attempts + 1 })…
}
```

`attempts` is incremented here and **nowhere else in the repository is it read** — the
`where` clause never mentions it, and there is no maximum, no backoff, and no dead-letter
state.

**Why it is wrong:** the column's own JSDoc says "Failed delivery attempts, for
observability **and backoff**" (`outbox-events.ts:39`) and `AGENTS.md` says "a failing
subscriber bumps `attempts` and the row is retried" — but no backoff exists. Two concrete
consequences:

1. **Infinite retry.** A subscriber that fails deterministically (a malformed payload, a
   removed foreign key, a bug) is re-invoked every 5 seconds, forever, for the life of the
   deployment, logging an `error` each time.
2. **Head-of-line blocking.** The batch is the *oldest 100 undispatched rows*. Once 100
   poison rows accumulate, every drain selects exactly those 100 and **no newer event is
   ever delivered again** — the audit trail silently stops, with no alarm beyond a repeating
   log line.

**Repro:**
1. Register a subscriber with `kinds = '*'` whose `handle` always throws.
2. Perform 100 audited actions (logins are enough) so 100 rows go pending.
3. Perform one more audited action.
→ Observed: `select attempts from outbox_events` climbs indefinitely for the first 100 rows;
the 101st row's `dispatched_at` stays `NULL` permanently and the working subscribers
(`AuditEventSubscriber`) never see it.
→ Expected: after N attempts the row is skipped/quarantined (e.g. `where attempts < N`, or a
`failedAt` column) so the queue drains past it.

**Blast radius:** the audit trail is the current consumer, so a poison message means audit
events stop being recorded — a compliance-relevant silent failure — plus unbounded error
logging and repeated side effects on every partially-successful subscriber set.
**Suggested fix:** add `lt(outboxEvents.attempts, MAX_ATTEMPTS)` to the drain predicate and
introduce a terminal state (or an exponential `nextAttemptAt`) so poison rows leave the
working set instead of monopolising it.

### 🐞 BUG-database-02 — `UnitOfWork.current()` silently falls back to the base connection, so an outbox append outside `run` loses its atomicity guarantee with no error · Severity: Medium

**Location:** `packages/database/src/lib/uow/unit-of-work.ts:65-72` and `packages/database/src/lib/outbox/outbox-writer.ts:21-40`
**Category:** correctness (data integrity)

**What the code does:**

```ts
current(): Database {
    return this.als.getStore()?.tx ?? this.db;
}
```

and `OutboxWriter.append` uses it unconditionally:

```ts
await this.uow.current().insert(outboxEvents).values(…)
```

**Why it is wrong:** the entire justification for the transactional outbox is that "the row
commits **iff** the change does" (`outbox-events.ts:12-14`). That guarantee holds only
inside `UnitOfWork.run`. Outside it, `current()` returns the shared pool and the insert
auto-commits on its own connection — so a use case that forgets the `run` wrapper gets:

- events published for a state change that later rolls back (phantom audit rows), or
- a state change with no event at all if the append is skipped on a later error path,

with **no exception, no log line, and no type-level distinction**. `.cursor/BUGBOT.md`
("Audit outside the transaction") names this exact class of bug as a recurring trap, and
the `OutboxWriter.append` JSDoc even says "Call from inside a `UnitOfWork.run`" — an
instruction with nothing enforcing it. The correct-usage examples
(`login.use-case.ts:68-79`) show it can be got right; the API makes getting it wrong
invisible.

**Repro:**
1. In any service, call `outboxWriter.append([createDomainEvent({…})])` **without** wrapping
   in `uow.run`, then throw.
2. Query `outbox_events`.
→ Observed: the row is committed and will be delivered, describing a state change that never
happened. → Expected: either the insert joins a transaction, or `append` throws
"OutboxWriter.append must be called inside UnitOfWork.run".

**Blast radius:** any future use case or any refactor that moves an `append` out of its
`run`. Because the failure is silent, it is found only when someone notices the audit log
disagrees with reality. **Severity is Medium, not High, because no caller violates the rule
today** — every one of the 20 `outbox.append(...)` call sites in `identity`, `users`,
`workspaces`, `media` and `content` sits inside a `uow.run` in the same file (verified by
grep). This is a latent API footgun, not a live data-integrity failure.
**Suggested fix:** add a strict accessor — e.g. `UnitOfWork.requireCurrent()` that throws
when `als.getStore()` is empty — and have `OutboxWriter.append` use it, keeping the lenient
`current()` for read repositories where auto-commit is legitimate.

### 🐞 BUG-database-03 — The pool is created with no `max`, no `connectionTimeoutMillis` and no statement timeout, so exhaustion hangs requests forever · Severity: Medium

**Location:** `packages/database/src/lib/utils/db.ts:13-20`
**Category:** perf (availability)

**What the code does:**

```ts
export function initDatabase(config: DatabasePluginConfig): void {
    if (database) { return; }
    pool = new Pool({ connectionString: config.connectionString });
    database = drizzle(pool);
}
```

`DatabasePluginConfig` carries exactly one field, `connectionString`
(`src/lib/types/index.ts:15-18`), so there is no way for a host to tune the pool without
editing this package.

**Why it is wrong:** `pg`'s defaults are `max: 10` and `connectionTimeoutMillis: 0`, and `0`
means *wait indefinitely*. Combined with the parts of this package that hold a client for a
long time — `UnitOfWork.run` for a whole use case, and `OutboxDispatcher.drain` for a whole
100-event batch **including every subscriber's I/O** (`outbox-dispatcher.ts:77-115`) —
eleven concurrent slow requests do not fail fast with a 503: they queue silently until the
client gives up. There is also no `statement_timeout`, so one runaway query pins a
connection indefinitely.

**Repro:**
1. Register a subscriber whose `handle` sleeps 30 s.
2. Fire 15 concurrent audited requests.
→ Observed: requests 11+ hang with no response and no log; `pg_stat_activity` shows 10 busy
backends. → Expected: a bounded wait producing a `503`/`500`, and an operator-tunable `max`.

**Blast radius:** every deployment under load, and every deployment sharing a Postgres with
a low `max_connections`. The failure mode (hang) is worse than the failure (503) because
health checks and load balancers cannot see it.
**Suggested fix:** widen `DatabasePluginConfig` with optional `max`,
`connectionTimeoutMillis`, `idleTimeoutMillis` and `statement_timeout`, with non-zero
defaults, and thread them from `ortha.config.ts`.

### 🐞 BUG-database-04 — The drain holds row locks and a pool client across all subscriber I/O, and the post-commit drain puts that latency on the user's request · Severity: Medium

**Location:** `packages/database/src/lib/outbox/outbox-dispatcher.ts:76-115` and `packages/database/src/lib/uow/unit-of-work.ts:51-62`
**Category:** perf

**What the code does:** the whole batch — selection, up to 100 × N subscriber calls, and
each stamp — runs inside a single `this.db.transaction(...)`. And `UnitOfWork.run` awaits
that drain inline after committing the user's work:

```ts
const result = await this.db.transaction((tx) => this.als.run({ tx }, fn));
try { await this.dispatcher.drain(); } catch { /* … */ }
return result;
```

**Why it is wrong:** two coupled costs.

1. A `FOR UPDATE` lock on up to 100 rows plus one pool client are held for as long as the
   slowest subscriber takes. Subscribers are arbitrary side effects — the contract
   (`domain-event.ts:103-111`) places no latency bound on `handle`, and a future subscriber
   doing an HTTP call would hold the transaction for its full timeout.
2. Because `run` awaits `drain()`, **the user's HTTP request pays for other people's
   events**. A login that produced one event can end up draining 100 unrelated pending rows
   before it responds. That is invisible in the happy path (the queue is normally near
   empty) and catastrophic after a backlog builds — exactly when latency matters most.

**Repro:**
1. Insert 100 pending outbox rows directly.
2. Register a subscriber that sleeps 200 ms.
3. `time curl -X POST /api/auth/login …`
→ Observed: the login response takes ~20 s. → Expected: the login returns immediately and
the backlog drains on the poll backstop.

**Blast radius:** user-visible latency on every mutating request once a backlog exists;
lock contention that makes the backlog worse. Amplifies `🐞 BUG-database-03`.
**Suggested fix:** either fire-and-forget the post-commit drain (`void this.dispatcher.drain()`,
the poll is already the safety net), or bound it — drain at most the events this unit of
work produced — and move subscriber invocation outside the claiming transaction (claim →
commit → deliver → stamp).

### 🐞 BUG-database-05 — Unverified — A subscriber may miss events if the poll backstop drains before it registers · Severity: Low

**Location:** `packages/database/src/lib/outbox/outbox-dispatcher.ts:119-125` vs `packages/activity/server/src/lib/activity/infrastructure/audit-event.subscriber.ts:36-38`
**Category:** data-loss

**What the code does:** both the dispatcher's timer and the subscriber's registration happen
in `onApplicationBootstrap`:

```ts
// OutboxDispatcher
onApplicationBootstrap(): void { this.timer = setInterval(() => { void this.pollOnce(); }, POLL_INTERVAL_MS); … }

// AuditEventSubscriber
onApplicationBootstrap(): void { this.dispatcher.register(this); }
```

**Why it is wrong:** if the dispatcher's hook runs first and a poll tick fires before the
subscriber's hook, the drain finds pending rows left over from a previous run, delivers them
to an empty subscriber list, and stamps `dispatchedAt` — permanently marking them delivered
for a subscriber that never saw them. `subscribersFor` returning an empty array is treated
as success (`:97-103`), not as "nobody was listening".

**What I could not confirm:** whether Nest can actually interleave the two. The first tick
is 5 s after the dispatcher's hook, and Nest invokes `onApplicationBootstrap` for all
providers before `app.listen` resolves — so in practice both hooks almost certainly complete
within the same tick, making this unreachable today. It becomes reachable if the poll
interval is shortened, if a subscriber registers lazily (e.g. from a request), or if a
module's bootstrap hook itself awaits something slow.

**Repro (hypothetical):**
1. Leave undispatched rows in `outbox_events`.
2. Delay `AuditEventSubscriber.onApplicationBootstrap` by 6 s.
3. Boot.
→ Observed: the rows are stamped `dispatched_at` with no `activity_events` rows written.

**Blast radius:** silent, permanent loss of an event for one subscriber. Low today because
of the timing above and because there is only one subscriber.
**Suggested fix:** start the poll timer on `onApplicationBootstrap` of a provider ordered
after registration, or skip stamping a row whose `subscribersFor(kind)` list is empty *and*
whose kind is not known to the registry.

**Checked and cleared** (no defect found): `initDatabase`'s idempotency guard is correct for
the synchronous single-threaded case (`db.ts:14-17`); the `database.tokens.ts` split is a
genuine fix for a real TDZ import cycle and the reasoning in its header comment holds;
`attachActor` is correctly non-mutating and returns fresh objects (`domain-event.ts:85-91`);
`createDomainEvent` fills both optional fields correctly and uses `randomUUID` rather than a
weak generator; the nested-`run` join is correct and does not double-drain
(`unit-of-work.ts:46-49`); `subscribersFor`'s `'*'` handling is correct
(`outbox-dispatcher.ts:156-157`); `pollOnce`'s `draining` flag correctly prevents overlapping
*polls* and its `finally` cannot leave the flag stuck (`:140-150`); the timer is `unref`'d so
it cannot hold the process open (`:124`); `OutboxWriter.append`'s empty-array short-circuit
is correct; and the `outbox_events` schema's use of the event id as both PK and idempotency
key is sound, with `AuditEventSubscriber`'s `onConflictDoNothing` correctly closing the
at-least-once loop.

**Tally:** `5 🐞 — 0 Critical · 1 High · 3 Medium · 1 Low (0 🔒)` ·
`♿ 0 findings — 0 Supports · 0 Partially Supports · 0 Does Not Support · 9 Not Applicable`

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` (testcontainer + supertest; drive the dispatcher directly via `harness.app.get(OutboxDispatcher)`) | `apps/server-e2e/src/server/outbox/outbox-poison.spec.ts` | Register an always-throwing subscriber; produce 101 events; assert `attempts` climbs, and that the 101st event is **still delivered** to a working subscriber. Currently fails | F19, EC-19, `🐞 BUG-database-01` |
| 2 | `apps/server-e2e` | `apps/server-e2e/src/server/outbox/outbox-atomicity.spec.ts` | Inside one `UnitOfWork.run`, write a domain row and append an event, then throw: assert **neither** the row nor the outbox row exists. Then repeat with the append succeeding and the domain write failing | F11, F16, EC-10 |
| 3 | `apps/server-e2e` | `apps/server-e2e/src/server/outbox/outbox-drain.spec.ts` | Seed 150 pending rows; call `drain()` once and assert exactly the oldest 100 are stamped; call it again and assert the remaining 50 are; assert `dispatched_at` is set and `attempts` stays 0 on success | F17, F18 |
| 4 | Unit (`packages/database/src/lib/uow/__test__/unit-of-work.spec.ts`, jest, fake `Database`) | `UnitOfWork` | `current()` returns the tx inside `run` and the base db outside it; a nested `run` opens exactly one transaction; `drain()` is called once after the **outermost** commit and never after a rollback; a throwing `drain` does not fail `run` | F12, F13, F14, EC-08 |
| 5 | Unit (`packages/database/src/lib/outbox/__test__/outbox-dispatcher.spec.ts`) | subscriber matching | `subscribersFor` returns injected + registered, honours `'*'` and an explicit allow-list, and a throwing subscriber does not prevent the *other* subscribers of the same event from running (today it does — assert the current behaviour, then decide) | F20, EC-20 |
| 6 | `apps/server-e2e` | `apps/server-e2e/src/server/outbox/outbox-concurrency.spec.ts` | Two `drain()` calls in flight against 200 pending rows deliver each event to a subscriber **exactly once within the pair** (proving `SKIP LOCKED`), and neither call blocks | F17, EC-29 |
| 7 | Unit (`packages/database/src/lib/events/__test__/domain-event.spec.ts`) | envelope builders | `createDomainEvent` fills `eventId`/`occurredAt` and preserves explicit ones; `attachActor` does not mutate its input, handles `email: null`, and its behaviour when the payload already carries an `actor` key is pinned | F9, F10 |
| 8 | `apps/server-e2e` | `apps/server-e2e/src/server/outbox/outbox-poll.spec.ts` | Insert a pending row with raw SQL (no HTTP request at all) and assert it is delivered within ~2 poll intervals — pinning the backstop that `UnitOfWork`'s swallowed drain relies on | F22, F14 |
| 9 | Unit (`packages/database/src/lib/utils/__test__/db.spec.ts`) | connection singleton | `getDatabase`/`getPool` throw the documented message before init; `initDatabase` twice returns the same pool and ignores the second config (pinning EC-03 as known behaviour) | F3, F4, EC-03 |
| 10 | `apps/server-e2e` | `apps/server-e2e/src/server/outbox/outbox-redelivery.spec.ts` | Force a re-delivery (reset `dispatched_at` to null on a delivered row, drain again) and assert `activity_events` still holds exactly one row — pinning the idempotency contract subscribers are required to honour | EC-31 |

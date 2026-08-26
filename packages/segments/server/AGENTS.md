# `@orthacms/segments-server`

The **segmentation plugin** — reader entitlements enforced on the public content
API. Two tables, two controllers, one predicate.

```
src/lib/
  segments.module.ts          the one dynamic module
  schema/                     segments · entry_access
  application/
    segment-catalog.service.ts  every segment, cached, read synchronously
    reader.store.ts             who is reading, for one request
    segments.service.ts         the directory CRUD
    entry-access.service.ts     one entry's two lists — the whole write path
  infrastructure/
    segment-read-scope.ts       the CONTENT_READ_SCOPE implementation
  http/
    reader.middleware.ts        resolves the reader once per request
    segments.controller.ts      /api/segments
    entry-access.controller.ts  /api/segments/entries/:id
```

## What it owns

| Route                        | Scope        | Permission                          |
| ---------------------------- | ------------ | ----------------------------------- |
| `/segments`                  | installation | `segments:read` / `segments:manage` |
| `/segments/entries/:entryId` | workspace    | `segments:read` / `segments:manage` |

`segments:read` is held by contributor and viewer — an editor who cannot see
that an entry is restricted will publish one believing it is public.
`segments:manage` is admin-only: renaming a segment's tags changes who every
entry naming it is visible to.

## The decisions that are easy to get wrong

**Enabling the plugin must change nothing.** With no segment created, the
catalogue is empty, the read scope returns `undefined`, no fragment is emitted,
and a public read is byte-for-byte what it was before. That is the state every
existing installation is in, and it is the first thing to keep true.

**No row means unrestricted; no reader context means anonymous.** Two absences,
two opposite readings, both deliberate. An entry with no `entry_access` row is
open — that is what every entry starts as, and reading absence as a closed door
would black out an installation on install. A request the middleware did not
cover is an _anonymous reader_ — unrestricted content still serves, restricted
content does not — because treating an unknown caller as unconstrained would
turn every gap in coverage into an open door.

**The predicate is `canRead` in SQL, line for line.**

```sql
COALESCE((
  SELECT NOT (ea.deny && $reader)
     AND (cardinality(ea.allow) = 0 OR ea.allow && $reader)
  FROM entry_access ea WHERE ea.entry_id = article.id
), true)
```

The kernel's spec says the three rules are right; `segment-read-scope.spec.ts`
says the database agrees. `COALESCE(…, true)` is the load-bearing half — without
it the whole library goes dark the moment the plugin is installed.

**A write is one upsert, and there is nothing else to re-derive.** The row an
editor saves is the row a reader is matched against, so a `PUT` that returns 200
means the change is live. That property is the entire return on the simple
model: no projection, no rule resolution, no re-projection sweep, no write hook
on the entry pipeline.

**Two empty lists delete the row.** Storing them would work and would leave
every entry anyone ever opened paying for a row on the read path.

**Deleting a segment scrubs it from every entry, in one transaction.** Left
behind, the id would resolve to nobody — silently closing content on the allow
side and opening it on the deny side, with nothing on screen to say why.

**The catalogue is read synchronously, so it is loaded at boot.**
`CONTENT_READ_SCOPE` is called inside the query builder and cannot await.
`onApplicationBootstrap` runs inside `app.init()`, so a catalogue that cannot be
read aborts start-up rather than leaving a server that serves restricted content
as though nothing were configured.

**A registered scope, not a bound token.** Nest has no multi-provider: two
plugins binding one DI token do not merge, the second replaces the first
silently. For a visibility rule that means content quietly becoming visible, so
the scope is registered through `contentReadScopeRegistrar('segments', …)`.

**Middleware, and `{*splat}`.** The reader has to be resolved _around_ the rest
of the request, which is what `AsyncLocalStorage` needs and only middleware can
arrange. The pattern is `{*splat}` because Express 5 uses path-to-regexp 8,
where the historical `'*'` is a parse error rather than a wildcard — a mistake
no typecheck catches and that would leave the plugin silently never running.

**The resolver fails closed and never rejects the request.** An unreachable
entitlement source produces the anonymous reader, not a 500.

## What is not here yet

- **Deletes are not hooked.** A hard-deleted entry leaves its `entry_access` row
  behind. Nothing joins to an id that no longer exists, so the cost is disk
  rather than correctness.
- **Defaults per collection or per workspace.** Every decision is per entry
  today. A default would be inheritance, which is the thing this design dropped
  on purpose; if it comes back it should come back as one explicit rule, not as
  a chain.
- **server-e2e coverage** for the two controllers.

## Commands

- `npx nx test @orthacms/segments-server`
- `npx nx run @orthacms/segments-server:db:generate --name=<change>` — commit the SQL
- `npx nx run server:db:migrate` — applies every plugin's pending migrations

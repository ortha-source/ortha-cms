# `@orthacms/segments-server`

The **segmentation plugin** — reader entitlements enforced on the public content
API. Layered per [ADR-0003](../../../docs/adr/0003-tactical-ddd-inside-plugins.md),
with one difference from the reference: the `domain/` layer is a package of its
own, [`@orthacms/segments-domain`](../domain/AGENTS.md), so this package holds
only `application`, `infrastructure` and `http`. The same split
`transfer/server` has with `transfer/domain`, and for the same reason — the
admin needs the vocabulary too.

```
src/lib/
  segments.module.ts            the one dynamic module
  segments.tokens.ts            SEGMENTS_CONFIG
  types/segments-config.ts      the plugin's public config contract
  utils/segments-plugin.ts      the factory
  access/
    application/
      segment-catalog.service.ts     types + segments, cached, read synchronously
      caller-segments.store.ts       who is reading, for one request
      declared-types.reconciler.ts   config-declared types into the catalogue
      projection.service.ts          a resolved rule → entry_access rows
    infrastructure/
      schema/                        six tables + the slot columns
      predicate/access-plan.ts       the pure half of the compiler
      predicate/access-predicate.ts  the Drizzle half
      read-scope/                    the CONTENT_READ_SCOPE implementation
    http/middleware/                 resolves the reader once per request
```

## What it owns

Six tables, its own migrations, and one seam into content's read path. It owns
**no HTTP routes yet** — managing types, segments, rules and assignments is the
next package in the stack, and until then the engine is driven through
`ProjectionService` and the catalogue directly.

## The decisions that are easy to get wrong

**Enabling the plugin must change nothing.** With no segment type declared or
created, `planAccessPredicate` returns `null`, no fragment is emitted, and the
read is byte-for-byte what it was before. That is the state every existing
installation is in, and it is the first thing to keep true when changing the
compiler.

**No projected rows means unrestricted; no caller context means anonymous.**
Two absences, two opposite readings, and both are deliberate. An entry with no
`entry_access` rows is open — that is what every entry starts as, and reading
absence as a closed door would black out an installation on install. A request
the middleware did not cover is an _anonymous reader_ — unrestricted content
still serves, restricted content does not — because treating an unknown caller
as unconstrained would turn every gap in middleware coverage into an open door.

**Slots, not a column per type.** `allow_d1…allow_d8` are generic pairs a type
claims. That is what lets a type be created in the admin with no DDL while the
schema stays reproducible from a checkout; the alternative, `ALTER TABLE` at
runtime, puts the app's schema outside the migrations that define it. A retired
type goes `active → draining → free`, and its slot is only reusable once the
columns are zeroed — hand it over early and the new type silently inherits a
stranger's segment ids.

**The catalogue is read synchronously, so it is loaded at boot.**
`CONTENT_READ_SCOPE` is called inside the query builder and cannot await.
`onApplicationBootstrap` runs inside `app.init()`, so a catalogue that cannot be
read aborts start-up rather than leaving a server that serves restricted content
as though nothing were configured.

**Masks are resolved in code, never in SQL.** A reader's tags become segment ids
once per request, prefix matching included, so the predicate is a plain
intersection of two `uuid[]`s. Pushing the prefix match into SQL would put a
`LIKE` on the hot path for a rule that changes only when an administrator
changes it.

**A registered scope, not a bound token.** Nest has no multi-provider: two
plugins binding one DI token do not merge, the second replaces the first
silently. For a visibility rule that means content quietly becoming visible, so
the scope is registered at bootstrap through
`contentReadScopeRegistrar('segments', …)` — the same shape
`copilotToolsRegistrar` uses.

**Middleware, and `{*splat}`.** The reader has to be resolved _around_ the rest
of the request, which is what `AsyncLocalStorage` needs and what only middleware
can arrange. The route pattern is `{*splat}` because Express 5 uses
path-to-regexp 8, where the historical `'*'` is a parse error rather than a
wildcard — a mistake no typecheck catches and that would leave the plugin
silently never running.
`caller-segments.middleware.spec.ts` boots a real Nest app to pin both.

**The resolver fails closed and never rejects the request.** An unreachable
entitlement source produces the anonymous reader, not a 500: taking a site down
over content most of its readers can see anyway is the wrong trade.

## What is not here yet

- **Projection on write.** Nothing hooks entry creates and updates, so rows are
  written only by an explicit `ProjectionService` call. Doing it in the entry's
  own transaction needs a second content port (`afterUpdate` is single-binding
  and i18n holds it), and that lands with the management API — the hook is only
  meaningful once a rule can be assigned.
- **HTTP routes**, the admin UI, the `access` field on the GraphQL entry, and the
  `access_explain` tool.
- **A write benchmark.** Eight slots means sixteen GIN indexes. They should be
  nearly free while unused — `array_ops` produces no entries for an empty array
  — but that is a reasoning, not a measurement, and the slot count is the number
  to revisit against it.

## Commands

- `npx nx test @orthacms/segments-server`
- `npx nx run @orthacms/segments-server:db:generate --name=<change>` — commit the SQL
- `npx nx run server:db:migrate` — applies every plugin's pending migrations

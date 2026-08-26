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

Six tables, its own migrations, two seams into content — the read scope and the
entry write hook — and the management API under `/api/access`.

| Route                                     | Scope        | Permission                      |
| ----------------------------------------- | ------------ | ------------------------------- |
| `/access/segment-types`                   | installation | `access:read` / `access:manage` |
| `/access/segment-types/:typeKey/segments` | installation | `access:read` / `access:manage` |
| `/access/rules`                           | workspace    | `access:read` / `access:manage` |
| `/access/assignments`                     | workspace    | `access:read` / `access:manage` |
| `/access/grants`                          | workspace    | `access:read` / `access:manage` |
| `/access/explain`                         | workspace    | `access:read`                   |

Plus two contributions with no route of their own: the `access` field on the
public GraphQL entry (through content's `EntryAccessSourceRegistry`) and the
`access_explain` / `access_segment_types` agent tools (through the shared
`ToolRegistry`).

`access:read` is held by contributor and viewer — an editor who cannot see that
an article is restricted will publish one believing it is public. `access:manage`
is admin-only: a rule change changes what every reader of the site sees.

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

**Projection happens in the entry's own transaction.** The read predicate matches
against `entry_access`, so the gap between "the entry is live" and "the row that
hides it exists" is a gap in which restricted content is public. A post-commit
projector — an outbox subscriber, a job — leaves that gap open by construction,
so the hook runs inside the write and a failure rolls the entry back with it.

**Every management write re-projects.** A rule, an assignment or a grant changes
and the entries it governs did not move, so nothing else would re-derive them.
Skip the re-projection and the rule and the projection disagree indefinitely —
the projection being what readers actually get. The walk is batched by ascending
id and deliberately not one transaction: access is being _changed_, so there is
no instant at which the answer is not in flux, and holding locks over a whole
collection to pretend otherwise buys nothing.

**A grant carries no mode.** "Everyone except one" from the segment side would be
every segment but one — the complement, which is what the projection invariant
forbids. Exclusions live on the content side, in a rule.

**The GraphQL `access` field describes, it does not decide.** `entry_access`
rows exist exactly when a rule restricts an entry, so the source reads the fact
the read already acted on rather than re-evaluating the rule — a second
evaluation could disagree with the one that admitted the entry. It reports the
**axes**, never the segments: which segments are admitted would tell a consumer
of published content who _else_ may read it.

**The tools are reads, and that is a limit rather than a first instalment.**
Writing a rule from a chat turn changes what every reader of the site can see,
from an actor whose intent was expressed in prose and whose mistake surfaces as
missing content nobody reports for a week. `access:manage` stays something a
person does in the admin, where the change is reviewable before it lands.

**And they are `surfaces: ['copilot']` for a factual reason, not a preference.**
Both require `access:read`, and no API-token scope grants it — `scopePermissions`
gives `read` and `full` their content and media permissions and nothing else. On
MCP they would be filtered out of every `tools/list` and callable by nobody.
Widening a scope to reach them is the wrong fix: `access:read` is what the six
`/api/access` routes check, so that scope would open the whole management API to
a bearer token, and even its reads describe the tenant's business — its plan
tiers, how many organisations it has. An external agent that should ask this
needs a scope of its own.

## What is not here yet

- **The impact preview**, and the collection-level assignment surface.
- **Deletes are not hooked.** A hard-deleted entry leaves its projection rows
  behind. Nothing joins to an id that no longer exists, so the cost is disk
  rather than correctness; they are reclaimed by the next re-projection of that
  type.
- **Sources other than `manual`.** A type declaring a `contentType` or
  `external` source is accepted and its segments are still maintained by hand —
  the sync that would mirror them lands with the admin's picker.
- **A write benchmark.** Eight slots means sixteen GIN indexes. They should be
  nearly free while unused — `array_ops` produces no entries for an empty array
  — but that is a reasoning, not a measurement, and the slot count is the number
  to revisit against it.

## Commands

- `npx nx test @orthacms/segments-server`
- `npx nx run @orthacms/segments-server:db:generate --name=<change>` — commit the SQL
- `npx nx run server:db:migrate` — applies every plugin's pending migrations

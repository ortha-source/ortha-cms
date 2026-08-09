# @ortha-cms/content-graphql

The public content API **over GraphQL** — `POST /api/v1/graphql`. Same bearer
tokens, same workspace bucket, same scopes, same visibility rules as
`/api/v1/content`: a second **protocol** in front of the surface
[`@ortha-cms/content-server`](../server/AGENTS.md)'s `public-api/` already
serves over REST, not a second API.

Owns no schema, ships no migrations, and adds no credential. A token minted
before this package existed works against it unchanged.

> Decisions recorded in [ADR-0008](../../../docs/adr/0008-graphql-as-a-protocol-adapter.md);
> the original design write-up is [`docs/design/graphql-api.md`](../../../docs/design/graphql-api.md).

## The one rule

**This package is an adapter, not a second implementation.** A resolver's job is
to translate a GraphQL field plus its arguments into the DTO the existing public
REST read already takes, call the same service, and hand the result back.

```
articles(filter: …, pageSize: …)   →  PublicListEntriesQueryDto  →  PublicEntriesQuery.list
createArticle(input: …)            →  PublicSaveEntryDto         →  PublicEntryWritesService.create
```

Everything that decides _what a caller may see or do_ stays in `content-server`:
`ApiTokenGuard`, `ApiTokenWorkspaceGuard`, `resolveGrantedType`,
`PublicEntriesQuery.readableWhere`, the `CONTENT_ENTRY_EXTENSION` locale scope,
and the write pipeline (validation, relation deltas, media-target checks,
revision numbering under a per-entry advisory lock, the outbox, i18n sibling
sync). There is one visibility rule, one filter language, one grant gate, one
write path — so the two protocols cannot drift on what a `read`-scoped token
sees.

`ContentModule` is `global: true` and **exports** those collaborators, which is
the whole reason this package can be so small.

## Layout

```
src/lib/
  content-graphql.module.ts        # one controller, one config provider
  content-graphql.tokens.ts        # CONTENT_GRAPHQL_CONFIG
  types/config.ts                  # limits + schema-cache TTL, with defaults
  utils/content-graphql-plugin.ts  # the ServerPlugin factory
  schema/
    build-schema.ts                # (registry, grantSet) → GraphQLSchema. Pure.
    schema-cache.ts                # memoised per grant set, TTL'd
    naming.ts                      # blog_post → BlogPost / blogPost / blogPosts
    field-types.ts                 # FieldSpec → GraphQL in/out types
    shared-types.ts                # MediaAsset, ContentTypeInfo, RelationDeltaInput
    scalars.ts                     # JSON, DateTime, Date
  resolvers/
    context.ts                     # what a resolver reads its collaborators from
    selection.ts                   # selection set → ?fields= / ?relations=preview
    entry-resolvers.ts             # list / single / page / relation / media / translations
    entry-loader.ts                # per-level batching for nested reads
    mutation-resolvers.ts          # create / update / publish / unpublish / delete
  execution/
    execute-operation.ts           # length → parse → cost → validate → execute
    limits.ts                      # depth / complexity / field-count / one-operation
    errors.ts                      # HttpException → GraphQLError extensions
  http/
    controllers/graphql.controller.ts   # POST + GET (SDL), behind the shared guards
    dto/graphql-request.dto.ts          # query / variables / operationName
```

`schema/` and `resolvers/` import **no NestJS** — they take a plain context
object — so the whole mapping layer is unit-testable without standing up a
module. Only `http/` and the module know about Nest.

## Four decisions worth knowing before touching this

### 1. The schema is built per **workspace grant set**, not once at boot

REST prunes `/v1/content-types` and 404s an ungranted `:typeName` so a token
cannot enumerate the content model beyond what its workspace exposes. A single
global schema would hand every token the entire model through **introspection**
— a strictly worse leak than the one REST goes out of its way to avoid.

So `buildContentSchema(registry, granted)` emits only the granted types, and
`SchemaCache` memoises on the sorted grant set. Consequences, all intended:

- **Introspection differs per token.** Two tokens with different grants get
  different SDL. Document this loudly; a developer comparing them will otherwise
  file a bug.
- **An ungranted type is a validation error**, not a 404 — the field does not
  exist, so the request never reaches a resolver. Stronger than REST manages.
- **The cache TTL is a freshness knob, not a security boundary.** Every resolver
  re-checks the live grant set through `resolveGrantedType`, so a stale schema
  can _describe_ a just-revoked type but can never _read_ it.
- A relation whose **target** is ungranted is omitted from the object type _and_
  from the write input. This is a deliberate divergence from REST, which would
  let you set such an FK: exposing a settable field pointing into an invisible
  type would advertise that type's existence in the SDL.

### 2. `graphql-js` inside a plain Nest controller, not `@nestjs/graphql`

Mostly forced by (1) — `GraphQLModule.forRoot` fixes one schema at boot. It also
buys the thing that matters most: `@UseGuards(ApiTokenGuard,
ApiTokenWorkspaceGuard)` works **as the same objects** on this route as on every
other `/v1` route. With `@nestjs/graphql` they would need a
`GqlExecutionContext` adapter (`switchToHttp()` returns nothing useful there) —
a fork in the authentication path, which is the one place a fork is least
affordable. It is also one dependency instead of three, and the endpoint stays
visible to the OpenAPI document and to `apps/server-e2e`'s supertest harness.

What we give up and where it went: depth/complexity limits are
`execution/limits.ts`; batching is `resolvers/entry-loader.ts`; GraphiQL is
rendered by `@graphql-yoga/render-graphiql` behind our own route (below).

### 3. The selection set becomes `?fields=`

`resolvers/selection.ts` reads what the caller selected and turns it into the
REST query parameters: value fields → `fields`, relation fields →
`relations=preview` + `relationFields` + `relationLimit`, media → `media=preview`,
`translations` → `translations=preview`.

The payoff is that a query asking `{ id title }` narrows the **SQL projection**
exactly as `?fields=id,title` does — an unselected richtext column is never read
— for free, because it is the same code path. Fragments are followed
(`...ArticleFields` is how real clients select), and one `relationLimit` has to
serve every expanded field, so it is sent as the **maximum** any field asked for
and each resolver slices its own view back down. `total` stays the true visible
count, so a short page is observable.

### 4. Nested reads batch per level

The REST expansion attaches **one** level: linked entries come back as full
records but with their own `relations`/`media` absent, which is what stops a
request walking the whole graph. GraphQL callers nest anyway, and the naive
version is an N+1.

`EntryLoader` collects every request made in one execution tick and issues **one
query per level** — a plain `PublicEntriesQuery.list` with a
`{ field: 'id', op: 'in' }` filter, so the load runs through the same
`readableWhere` as every other public read and needs no new query code and no
new visibility rule. Two known costs, both deliberate:

- The batch does not narrow `?fields=`, so it reads every value column of the
  level's parents. There is no spelling for "no values" (an empty `?fields=`
  means "no preference"), and one over-wide read per level beats one query per
  row.
- **`page > 1` on a relation is not batched.** It falls through to
  `relationField` — the same call `/relations/:field` serves — which on a wide
  list is one query per row. It is a targeted request, the complexity budget
  bounds it, and the SDL says so on the argument.

## Shape differences from REST, and why

| REST                                                                 | GraphQL                                 | Why                                                                 |
| -------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| a `single` type is served by the list route; clients take `items[0]` | `landing(locale:)` returns the record   | `items[0]` is storage leaking into a published API                  |
| an owning single relation is a raw FK in `values`                    | `author { name }` — the target itself   | a many-to-one holds at most one target; `items[0]` again            |
| `{ items, total, page, pageSize }`                                   | `{ items, total }`                      | the caller passed page/pageSize; echoing them is noise              |
| `"published"`                                                        | `PUBLISHED`                             | GraphQL enum-name convention; the value maps back                   |
| `DELETE` → 204                                                       | `deleteArticle` → `true`                | inventing a payload would be the protocols disagreeing              |
| errors carry an HTTP status                                          | HTTP 200 + `errors[].extensions.status` | how GraphQL works — the one thing a porting consumer must adjust to |

Everything else is byte-identical, and
`apps/server-e2e/src/server/api-tokens/public-graphql-api.spec.ts` asserts it
directly: same fixture, both protocols, compared field by field.

## Authorization

Authentication and workspace resolution are unchanged — the two exported guards
run on the controller. What moves is the **permission check**, because one
endpoint serves reads and writes and `@RequirePermissions` is per route:

- The controller keeps `@RequirePermissions(CONTENT_READ)` as the floor.
- Each mutation resolver asserts its own permission (`content:create` /
  `update` / `publish` / `delete`) through `context.assert`, which goes to the
  same `AccessPolicy` + `tokenActor` pair the guard uses.
- The draft rule (`status: DRAFT|ANY` ⟹ `content:update`) is asserted in the
  resolvers — the logic `DraftVisibilityGuard` holds for `?status=`, in the only
  place that can see a field's arguments.

`tokenActor` lives in `identity-server` and is shared by the guard and this
package, so "what may this token do?" has one answer.

## Writes

Mutations mirror the REST write routes one-for-one. Two details are easy to get
wrong:

- **Input fields must never declare a `defaultValue`.** The REST `PATCH` merges
  by key presence: a key you send is applied, a key you omit is left alone, an
  explicit `null` clears. graphql-js preserves that (an unmentioned input field
  is absent from the coerced object) — but a default _materialises_ the key and
  turns every omitted field into an overwrite. `build-schema.spec.ts` pins it.
- **The DTO is validated in the resolver.** A REST body meets the host's global
  `ValidationPipe`; a GraphQL argument never does. `mutation-resolvers.ts` runs
  `validateSync` on the assembled `PublicSaveEntryDto`, so the delta caps
  (`MAX_DELTA_FIELDS`, `MAX_DELTA_IDS`) still bound a single write.

## Cost limits

REST bounded a request structurally — one route, one page, `MAX_PAGE_SIZE`. A
GraphQL document does not, so `execution/limits.ts` enforces a budget **after
parsing and before execution**, cheapest check first:

| Limit              | Default | Catches                                               |
| ------------------ | ------- | ----------------------------------------------------- |
| `maxQueryLength`   | 16384   | an enormous document, before it is parsed             |
| `maxDepth`         | 8       | deep nesting (one loader batch per level)             |
| `maxAliases`       | 30      | aliasing one expensive field N times                  |
| `maxComplexity`    | 1000    | shallow-but-wide — `Σ pageSize` down the nesting path |
| operations/request | 1       | multiplying every other budget                        |

Two things the complexity estimator does on purpose: it assumes every list comes
back full (the point is to refuse shapes that _can_ be enormous), and it does
**not** count `items` as a list of its own — that is the page its parent already
sized, and counting it again squares every list and rejects ordinary documents.

Introspection stays **enabled**: the endpoint is authenticated, the schema is
already pruned to the caller's grants, and disabling it removes most of the
reason to offer GraphQL.

**Rate limiting is absent** — and so it is on the REST public API, which has no
throttle either (only login does). Worth its own issue; `request.apiToken.id` is
the natural key.

## The playground (`GET /v1/graphql/playground`)

GraphiQL, the GraphQL counterpart of the Scalar reference at `/reference` — and
gated by the same switch. Three things about it are deliberate:

- **Registered only when the host enables it.** `ContentGraphqlModule.forRoot`
  leaves the controller out entirely when `playground` is false, so a deployment
  with tooling off has no such route rather than a live handler that refuses.
  `apps/server` passes `docs.enabled`, which is off in production unless
  `API_DOCS=true`.
- **Unauthenticated, unlike every other route here.** You cannot paste a token
  into a page you are not allowed to load, so requiring one would be a
  chicken-and-egg. The page carries no content and reads nothing — it is a
  static asset that happens to be generated, and the credential is supplied by
  whoever opens it, in GraphiQL's header editor. A public page inviting a pasted
  credential is precisely why it is dev-gated rather than always on.
- **Self-contained, no CDN.** The renderer inlines the whole bundle (~9 MB of
  HTML), which is what makes an air-gapped install work — the same reason the
  Scalar reference takes a `cdn` option pointing at a self-hosted copy. It is
  memoised per endpoint URL, since re-rendering 9 MB per reload buys nothing.

The endpoint the editor posts to is **derived from the request path** (drop the
trailing `/playground`) rather than configured, because the plugin does not know
the host's global prefix — `createServer` owns that.

`packages/content/graphql` depends on `@graphql-yoga/render-graphiql`, which is
why this package pins **graphql 16**: every package that ships a _prebuilt_
GraphiQL bundle peers on graphql ≤16, and `graphiql` itself is an ESM React
library needing a build step these source-consumed packages do not have. 16 is
also what the wider tooling ecosystem expects. See `coercedVariables` in
`resolvers/selection.ts` for the one place a v17 upgrade would otherwise bite.

## Not shipped

- **Typed filter inputs.** `filter` is the existing JSON tree behind a `JSON`
  scalar, so there is exactly one filter language and one validator. A generated
  `ArticleFilterInput` is the natural next step.
- **Subscriptions.** Nothing publishes content events over a transport yet.
- **A grant-change cache-invalidation hook.** The TTL covers it; an explicit
  bust would need a port from `workspaces-server`.

## Commands

- `npx nx test @ortha-cms/content-graphql` — the unit suite (schema build,
  naming, selection derivation, limits, error mapping, cache).
- `npx nx typecheck @ortha-cms/content-graphql` / `npx nx lint @ortha-cms/content-graphql`
- `npx nx e2e server-e2e -- --testPathPatterns public-graphql` — the endpoint
  suites (needs Docker for the testcontainer).

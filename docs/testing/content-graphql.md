# @orthacms/content-graphql — Test Artifact

> **Unit:** `packages/content/graphql` · **Package:** `@orthacms/content-graphql` · **Kind:** server plugin (protocol adapter)
> **Source of truth:** `packages/content/graphql/AGENTS.md`
> **Findings verified:** 2026-08-11 — 5 confirmed · 0 deleted · 2 corrected · 1 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** exactly four things, and nothing else: the **schema derivation** from a
workspace's content grants (`schema/`), the **resolvers** that translate a
GraphQL field into the DTO the existing public REST read already takes
(`resolvers/`), the **cost budget** enforced before execution (`execution/`),
and the **error mapping** from `HttpException` to `GraphQLError.extensions`.
Plus two routes and a dev-gated GraphiQL page.

**Does NOT own** — and this is the whole premise of
[ADR-0008](../adr/0008-graphql-as-a-protocol-adapter.md):

- authentication or workspace resolution — `ApiTokenGuard` /
  `ApiTokenWorkspaceGuard` are imported from `content-server` and run **as the
  same objects** on this route as on every other `/v1` route
  (`src/lib/http/controllers/graphql.controller.ts:77`);
- what a token may see — `PublicEntriesQuery.readableWhere`, `resolveGrantedType`,
  the `CONTENT_ENTRY_EXTENSION` locale scope;
- the write pipeline — validation, relation deltas, media-target checks,
  revision numbering under a per-entry advisory lock, the outbox, i18n sibling
  sync (all `PublicEntryWritesService`);
- the filter language — the tree crosses as a `JSON` scalar and is
  **re-serialised** back to the REST `?filter=` string so there is one parser
  (`src/lib/resolvers/selection.ts:246-253`);
- **any schema, migration, table or credential.** The plugin adds none. A token
  minted before this package existed works against it unchanged.

### Entry points

| Verb + path | Handler | Auth |
| --- | --- | --- |
| `POST /api/v1/graphql` | `GraphqlController.execute` (`graphql.controller.ts:106-126`) | `ApiTokenGuard` + `ApiTokenWorkspaceGuard` + `@RequirePermissions(CONTENT_READ)` (class-level, `:76-78`) |
| `GET /api/v1/graphql` | `GraphqlController.sdl` (`:136-146`) — `printSchema` of this workspace's schema, `text/plain` | **same class-level guards** — verified from the decorators, see EC-32 |
| `GET /api/v1/graphql/playground` | `GraphqlPlaygroundController.playground` (`graphql-playground.controller.ts:44-61`) | **`@Public()`, no guards**, and registered only when the host passes `playground: true` (`content-graphql.module.ts:36-39`) |

**Exports** (`src/index.ts`): `ContentGraphqlPlugin`, `ContentGraphqlModule`,
`ContentGraphqlPluginConfig` / `…Options` / `ResolvedContentGraphqlConfig`,
`DEFAULT_GRAPHQL_LIMITS`, `DEFAULT_SCHEMA_CACHE_TTL_MS`, `buildContentSchema`,
`SchemaCache`, the naming helpers, `checkLimits` / `estimateComplexity`,
`toGraphQLError`, `executeOperation`, `EntryLoader`, and the selection helpers.

**DI it consumes** (all from `ContentModule`, which is `global: true`):
`InjectContentRegistry`, `WorkspaceGrantsQuery`, `PublicEntriesQuery`,
`PublicEntryWritesService`; plus `AccessPolicy` from `identity-server`.

**Composition-time invariant:** `ContentGraphqlPlugin` runs
`assertNoNameCollisions(content.registry.all().map(t => t.name))`
(`utils/content-graphql-plugin.ts:72`) against the **whole** registry, so two
content types that would collide as GraphQL names fail the host's boot rather
than the first request from a workspace granted both.

### Runtime prerequisites

- Postgres (`docker compose up -d`), migrations applied, and the host running
  with `ContentGraphqlPlugin` in its plugin list
  (`apps/server/src/plugins.ts:67-75`). **There is no `enabled` flag** — omitting
  the plugin is the off switch.
- An **API token** minted in the admin (API Tokens page) with scope `read` or
  `full`, over one or more workspaces.
- The target workspace needs **content grants** (`workspace_content`) — with
  none, the schema has only `Query.contentTypes` and no content fields at all.
- `X-Workspace-Id` is **required** when the token covers more than one
  workspace, optional when it covers exactly one.
- The playground needs `API_DOCS=true` (`apps/server/src/plugins.ts:73` passes
  `config.docs.enabled`), which is off in production.
- Limits are host-tunable via `GRAPHQL_MAX_DEPTH` / `GRAPHQL_MAX_COMPLEXITY` /
  `GRAPHQL_MAX_FIELDS` / `GRAPHQL_MAX_QUERY_LENGTH`
  (`apps/server/ortha.config.ts:177-184`); defaults 8 / 1000 / 30 / 16384.

### How to exercise it manually

```bash
docker compose up -d && npm run dev
export T='orthacms_…'          # from the admin's API Tokens page
export W='<workspace-uuid>'

# 1. The schema this token can see
curl -s -H "Authorization: Bearer $T" -H "X-Workspace-Id: $W" \
     http://localhost:3000/api/v1/graphql

# 2. A read
curl -s -X POST http://localhost:3000/api/v1/graphql \
     -H "Authorization: Bearer $T" -H "X-Workspace-Id: $W" \
     -H 'Content-Type: application/json' \
     -d '{"query":"{ articles(pageSize: 5) { total items { id title author { name } } } }"}'

# 3. A write (needs a `full`-scoped token)
curl -s -X POST http://localhost:3000/api/v1/graphql \
     -H "Authorization: Bearer $T" -H "X-Workspace-Id: $W" \
     -H 'Content-Type: application/json' \
     -d '{"query":"mutation($i: ArticleInput){ createArticle(input:$i){ id status } }","variables":{"i":{"title":"Draft"}}}'

# 4. Introspection
curl -s -X POST … -d '{"query":"{ __schema { types { name } } }"}'

# 5. The playground (API_DOCS=true only)
open http://localhost:3000/api/v1/graphql/playground
```

Suites:

```bash
npx nx test @orthacms/content-graphql                       # unit
npx nx e2e server-e2e -- --testPathPatterns public-graphql   # needs Docker
```

### Dependencies that must be healthy

`@orthacms/content-server` (the registry, the two guards, `PublicEntriesQuery`,
`PublicEntryWritesService`, `WorkspaceGrantsQuery`, `resolveGrantedType`, the
query DTOs and their constants — **a supported export surface; changing one
changes both protocols at once**), `@orthacms/identity-server` (`AccessPolicy`,
`tokenActor`, `PERMISSIONS`, `@Public`, `@RequirePermissions`),
`@orthacms/workspaces-server` (`@CurrentWorkspace`), `@orthacms/database`
(transitively), `graphql` **pinned at 16**, and
`@graphql-yoga/render-graphiql` (playground only).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `POST /v1/graphql` executes one query or mutation | `http/controllers/graphql.controller.ts:113-126` | ✅ E2E |
| F2 | `GET /v1/graphql` returns this workspace's SDL | `graphql.controller.ts:143-146` | ✅ E2E |
| F3 | Bearer authentication via the shared `ApiTokenGuard` | `graphql.controller.ts:77` | ✅ E2E |
| F4 | Workspace resolution / bucket check via `ApiTokenWorkspaceGuard` | `graphql.controller.ts:77` | ✅ E2E |
| F5 | A session cookie is **not** accepted in place of a token | (guard behaviour) | ✅ E2E |
| F6 | `@RequirePermissions(CONTENT_READ)` is the endpoint floor | `graphql.controller.ts:78` | ⚠️ PARTIAL |
| F7 | Schema built **per workspace grant set** | `schema/build-schema.ts:75-155` | ✅ E2E |
| F8 | Ungranted type absent from the schema → a **validation** error, not a 404 | `execution/execute-operation.ts:81-88` | ✅ E2E |
| F9 | Two workspaces get different SDL from the same token | `schema/schema-cache.ts:31-41` | ✅ E2E |
| F10 | Schema memoised per grant set behind a TTL | `schema-cache.ts:20-47` | 🧪 UNIT |
| F11 | Every resolver re-checks the **live** grant set (`resolveGrantedType`) | `resolvers/entry-resolvers.ts:345-355` | ⚠️ PARTIAL |
| F12 | A relation whose target is ungranted is omitted from the object type **and** the write input | `build-schema.ts:281-288` | 🧪 UNIT |
| F13 | `Query.contentTypes` discovery, pruned to grants | `build-schema.ts:387-398` | ✅ E2E |
| F14 | `article(id:)` / `article(localeGroupId:, locale:)` single read | `entry-resolvers.ts:95-110` | ✅ E2E |
| F15 | `articles(page:, pageSize:, sort:, search:, filter:, locale:, status:)` list | `entry-resolvers.ts:113-127` | ✅ E2E |
| F16 | A `single` type is served as one record, not `items[0]` | `entry-resolvers.ts:139-155` | ✅ E2E |
| F17 | `id` **xor** `localeGroupId` is enforced | `entry-resolvers.ts:328-345` | ❌ NONE |
| F18 | Value fields resolved out of the `values` bag | `entry-resolvers.ts:164-168` | ✅ E2E |
| F19 | Owning single relation served as the **target**, not a list | `entry-resolvers.ts:211-225` | ✅ E2E |
| F20 | Join-backed relation served as `{ items, total }` with `page`/`pageSize` | `build-schema.ts:339-370` | ✅ E2E |
| F21 | Relation page 1 reuses the parent's expansion — no extra query | `entry-resolvers.ts:238-241` | ⚠️ PARTIAL |
| F22 | Relation nested past the parent's expansion goes through `EntryLoader` | `entry-resolvers.ts:243-257` | ⚠️ PARTIAL |
| F23 | Relation `page > 1` falls through to `relationField` (deliberately unbatched) | `entry-resolvers.ts:260-271` | ❌ NONE |
| F24 | Media fields resolved to assets, returned as a bare list with `limit` | `entry-resolvers.ts:283-306` | 🧪 UNIT |
| F25 | `translations` — the entry's other locale rows | `entry-resolvers.ts:313-333` | ✅ E2E |
| F26 | Selection set → `?fields=` (SQL projection narrowing) | `resolvers/selection.ts:179-199` | 🧪 UNIT |
| F27 | Selection set → `relations=preview` + `relationFields` + `relationLimit` | `selection.ts:186-190` | 🧪 UNIT |
| F28 | One `relationLimit` = the **max** any field asked; each resolver slices back | `selection.ts:189`, `entry-resolvers.ts:348-358` | ✅ E2E |
| F29 | Fragments and inline fragments followed when deriving the selection | `selection.ts:86-107` | 🧪 UNIT |
| F30 | `EntryLoader` batches one query per level, per (type, locale, cap) | `resolvers/entry-loader.ts:63-95` | ⚠️ PARTIAL |
| F31 | The batch runs through `PublicEntriesQuery.list` + an `id in […]` filter — same `readableWhere` | `entry-loader.ts:125-131` | ❌ NONE |
| F32 | The batch chunks at `MAX_PAGE_SIZE` rather than truncating | `entry-loader.ts:123-124` | ❌ NONE |
| F33 | Draft rule: `status: DRAFT|ANY` requires `content:update` | `entry-resolvers.ts:301-313` | ✅ E2E |
| F34 | `createX(input:, relations:, locale:, localeGroupId:)` | `resolvers/mutation-resolvers.ts:38-54` | ✅ E2E |
| F35 | `updateX` — a **partial** update, by key presence | `mutation-resolvers.ts:57-74,139-151` | ✅ E2E |
| F36 | Write input fields never declare a `defaultValue` | `build-schema.ts` (input builders) | 🧪 UNIT |
| F37 | `publishX` / `unpublishX` | `mutation-resolvers.ts:77-102` | ✅ E2E |
| F38 | `deleteX` returns `true` (REST answers 204) | `mutation-resolvers.ts:112-126` | ✅ E2E |
| F39 | Each mutation asserts its own permission via `context.assert` | `mutation-resolvers.ts:42,61,82,116` | ✅ E2E |
| F40 | The assembled `PublicSaveEntryDto` is `validateSync`'d in the resolver | `mutation-resolvers.ts:159-171` | ⚠️ PARTIAL |
| F41 | Addressing locale is dropped when an `id` locator is used | `mutation-resolvers.ts:205-210` | ❌ NONE |
| F42 | Relation deltas applied through the shared write path | `mutation-resolvers.ts:146-149` | ✅ E2E |
| F43 | Limit: `maxQueryLength` (before parsing) | `execution/execute-operation.ts:44-53` | ✅ E2E |
| F44 | Limit: `maxDepth` | `execution/limits.ts:176-184` | ✅ E2E |
| F45 | Limit: `maxAliases` (really a total **field count**) | `limits.ts:186-194` | ✅ E2E |
| F46 | Limit: `maxComplexity` (Σ pageSize down the nesting path) | `limits.ts:196-209,309-372` | ✅ E2E |
| F47 | One operation per request unless `operationName` names one | `limits.ts:145-171` | ✅ E2E |
| F48 | `items` excluded from complexity multiplication | `limits.ts:214-226,387` | 🧪 UNIT |
| F49 | Cyclic fragment spreads do not hang the cost checker | `limits.ts:222-258` (the `visiting` set) | 🧪 UNIT |
| F50 | Limits run **before** execution, so a refused query costs a parse | `execute-operation.ts:37-88` | ✅ E2E |
| F51 | `HttpException` → `GraphQLError` with `code` + `status` (+ `issues` on 422) | `execution/errors.ts:54-63` | ✅ E2E |
| F52 | Anything not an `HttpException` is logged and replaced with a blank message | `errors.ts:65-74` | 🧪 UNIT |
| F53 | An `HttpException` wrapped inside a `GraphQLError` is unwrapped | `errors.ts:38-52` | 🧪 UNIT |
| F54 | Introspection stays **enabled** | (no `NoSchemaIntrospectionCustomRule` in `specifiedRules`, `execute-operation.ts:81`) | ❌ NONE |
| F55 | Name collisions across the whole registry fail **boot** | `utils/content-graphql-plugin.ts:72`, `schema/naming.ts:140-151` | 🧪 UNIT |
| F56 | A content field colliding with the GraphQL envelope throws | `build-schema.ts:272-277` | 🧪 UNIT |
| F57 | `select` options become an enum, or fall back to `String` when ambiguous | `naming.ts:106-112` | 🧪 UNIT |
| F58 | SDL is stable across builds (types sorted) | `build-schema.ts:87-90` | 🧪 UNIT |
| F59 | GraphiQL playground, self-contained, memoised, endpoint derived from the path | `graphql-playground.controller.ts:41-78` | ✅ E2E |
| F60 | The playground controller is **not registered** when tooling is off | `content-graphql.module.ts:36-39` | ✅ E2E |
| F61 | `GraphqlRequestDto` satisfies the host's `forbidNonWhitelisted` pipe | `http/dto/graphql-request.dto.ts:14-45` | ✅ E2E |
| F62 | Host-tunable limits + schema-cache TTL with defaults | `types/config.ts:66-90` | ⚠️ PARTIAL |
| F63 | **No rate limiting** (documented, matches REST) | `AGENTS.md` "Rate limiting is absent" | ❌ NONE |

## 3. Manual Test Plan

Common preconditions: the stack is up; workspace `W` is granted `article`
(collection, publishable, i18n) and `tag` (collection), and **not** `page`;
workspace `W2` is granted `page` only. `T_READ` is a `read`-scoped token over
`W`; `T_FULL` is a `full`-scoped token over `W`; `T_BOTH` covers `W` and `W2`.
All requests below are `POST /api/v1/graphql` with
`Content-Type: application/json` unless stated.

### F1 / F51 — Executing an operation and reading an error

**Preconditions:** `T_READ`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{"query":"{ contentTypes { name kind publishable i18n } }"}` | HTTP **200**, `data.contentTypes` lists `article` and `tag`; no `errors` |
| 2 | `{"query":"{ article(id: \"00000000-0000-0000-0000-000000000000\") { id } }"}` | HTTP **200**, `data.article` is `null` (an unknown id, a draft and another workspace's row are the same null) |
| 3 | `{"query":"{ article { id } }"}` (no locator) | HTTP 200, `errors[0].extensions.status` = `400`, `code` = `BAD_REQUEST`, message "Pass `id`, or `localeGroupId` with an optional `locale`." |
| 4 | `{"query":"{ nope }"}` | HTTP 200, a validation error `Cannot query field "nope"` — no `data` |
| 5 | `{"foo":1}` | HTTP **400** — the host's `ValidationPipe` rejects the body before the controller |
| 6 | `{"query":"{ articles { items { id } } }", "operationName":"X"}` | HTTP 200, `No operation named "X" in this document.` |

### F2 / F7 / F8 / F9 / F13 — Grant-derived schema

**Preconditions:** `T_READ` (workspace `W`), `T_BOTH`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/v1/graphql` with `T_READ` | 200, `text/plain` SDL containing `type Article`, `type Tag`; **not** `type Page` |
| 2 | Read the `Query` type in that SDL | `article`, `articles`, `tag`, `tags`, `contentTypes` — and no `page` field |
| 3 | `POST` `{ pages { total } }` with `T_READ` | HTTP 200, `Cannot query field "pages" on type "Query"` — **no resolver ran** |
| 4 | `GET /api/v1/graphql` with `T_BOTH` + `X-Workspace-Id: W` | SDL contains `type Tag` |
| 5 | Same token, `X-Workspace-Id: W2` | SDL does **not** contain `type Tag`; it contains `type Page` |
| 6 | Repeat step 4 immediately | Byte-identical SDL, served from the memoised schema (TTL 60 s by default) |
| 7 | Run the standard introspection query (`{ __schema { types { name } } }`) with `T_READ` | Succeeds; the type list is the pruned set. Introspection is deliberately **on** |
| 8 | `GET /api/v1/graphql` with **no** `Authorization` header | HTTP **401** — the guards are declared on the controller class, so `GET` carries them too (`graphql.controller.ts:76-78`) |
| 9 | Revoke `W`'s `tag` grant, then re-run step 1 within the TTL | The SDL still shows `type Tag` (stale by design) — but `{ tags { total } }` now returns a **404** error from `resolveGrantedType`. The cache is a freshness knob, not the authorization |

### F3 / F4 / F5 / F6 — Authentication and the workspace bucket

**Preconditions:** as noted per row.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | POST with no `Authorization` | **401** |
| 2 | POST with `Authorization: Bearer orthacms_garbage` | **401** |
| 3 | Sign in to the admin, then POST with only the session cookie | **401** — a session is not a token here |
| 4 | `T_READ` (covers `W` only) + `X-Workspace-Id: W2` | **403** — outside the bucket |
| 5 | `T_BOTH` with **no** `X-Workspace-Id` | **400** — a multi-workspace token must name one |
| 6 | `T_READ` with no header | 200 — a single-workspace token needs none |
| 7 | A token whose scope somehow lacks `content:read` | **403** from `PermissionsGuard`. `scopePermissions` always mints `content:read`, so this is unreachable today — see EC-25 |

### F14 / F15 / F16 / F17 / F18 — Reads

**Preconditions:** `T_READ`; `W` holds 30 published articles and 2 drafts.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{ articles(pageSize: 5) { total items { id title } } }` | `total` = 30 (drafts excluded), `items` has 5 entries |
| 2 | `{ articles(page: 2, pageSize: 5, sort: "-updatedAt") { items { id } } }` | The second page, newest-updated first |
| 3 | `{ articles(search: "hello") { total } }` | The same rows `GET /v1/content/article?search=hello` returns |
| 4 | `{ articles(filter: {and:[{field:"title",op:"ilike",value:"%a%"}]}) { total } }` | Identical to the REST `?filter=` with the same tree — the tree is re-serialised, not re-parsed |
| 5 | `{ article(id: "<published id>") { id title createdAt } }` | The record; `createdAt` is an ISO `DateTime` |
| 6 | `{ article(id: "<draft id>") { id } }` | `null` — a draft is invisible to a read token |
| 7 | `{ article(id: "<id in W2>") { id } }` | `null` — cross-tenant reads as absent, not forbidden |
| 8 | `{ article(id: "x", localeGroupId: "y") { id } }` | `BAD_REQUEST` "Pass either `id` or `localeGroupId`, not both." |
| 9 | `{ homePage { title } }` (a `single` type) | The record itself — **not** `{ items: [...] }` |
| 10 | `{ articles { items { id } } }` then compare with `GET /v1/content/article` | Same ids, same order, same visibility |

### F19 / F20 / F21 / F22 / F23 / F28 — Relations

**Preconditions:** `T_READ`; `article.author` is an owning many-to-one to
`author`; `article.tags` is many-to-many to `tag` with 12 links on article `A`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{ article(id: "A") { author { id name } } }` | `author` is the **target object** (or `null`), never `{ items: [...] }` |
| 2 | `{ article(id: "A") { tags { total items { label } } } }` | `total` = 12, `items` = the default expansion limit's worth |
| 3 | `{ article(id: "A") { tags(pageSize: 3) { total items { label } } } }` | `total` still 12, `items` = 3 — a short page is observable |
| 4 | `{ articles(pageSize: 5) { items { tags(pageSize: 2) { items { label } } } } }` | One list query with `relations=preview`; **no** per-row relation query |
| 5 | `{ articles { items { tags { items { articles { items { id } } } } } } }` | Level 2+ goes through `EntryLoader` — one query per level. Watch the SQL log: it must not scale with row count |
| 6 | `{ article(id: "A") { tags(page: 2, pageSize: 5) { items { label } } } }` | Falls through to `relationField` — the same call `/relations/:field` serves. Deliberately unbatched |
| 7 | Point `article.secret` at an **ungranted** type and re-read the SDL | The field is absent from `type Article` **and** from `ArticleInput` |
| 8 | Unpublish a linked tag, re-run step 2 | It disappears from `items` **and** from `total` — a target the caller may not see is neither shown nor counted |

### F24 / F25 — Media and translations

**Preconditions:** `T_READ`; `article.hero` is a media field with 4 assets;
`article` is `i18n` with `en`/`de` siblings.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `{ article(id: "A") { hero { id url mimeType } } }` | A **bare list** of assets, in stored order — no `{ items, total }` envelope |
| 2 | `{ article(id: "A") { hero(limit: 2) { id } } }` | Two assets; the truncation is visible as a short list |
| 3 | `{ article(id: "A") { locale localeGroupId translations { locale title } } }` | The entry's **other** published locale rows, ordered by locale slug; the entry itself is not repeated |
| 4 | `{ article(localeGroupId: "G", locale: "de") { title } }` | The German row of group `G` |
| 5 | Read `translations` on an entry reached through someone else's expansion | Resolved via the loader, not an N+1 |

### F33 — The draft rule

**Preconditions:** `T_READ` and `T_FULL`.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `T_READ`: `{ articles(status: DRAFT) { total } }` | HTTP 200, `errors[0].extensions.code` = `FORBIDDEN`, message "status: DRAFT requires a token with write scope." |
| 2 | `T_READ`: `{ articles(status: ANY) { total } }` | Same |
| 3 | `T_READ`: `{ articles(status: PUBLISHED) { total } }` | Allowed |
| 4 | `T_FULL`: `{ articles(status: DRAFT) { total items { status } } }` | Drafts returned; every `status` is `DRAFT` |
| 5 | `T_READ`: `{ article(id: "<draft>", status: DRAFT) { id } }` | `FORBIDDEN` — the rule is asserted on the single read too (`entry-resolvers.ts:100`) |
| 6 | `T_READ`: `{ homePage(status: ANY) { id } }` | `FORBIDDEN` — asserted on the page resolver too (`:144`) |

### F34 – F42 — Mutations

**Preconditions:** `T_FULL` for the happy path, `T_READ` for the refusals.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `T_READ`: `mutation { createArticle(input: {title:"x"}) { id } }` | `FORBIDDEN`, "This token's scope does not allow content:create." |
| 2 | Repeat for `updateArticle` / `publishArticle` / `deleteArticle` | `FORBIDDEN` naming `content:update` / `content:publish` / `content:delete` |
| 3 | `T_FULL`: `mutation { createArticle(input: {title:"Draft"}) { id status } }` | A new entry with `status: DRAFT` — a create never publishes |
| 4 | `mutation { updateArticle(id: "…", input: {subtitle: null}) { subtitle } }` | `subtitle` is cleared |
| 5 | `mutation { updateArticle(id: "…", input: {title:"New"}) { subtitle } }` | `subtitle` is **unchanged** — omission is not an overwrite |
| 6 | `mutation { publishArticle(id: "…") { status publishedAt } }` | `PUBLISHED` with a timestamp |
| 7 | Publish an entry missing a required field | HTTP 200, `extensions.status` = 422, `extensions.code` = `VALIDATION_FAILED`, `extensions.issues` = the per-field list, verbatim |
| 8 | `mutation { deleteArticle(id: "…") }` | `data.deleteArticle` = `true` |
| 9 | `mutation { createArticle(input:{…}, relations:{ tags:{ link:["t1","t2"] } }) { tags { total } } }` | The delta is applied through the shared write path |
| 10 | Send a relation delta with more ids than `MAX_DELTA_IDS` | `BAD_REQUEST` from `validateSync` in the resolver, matching the REST 400 |
| 11 | `mutation { updateArticle(localeGroupId:"G", locale:"de", input:{title:"Hallo"}) { locale } }` | The **German** row is updated; the English one is untouched |
| 12 | `mutation { updateArticle(id:"<en id>", locale:"de", input:{title:"x"}) { locale } }` | The `locale` is **dropped** (an id names one row outright), so the English row is updated |
| 13 | Inspect the SDL for `ArticleInput` | No field carries `= …` — a default would materialise the key and turn omission into an overwrite |

### F43 – F50 — Cost limits

**Preconditions:** `T_READ`; the e2e harness tightens them
(`apps/server-e2e/src/server/api-tokens/public-graphql-limits.spec.ts:36-41`:
depth 3, complexity 50, fields 8, length 200). Against a dev server the
defaults are 8 / 1000 / 30 / 16384.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | A document longer than `maxQueryLength` | `GRAPHQL_LIMIT_EXCEEDED`, "Query document is N characters; the limit is M." Refused **before parsing** |
| 2 | `{ articles { items { tags { items { label } } } } }` past `maxDepth` | `GRAPHQL_LIMIT_EXCEEDED`, "Query is N levels deep…" |
| 3 | `{ a: articles{total} b: articles{total} … }` past `maxAliases` | "Query selects N fields; the limit is M." Note it counts **every** field, aliased or not |
| 4 | `{ articles(pageSize: 100) { items { tags(pageSize: 100) { items { id } } } } }` | Complexity ≈ 100 × 100 = 10 000 → refused at the default 1000 |
| 5 | The same shape with `pageSize: 5` | Accepted |
| 6 | Two unnamed operations in one document | "This endpoint runs one operation per request…" |
| 7 | Two operations plus `operationName` | The named one runs |
| 8 | A refused query against a table you can watch | **No SQL is issued** — the budget runs before execution |
| 9 | A **cyclic** fragment spread | Reported by validation; the cost checker does not hang (`limits.ts:222-258`) |
| 10 | `query Q($n: Int = 500) { articles(pageSize: $n) { items { tags(pageSize: $n) { items { id } } } } }` with **no** variables sent | Expected: refused on complexity. **Suspected: accepted**, and executed at 500 × 500 — see `🐞 BUG-content-graphql-03` |
| 11 | A ~800-byte non-cyclic fragment bomb (see EC-14) | Expected: refused. **Suspected: the process hangs** — see `🐞 BUG-content-graphql-01` |

### F59 / F60 — The GraphiQL playground

**Preconditions:** two runs of the host — one with `API_DOCS=true`, one without.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `API_DOCS=true`, `GET /api/v1/graphql/playground` in a browser, **no token** | 200, `text/html`, the GraphiQL editor loads |
| 2 | View source | Everything inlined — **no external `<script src>`/`<link href>`**, so an air-gapped install works |
| 3 | Read the default query | It tells the reader to add `Authorization` and (for a multi-workspace token) `X-Workspace-Id` |
| 4 | Run a query from the editor with a pasted token | It posts to `/api/v1/graphql` — the endpoint is derived by dropping `/playground` from the request path |
| 5 | Reload | Byte-identical page (memoised) |
| 6 | Restart with `API_DOCS` unset, `GET …/playground` | **404** — the controller is not registered at all, not a 403 from a live handler |
| 7 | Same run, `POST /api/v1/graphql` | Still works — turning the playground off does not take the API down |
| 8 | `GET /API/v1/GRAPHQL/playground` (mixed case) and `…/playground/` | Expected: the same memoised page. **Suspected: each distinct spelling re-renders and stores another ~9 MB** — see `🐞 BUG-content-graphql-05` |

### F55 / F56 / F58 — Schema safety at boot

**Preconditions:** the ability to edit the content registry in
`apps/server`/`packages/content/server` fixtures.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Register two content types `blog_post` and `blogPost` | The host **fails to boot** with `Content types "blog_post" and "blogPost" cannot both be served over GraphQL — both map to the GraphQL type "BlogPost". Rename one of them.` |
| 2 | Register `article` and `articles` (plural/singular collision) | Boot fails naming the colliding query fields |
| 3 | Give `article` a field named `status` | Expected by symmetry: boot fails. **Actual: the boot succeeds** and the first GraphQL request from a workspace granted `article` throws — see `🐞 BUG-content-graphql-06` |
| 4 | Add a content type, restart, diff the SDL against the previous one | Only the new type appears — types are sorted, so a reshuffle never shows as a change |

### F63 — Rate limiting

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Fire 1000 `POST /api/v1/graphql` in a loop with one token | **All succeed** — there is no throttle on the public API over either protocol (only login is rate-limited). Documented, not a regression; see EC-30 |

## 4. Edge Cases & Negative Paths

**Empty / zero**

- **EC-01 — A workspace with zero content grants.** `❌ NONE` The schema has
  `Query.contentTypes` only, `Mutation` is **omitted entirely**
  (`build-schema.ts:140-147`), and `contentTypes` returns `[]`. Verify the SDL is
  still valid — a `GraphQLSchema` with a query type and no mutation is legal.
- **EC-02 — An empty query string.** `❌ NONE` `parse('')` throws → the parse
  branch returns `GRAPHQL_PARSE_FAILED` (`execute-operation.ts:58-68`).
- **EC-03 — A document with only fragment definitions.** `❌ NONE`
  `operations[0]` is `undefined` → "The document defines no operation."
- **EC-04 — `variables: {}` vs absent.** `❌ NONE` `operation.variables ?? {}`
  (`execute-operation.ts:70`) makes them identical.
- **EC-05 — A list selecting only `total`.** `🧪 UNIT`
  `selection.spec.ts:145` — `fields` is left unset, since the projection cannot
  express "no value columns".
- **EC-06 — A relation with no links.** `❌ NONE` `{ items: [], total: 0 }`.
- **EC-07 — A media field with no assets.** `❌ NONE` `[]`, not `null` — the
  field is `[MediaAsset!]!`.

**Boundary**

- **EC-08 — `pageSize: 0` / `-1`.** `❌ NONE` GraphQL `Int` accepts both;
  `listDtoFrom` copies them through unvalidated (`selection.ts:238`), and
  `PublicEntriesQuery.list` feeds them straight to `.limit()`
  (`packages/content/server/src/lib/public-api/infrastructure/public-entries.query.ts:121,161`).
  Postgres rejects a negative LIMIT, so the resolver throws a non-`HttpException`
  → an opaque `INTERNAL_SERVER_ERROR`. REST returns a clean 400 for the same
  input (`@Min(1)`). See `🐞 BUG-content-graphql-02`.
- **EC-09 — `page: 0`.** `❌ NONE` `offset((0-1) * pageSize)` → a negative OFFSET
  → the same 500. REST's `@Min(1)` catches it.
- **EC-10 — `pageSize: MAX_PAGE_SIZE + 1`.** `❌ NONE` Accepted by the resolver;
  the only thing standing in the way is `maxComplexity`, and only when the size
  is a literal (EC-13).
- **EC-11 — `page` = 1e15.** `❌ NONE` A gigantic OFFSET — a full scan the
  complexity budget does not model (it counts `pageSize`, not `page`).
- **EC-12 — Exactly at each limit.** `❌ NONE` Every check is `>` not `>=`
  (`limits.ts:177,187,202`), so a document exactly at the limit passes.
- **EC-13 — A `pageSize` supplied as a **variable value**.** `🧪 UNIT`
  `limits.spec.ts:86` — read correctly from `variables`.
- **EC-14 — A non-cyclic fragment bomb.** `❌ NONE`
  `{ ...F0 }` with `F0 … F8` each spreading the next **ten** times. 811 bytes,
  well inside `maxQueryLength`. Each of `depthOf`, `countFields` and
  `estimateComplexity` recurses 10⁹ times with a fresh `Set` allocation per
  spread. Measured: a bare 10⁹-call recursion of that shape takes ~4.3 s; the
  real one is far worse. See `🐞 BUG-content-graphql-01`.
- **EC-15 — `EntryLoader` batching more than `MAX_PAGE_SIZE` ids.** `❌ NONE`
  Chunked at `MAX_PAGE_SIZE` rather than truncated (`entry-loader.ts:123-124`) —
  correct, untested.
- **EC-16 — A `relationLimit` derived from several fields.** `🧪 UNIT`
  `selection.spec.ts:130` — the **largest** wins, and each resolver slices back.

**Size & encoding**

- **EC-17 — A 100 KB `search` string passed as a variable.** `❌ NONE` The
  document stays short, so `maxQueryLength` never sees it, and `listDtoFrom`
  never enforces `SEARCH_MAX_LENGTH`. The only ceiling is the host's default
  JSON body limit (~100 KB — `create-server.ts` sets none). REST caps it in the
  DTO. Part of `🐞 BUG-content-graphql-02`.
- **EC-18 — A deeply-nested `filter` object.** `❌ NONE` The `JSON` scalar
  accepts any object; it is `JSON.stringify`'d back to the REST `?filter=`
  string (`selection.ts:246-253`), so the shared parser's node/depth caps apply —
  but `FILTER_MAX_LENGTH` does not.
- **EC-19 — Unicode / emoji / RTL in a `search` or a written value.** `❌ NONE`
  Pass-through to the same services; no GraphQL-specific handling.
- **EC-20 — A `select` option that cannot be a GraphQL enum name (`2024`).**
  `🧪 UNIT` `naming.spec.ts:71` — the whole field falls back to `String` rather
  than serving a value the client cannot round-trip.
- **EC-21 — Two `select` options sanitising to the same enum name.** `🧪 UNIT`
  Same fallback (`naming.ts:106-112`).
- **EC-22 — A content slug with a `-` or `.`.** `🧪 UNIT` `pascalCase` splits on
  any non-alphanumeric run (`naming.ts:91-97`). But see EC-28 for the cache key.

**Permission matrix**

| Operation | unauthenticated | `read` scope | `full` scope | not in the bucket |
| --- | --- | --- | --- | --- |
| `POST /v1/graphql` | 401 ✅ | 200 ✅ | 200 ✅ | 403 ✅ |
| `GET /v1/graphql` (SDL) | 401 ❌ | 200 ✅ | 200 ✅ | 403 ❌ |
| `GET …/playground` | 200 (when enabled) ✅ | 200 | 200 | 200 |
| read a published entry | — | ✅ ✅ | ✅ | — |
| `status: DRAFT` | — | FORBIDDEN ✅ | ✅ E2E | — |
| `createX` | — | FORBIDDEN ✅ | ✅ | — |
| `updateX` / `publishX` / `deleteX` | — | FORBIDDEN ✅ | ✅ | — |
| introspection | 401 ❌ | 200 ❌ | 200 ❌ | 403 ❌ |

- **EC-23 — A session cookie instead of a bearer.** `✅ E2E`
  `apps/server-e2e/src/server/api-tokens/public-graphql-api.spec.ts:170`.
- **EC-24 — `content:read` is the endpoint floor, but each mutation asserts its
  own.** `✅ E2E` `public-graphql-api.spec.ts:670` asserts all four write
  refusals for a read-scoped token in one test.
- **EC-25 — A permission no token scope mints.** `✅` Verified: the resolvers
  assert only `content:create|update|publish|delete`, all of which
  `scopePermissions` can yield. Nothing here reaches for `users:read` or
  `activity:read` (the BUGBOT trap for the shared tool registry). Cleared.
- **EC-26 — Field-level authorization.** `❌ NONE` There is **none** beyond the
  grant gate and the draft rule: every field of a granted type is readable by any
  `content:read` token. That is byte-identical to REST, so it is a deliberate
  non-feature rather than a gap — but it means a per-field secret (an internal
  note field) has no home in either protocol.

**Tenant isolation**

- **EC-27 — Can introspection enumerate an ungranted type?** `✅ E2E`
  `public-graphql-api.spec.ts:210` (SDL omits it) and `:221` (naming it is a
  validation error). Verified in code: `buildContentSchema` filters on
  `granted.has(type.name)` (`build-schema.ts:84-86`), and even a relation
  *target* that is ungranted is dropped from both the object type and the write
  input (`:281-288`) so the SDL never mentions it. **Not covered:** the
  `__schema`/`__type` introspection query itself is never run in any spec — the
  assertion is on `printSchema` output, which is the same source but not the same
  code path a client uses.
- **EC-28 — Can a schema built for workspace A be served to workspace B?**
  `✅ E2E` `public-graphql-api.spec.ts:244` proves two workspaces get different
  SDL from one token. Verified in code: the cache key is the **sorted grant set**
  (`schema-cache.ts:32`), and the schema is a pure function of `(registry,
  granted)` — so two workspaces sharing an entry necessarily have identical
  grants and identical schemas. ~~**One theoretical caveat:** the key is
  `[...granted].sort().join(' ')`, so a content slug containing a space would
  make `{"a b"}` and `{"a","b"}` collide on one key.~~ **Withdrawn (ORT-100):**
  the join character is `\u0000`, not a space — this artifact transcribed the
  NUL as a space and drew the collision from the transcription. A NUL cannot
  appear in a slug, so the delimiter is already the one this caveat asked for.
  Verified on the raw bytes.
- **EC-29 — A grant revoked mid-TTL.** `❌ NONE` The SDL still describes the type
  for up to `schemaCacheTtlMs` (60 s), but `resolveType` → `resolveGrantedType`
  re-checks the live set on every resolver call
  (`entry-resolvers.ts:345-355`), so it 404s. The load-bearing claim of the whole
  cache design, and **nothing asserts it**.
- **EC-30 — `EntryLoader` leaking rows across requests.** `✅` Verified: a fresh
  `EntryLoader` is constructed per request in `contextFor`
  (`graphql.controller.ts:177`), and its `pending` map is instance state. The
  `SchemaCache`, by contrast, is deliberately shared — and holds only pure
  schemas, no request data. Cleared.
- **EC-31 — Cross-workspace read via a nested relation.** `❌ NONE` The loader's
  batch is a `PublicEntriesQuery.list` with an `id in […]` filter
  (`entry-loader.ts:125-131`) scoped to `this.workspaceId`, so it inherits
  `readableWhere` unchanged. Verified by reading; never asserted.

**Concurrency & idempotency**

- **EC-32 — Two requests racing the schema cache.** `❌ NONE` Both build a schema
  and the second `set` wins. Harmless (schemas are equal), but it means a burst
  of cold requests each pays a build.
- **EC-33 — Batching correctness under concurrent requests.** `❌ NONE` Batches
  are keyed per `EntryLoader`, i.e. per request, and dispatched on
  `process.nextTick` after a microtask drain (`entry-loader.ts:89-91`). A
  second request never joins the first's batch.
- **EC-34 — Replaying the same mutation.** `❌ NONE` Same semantics as REST —
  `createX` twice creates two entries; `publishX` twice is idempotent;
  `deleteX` twice 404s the second time.
- **EC-35 — A write racing another writer.** `❌ NONE` Handled downstream by the
  per-entry advisory lock in `PublicEntryWritesService`; this package adds
  nothing and must not.

**Failure & partiality**

- **EC-36 — A resolver throwing a non-`HttpException`.** `🧪 UNIT`
  `errors.spec.ts:70` — logged with its stack server-side, replaced with
  "Internal server error." and `status: 500`. **No Postgres text, no stack, no
  SQL reaches the client.**
- **EC-37 — An `HttpException` whose message embeds internals.** `❌ NONE`
  `messageOf` passes an `HttpException`'s message through verbatim
  (`errors.ts:104-118`). That is correct for a `NotFoundException` and dangerous
  for anything that wraps a driver error in an `InternalServerErrorException` —
  the mapper trusts the exception type, not the content. Worth a scan of
  `content-server`'s throw sites.
- **EC-38 — A GraphQL coercion error.** `❌ NONE` Not an `HttpException`, so it
  is a `GraphQLError` returned unchanged (`errors.ts:38-52`) — the message can
  echo the offending input value, which is standard GraphQL behaviour and not a
  leak of server internals.
- **EC-39 — A partial result (one field errors, others succeed).** `❌ NONE`
  GraphQL returns `{ data, errors }` together; `executeOperation` maps the errors
  and keeps `data` (`execute-operation.ts:103-108`). Never asserted.
- **EC-40 — The database down.** `❌ NONE` Every field errors with the opaque 500
  and `data` is `null`. HTTP is still 200.

**Protocol parity (the ADR-0008 premise)**

- **EC-41 — Does any resolver touch the database directly?** `✅` Verified by
  reading all five resolver files: the only data access is
  `context.entries.{list,getOne,relationField}`, `context.writes.{create,update,
  publish,unpublish,remove}` and `context.loader` (which itself calls
  `entries.list`). There is **no Drizzle import, no `@InjectDatabase`, and no SQL
  anywhere in the package** — `grep` for `db.` returns nothing outside the
  imported service types. The ADR's central rule holds.
- **EC-42 — Same fixture, both protocols, field by field.** `✅ E2E`
  `public-graphql-api.spec.ts:376` (same record) and `:418` (same visible set).
- **EC-43 — Can a token reach further over GraphQL than over REST?** `❌ NONE`
  **Yes, on read arguments.** The REST route's `PublicListEntriesQueryDto`
  constraints (`@Min(1)`/`@Max(MAX_PAGE_SIZE)` on `page`/`pageSize`,
  `@MaxLength` on `search`/`filter`/`locale`) are applied by the host's global
  `ValidationPipe`, which a GraphQL argument never meets — and `listDtoFrom`
  builds the DTO as a bare cast with no `validateSync`
  (`selection.ts:234-259`). The package explicitly closes this hole for
  **mutations** (`mutation-resolvers.ts:159-171`) and not for reads. See
  `🐞 BUG-content-graphql-02`.
- **EC-44 — Shape differences that are intentional.** `⚠️ PARTIAL` `{items,total}`
  without `page`/`pageSize`; `PUBLISHED` vs `"published"`; `deleteX → true` vs
  204; errors as HTTP 200 + `extensions.status`. All documented in AGENTS.md;
  `public-graphql-api.spec.ts:888` asserts the last one.

**Behaviour-under-abuse**

- **EC-45 — 1000 aliases of one expensive field.** `✅ E2E`
  `public-graphql-limits.spec.ts:111` — refused by `maxAliases` (a total field
  count, so 1000 aliases is 1000+ fields against a default of 30).
- **EC-46 — Batching abuse via a JSON **array** body (`[{query},{query},…]`).**
  `❌ NONE` The controller takes a single `GraphqlRequestDto`; an array body
  fails `forbidNonWhitelisted` validation with a 400. Verified by reading
  `graphql-request.dto.ts`; never asserted, and it is the classic
  GraphQL-over-HTTP amplification vector.
- **EC-47 — `GET` with a `query` parameter (GraphQL-over-GET).** `❌ NONE` Not
  supported — `GET` only prints the SDL. Worth asserting that it does **not**
  execute an operation, since GET execution would sidestep the POST-only mental
  model (and any future CSRF reasoning).
- **EC-48 — An enormous `variables` payload with a tiny query.** `❌ NONE`
  `maxQueryLength` measures `operation.query.length` only
  (`execute-operation.ts:44`). The only bound is the body parser's default.

### 4A. Accessibility & Section 508 Conformance

**This unit renders no user interface** — it is a JSON-over-HTTP API. WCAG 2.1
A/AA success criteria and 508 Chapter 5 (502.2/502.3 AT interoperability, 503.2
platform preferences, 503.4 captions) are **Not Applicable**, with one
exception noted below. There are no controls, no focus order, no colour, no
announcements, and no keyboard interaction to assess.

The one provision that genuinely bites here is **504 (Authoring Tools)**, and
only in its data-modelling sense: this is the API through which an integrator's
site reads the content a CMS author produced, so whether it can *carry* the
accessibility information the author supplied determines whether a conformant
front end is even buildable.

| Provision | Verdict | Basis |
| --- | --- | --- |
| WCAG 2.1 A/AA (all SC) / 508 E205.4 | **Not Applicable** | No electronic content with a user interface. The one HTML surface, the GraphiQL playground, is a third-party bundle (`@graphql-yoga/render-graphiql`) this package neither authors nor styles — assess it against the vendor, not here |
| 508 502.2 / 502.3 (AT interoperability, status messages) | **Not Applicable** | No UI objects and no platform accessibility API involvement |
| 508 503.2 (platform preferences) / 503.4 (captions, audio control) | **Not Applicable** | No rendering, no media playback |
| **508 504.2 (produce conformant content)** | **Partially Supports** | The API faithfully transports whatever the authoring surface stored. `richtext` values cross as strings holding the semantic HTML `wysiwyg-admin` produces (headings, lists, table header cells), so a consumer receives real structure rather than a flattened blob. Nothing in this package rewrites, sanitises, or downgrades it |
| **508 504.2.1 (preserve accessibility information)** | **Partially Supports** | Alt text embedded in rich-text HTML round-trips through a read and a write untouched. `MediaAsset` does expose it — `alt: { type: GraphQLString, description: 'Alt text, when set.' }` (`schema/shared-types.ts:74`, on the type declared at `:42`) — so a consumer can ask for it. Verified. What it cannot ask for is a **per-usage** alt, a caption, or a language marker; see the finding below |
| **508 504.3 (prompt for accessibility information)** | **Not Applicable here** | Prompting is the authoring UI's job. Filed against `content/admin` as `♿ A11Y-content-admin-11` |
| **508 504.4 (templates)** | **Not Applicable** | Ships no templates |

**♿ A11Y-content-graphql-01 — The content model the API exposes cannot carry
per-usage alt text, a caption, or a language marker**

- **WCAG:** `1.1.1 Non-text Content (A)`, `3.1.2 Language of Parts (AA)` — of the
  *consumer's* published output · **508:** `504.2 / 504.2.1` · **Verdict:**
  **Does Not Support** (schema-level)
- **Location:** the generated `MediaAsset` type
  (`packages/content/graphql/src/lib/schema/shared-types.ts:42-74`) and the entry
  envelope built in `schema/build-schema.ts:220-300`. Alt text lives on the
  **asset** (`MediaRef.alt`, mirrored from
  `packages/content/admin/src/lib/domain/types/contentType/index.ts:144`), not on
  the *usage*; the entry envelope carries `id / createdAt / updatedAt / status /
  publishedAt / locale / localeGroupId / translations`
  (`build-schema.ts:208-217`) and no `lang` for a value, no `caption` for a
  media reference.
- **Repro:** 1) Attach the same image to a `hero` field on two records — a
  full-bleed banner on one and a thumbnail beside a caption on the other.
  2) Query `{ articles { items { hero { id url alt } } } }`.
  → Observed: both records return the **same** `alt` string, because it belongs
  to the asset. Expected: alt is context-dependent, so a consumer needs one per
  usage. Likewise, a `title` value written in German inside an
  English-default record carries no `lang`, so a front end cannot emit
  `lang="de"` and a screen reader reads it in the wrong voice.
- **What a consumer experiences:** a site built on this API can only ever emit
  one alt per asset and no `lang` on any text run — an accessibility ceiling
  imposed by the data model, not by the front end. **The API cannot be more
  accessible than the model it publishes.**
- **Remediation:** this is not fixable in the adapter — it needs a per-usage
  media reference shape (`{ id, alt, caption }`) and an optional `lang` on
  localizable values, in `content/domain` + `content/server`. GraphQL would then
  expose them for free, because the schema is generated from the registry. File
  against those units; cross-referenced from `♿ A11Y-content-admin-11`.

## 5. E2E Coverage Map

Three server-e2e suites (in-process testcontainer + supertest) plus six unit
specs inside the package. `apps/admin-e2e` has nothing for this unit.

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F3 auth | `apps/server-e2e/src/server/api-tokens/public-graphql-api.spec.ts:155,162,170` | 401 with no header, 401 on an unknown bearer, 401 on a session cookie | ✅ E2E |
| F4 workspace bucket | `public-graphql-api.spec.ts:178,188,199` | 403 outside the bucket, 400 when a multi-workspace token names none, 200 for a single-workspace token | ✅ E2E |
| F6 permission floor | — | The class-level `@RequirePermissions(CONTENT_READ)` is never exercised negatively (every scope mints `content:read`) | ⚠️ PARTIAL |
| F2 SDL route | `public-graphql-api.spec.ts:210,244` | The SDL omits an ungranted type; two workspaces get different SDL | ⚠️ PARTIAL — **no test asserts the GET 401s without a token**; verified only by reading the class decorators |
| F7/F8 grant pruning | `public-graphql-api.spec.ts:221` | Naming an ungranted type is `Cannot query field`, i.e. a validation error before any resolver | ✅ E2E |
| F9 per-workspace schema | `public-graphql-api.spec.ts:244` | `type TestTag` present for one workspace, absent for the other, **same token** | ✅ E2E — the sharpest test in the suite |
| F10 schema cache | `packages/content/graphql/src/lib/schema/__test__/schema-cache.spec.ts:9,15,25,33,43,53` | reuse per grant set, keys on the set not identity, distinct sets build distinct schemas, TTL expiry and non-expiry, `clear()` | 🧪 UNIT |
| F11 live grant re-check | — | — | ❌ NONE — the claim that a revoked-mid-TTL grant is still described but not readable is untested. The load-bearing safety property of the cache |
| F12 ungranted relation target | `schema/__test__/build-schema.spec.ts:27,35` | Omitted from the object type **and** from the write input | 🧪 UNIT |
| F13 contentTypes | `public-graphql-api.spec.ts:231` | Exactly the granted names | ✅ E2E |
| F14/F15 reads | `public-graphql-api.spec.ts:269,285,297,306,335,356` | published values; a draft hidden from a read token; another workspace's rows hidden; read-one by id; the REST filter tree; search + sort + paginate | ✅ E2E |
| F16 single-kind | `public-graphql-api.spec.ts:322` | Served as one record, not a list | ✅ E2E |
| F17 locator exclusivity | — | — | ❌ NONE |
| F19 owning single relation | `public-graphql-api.spec.ts:481` | The target itself, not `{items}` | ✅ E2E |
| F20/F28 relation paging | `public-graphql-api.spec.ts:441,504` | A many-to-many expands; a page size is respected **and `total` still reports the true count** | ✅ E2E |
| F23 relation `page > 1` | — | — | ❌ NONE — the one path that is deliberately an N+1 |
| F25 translations | `public-graphql-api.spec.ts:534,581` | Siblings attached; read by translation group in a chosen locale | ✅ E2E |
| F26–F29 selection derivation | `resolvers/__test__/selection.spec.ts:39,46,55,66,74,82,90,98,109,130,145,154,178,192` | value fields, envelope/`__typename` ignored, named + inline fragments, relation/media sizes, the clamp, `applySelection`, the max-page-size rule, DTO mapping, filter re-serialisation | 🧪 UNIT — thorough |
| F30/F31/F32 EntryLoader | — | — | ❌ NONE — **no spec at any level covers the loader.** No unit test, and no e2e counts queries. Its batching, its per-request isolation, and its reuse of `readableWhere` are all unverified |
| F33 draft rule | `public-graphql-api.spec.ts:624,641` | `status: DRAFT` refused for a read token, allowed for a write-scoped one | ✅ E2E |
| F34–F39 mutations | `public-graphql-api.spec.ts:670,687,741,772,802` | all four writes refused for a read token; the create→update→publish→delete lifecycle; explicit `null` clears but omission does not; a failed publish is a 422 with per-field issues; a relation delta applies | ✅ E2E — thorough |
| F36 no input defaults | `schema/__test__/build-schema.spec.ts:149` | No generated input field carries a default | 🧪 UNIT |
| F40 DTO validation in the resolver | — | The `validateSync` path is only reached implicitly | ⚠️ PARTIAL — no test sends a body that violates `MAX_DELTA_FIELDS`/`MAX_DELTA_IDS` over GraphQL |
| F41 addressing locale | — | — | ❌ NONE |
| F43–F47 limits | `public-graphql-limits.spec.ts:88,99,111,123,135` + `public-graphql-api.spec.ts:848` | depth, length, field count, complexity, refused-before-execution, multi-operation | ✅ E2E |
| F44–F48 limits (unit) | `execution/__test__/limits.spec.ts:17,24,35,49,64,76,86,98,108,119,125,131,137` | ordinary query passes; depth through a fragment; **a cyclic fragment does not hang**; alias count; shallow-but-enormous; a variable page size; `items` not double-counted; operation selection | 🧪 UNIT |
| F49 fragment safety | `limits.spec.ts:49` | Guards the **cyclic** case only — the non-cyclic amplification of EC-14 is untested and unhandled | ⚠️ PARTIAL |
| F51–F53 error mapping | `execution/__test__/errors.spec.ts:17,30,39,59,70,81,94` | 404→NOT_FOUND, 403→FORBIDDEN, 422 issues preserved, array messages joined, **unexpected errors masked and logged**, unwrapping, plain `GraphQLError` untouched | 🧪 UNIT — thorough |
| F51 error over the wire | `public-graphql-api.spec.ts:888` | HTTP 200 with the REST status in `extensions` | ✅ E2E |
| F54 introspection | — | — | ❌ NONE — no spec runs `{ __schema { … } }`. The pruning claim rests on `printSchema`, not on the introspection path a real client uses |
| F55 name collisions | `schema/__test__/naming.spec.ts:86,92,100,104,110` | object-type collision, plural/singular collision, whole-registry failure | 🧪 UNIT |
| F56 envelope collision | `build-schema.spec.ts:168,185` | A colliding content field and a shadowed shared type both throw | 🧪 UNIT — but only at **build** time, not boot; see `🐞 BUG-content-graphql-06` |
| F57 enum fallback | `naming.spec.ts:61,65,71,77` | legal names, sanitised names, illegal options | 🧪 UNIT |
| F58 stable SDL | `build-schema.spec.ts:199` | Sorted types | 🧪 UNIT |
| F59/F60 playground | `public-graphql-playground.spec.ts:37,47,57,69` + `public-graphql-api.spec.ts:869,877` | HTML without a token; the endpoint under the global prefix; **no external assets**; byte-identical on reload; 404 when tooling is off; the API survives | ✅ E2E |
| F61 request DTO | `public-graphql-api.spec.ts:899` | A non-GraphQL body 400s | ✅ E2E |
| F62 host-tunable limits | `public-graphql-limits.spec.ts:36-41` | The harness overrides all four, proving the config path | ⚠️ PARTIAL — the schema-cache TTL is never overridden in an e2e |
| F63 rate limiting | — | — | ❌ NONE — absent by design, so nothing to assert; worth a regression test once added |

**Coverage tally:** `63 features · 27 ✅ · 11 ⚠️ · 16 ❌ · 19 🧪 UNIT`
(a feature counted 🧪 has package-level unit coverage and no e2e; ✅/⚠️/❌ are the
e2e verdicts, so the columns overlap by design.)

## 6. 🐞 Potential Bugs

### 🐞 BUG-content-graphql-01 — An ~800-byte fragment bomb wedges the server, because the cost checker itself is exponential · Severity: Critical · 🔒 SECURITY

**Location:** `packages/content/graphql/src/lib/execution/limits.ts:113-149`
(`depthOf`), `:152-186` (`countFields`), `:200-263` (`estimateComplexity`)
**Category:** perf / denial-of-service

**What the code does:** all three walkers recurse into a fragment spread with a
freshly-allocated `visiting` set and **no memoisation**:

```ts
const name = selection.name.value;
const fragment = fragments.get(name);
if (!fragment || visiting.has(name)) { continue; }
count += countFields(
    fragment.selectionSet, fragments, new Set([...visiting, name])
);
```

`visiting` breaks a **cycle** — which is what `limits.spec.ts:49` pins — but does
nothing about a **non-cyclic** spread graph, where the same fragment is legally
reachable by many distinct paths and is therefore re-walked once per path.

**Why it is wrong:** `checkLimits` runs *before* `validate`
(`execute-operation.ts:71-88`), deliberately, "so an expensive document is
refused as early as possible" (`limits.ts:105-112`). That ordering means
graphql-js's own protections never get a chance — the cost checker is the first
and only thing standing between an authenticated caller and the event loop, and
it is itself the expensive operation. The module's own header states the goal:
"a refused document costs a parse and nothing else."

**Repro:**
1. Mint any `read`-scoped token over any granted workspace.
2. POST this document (811 bytes, well inside the 16 384-character default):

```graphql
{ ...F0 }
fragment F0 on Query { ...F1 ...F1 ...F1 ...F1 ...F1 ...F1 ...F1 ...F1 ...F1 ...F1 }
fragment F1 on Query { ...F2 ...F2 ...F2 ...F2 ...F2 ...F2 ...F2 ...F2 ...F2 ...F2 }
…                                        (F2 … F8, each spreading the next ten times)
fragment F9 on Query { __typename }
```

→ Observed: `depthOf` alone — the **first** of the three walks, at
`limits.ts:67` — performs **10⁹** recursive calls (fan-out ^ levels; there is no
memo, so the shared fragments do not collapse), each one allocating a
`new Set([...visiting, name])`. `checkLimits` never returns, so the depth error
it is computing is never reported.
**Measured**, by running `depthOf`'s exact body over a hand-built AST of this
shape (this repo has no `node_modules`, so the walker was transcribed rather
than imported; the recursion and the per-call `Set` copy are identical):

| levels × fan-out | document bytes | calls | wall time |
| --- | --- | --- | --- |
| 4 × 10 | 386 | 10⁴ | 14 ms |
| 5 × 10 | 471 | 10⁵ | 21 ms |
| 6 × 10 | 556 | 10⁶ | 232 ms |
| 7 × 10 | 641 | 10⁷ | 2 244 ms |

Growth is linear in the call count past 10⁶, so the 811-byte 9 × 10 document
above is ~10⁹ calls ≈ **3–4 minutes** of blocked event loop, and 10 × 10 (896
bytes) is ~35 minutes. Node is single-threaded, so the whole API — every tenant,
every route, the admin session endpoints included — is frozen for the duration.
Expected: the document is refused in microseconds, or the walk is linear in the
document.
→ **Scaling:** the budget is 16 384 characters. At ~85 bytes per fragment
definition that affords roughly 190 fragments; a 20-level × 10-fan document fits
easily and is 10²⁰ calls, i.e. an effectively permanent hang from a single
request. No repetition is needed.

**Blast radius:** any holder of the weakest token the system mints (`read` scope,
one workspace) can halt the entire server process, taking down the admin API,
every other tenant's public API, and the MCP endpoint with it. There is **no rate
limit** on this endpoint (`AGENTS.md`, "Rate limiting is absent"), so the request
can be repeated freely. This is the single highest-severity finding across both
units in this pass.

**Suggested fix:** memoise per fragment name — a fragment's depth/field-count is
a property of the fragment, not of the path that reached it, so one
`Map<string, number>` computed over the fragment dependency graph makes all
three walks linear in the document. (Complexity needs care because it carries a
multiplier, but the *count* of nodes under a fragment is still cacheable.) A
cheap belt-and-braces addition: cap the number of fragment definitions and the
total spread count before walking anything.

### 🐞 BUG-content-graphql-02 — Read arguments bypass the DTO validation the REST route enforces, so a token reaches further over GraphQL than over REST · Severity: High · 🔒 SECURITY

**Location:** `packages/content/graphql/src/lib/resolvers/selection.ts:237-260`
(`listDtoFrom`), `:263-274` (`entryDtoFrom`), and
`packages/content/graphql/src/lib/resolvers/entry-resolvers.ts:163-206`
(`loadRelationView`)
**Category:** permission-bypass (resource limits) / perf

**What the code does:** the read DTO is assembled as a bare cast with no
validation:

```ts
const dto = {} as PublicListEntriesQueryDto;
if (typeof args['page'] === 'number') dto.page = args['page'];
if (typeof args['pageSize'] === 'number') dto.pageSize = args['pageSize'];
if (typeof args['search'] === 'string') dto.search = args['search'];
…
```

The class it is cast to carries the constraints the public API relies on —
`@Min(1)` on `page`, `@Min(1) @Max(MAX_PAGE_SIZE)` on `pageSize`, `@MaxLength`
on `search`, `filter` and `locale`
(`packages/content/server/src/lib/public-api/http/dto/public-list-entries-query.dto.ts:228-274`
— `@MaxLength(SEARCH_MAX_LENGTH)` on `search` at `:228`, `@MaxLength(FILTER_MAX_LENGTH)`
at `:246`, `@Min(1)` on `page` at `:258`, `@Min(1) @Max(MAX_PAGE_SIZE)` on
`pageSize` at `:272-273`) — and **none of them run**, because the host's global `ValidationPipe` only sees
an HTTP body, never a GraphQL argument. Downstream, `PublicEntriesQuery.list`
does no clamping of its own:

```ts
const page = query.page ?? 1;
const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
…
.limit(pageSize).offset((page - 1) * pageSize)
```

(`packages/content/server/src/lib/public-api/infrastructure/public-entries.query.ts:120-121,161-162`).

The same gap exists on the nested path: `loadRelationView` reads
`numberArg(args['pageSize'])` (`entry-resolvers.ts:171`) and passes it straight
through as the loader's `limit` (`:184`) and as `relationField`'s page size
(`:201`), where `applySelection`'s `clampPageSize` (`selection.ts:324-329`, which
does clamp to `[1, MAX_PAGE_SIZE]`) never reaches. `PublicEntriesQuery.relationField`
(`packages/content/server/src/lib/public-api/infrastructure/public-entries.query.ts:609-649`)
takes `pageSize` as a plain parameter and clamps nothing either.

**Why it is wrong:** the package **already recognises this exact problem for
writes** and fixes it — `mutation-resolvers.ts:159-171` runs `validateSync` on
the assembled `PublicSaveEntryDto`, with the comment "The REST body gets that
from the host's global `ValidationPipe`; a GraphQL argument never passes through
it, so skipping this would quietly drop the delta caps." `AGENTS.md` states the
same rule under **Writes** and says nothing about reads. ADR-0008's premise is
that "a change to what a token may see lands in `content-server` and both
protocols follow" — here a bound expressed in `content-server` does *not*
follow.

**Repro:**
1. `read`-scoped token, any granted workspace.
2. `POST { "query": "query($n: Int){ articles(pageSize: $n) { items { id } } }", "variables": { "n": -1 } }`
   → Observed: `pageSize` reaches `.limit(-1)`; Postgres rejects it, the resolver
   throws a non-`HttpException`, and the caller gets an opaque
   `INTERNAL_SERVER_ERROR`. The equivalent REST call
   `GET /v1/content/article?pageSize=-1` returns a clean **400**.
3. `{"query":"{ articles(page: 0) { items { id } } }"}` → a negative OFFSET, same 500.
4. `POST { "query": "query($s: String){ articles(search: $s) { total } }", "variables": { "s": "<90 KB of text>" } }`
   → Observed: accepted and executed. `maxQueryLength` measures only
   `operation.query.length` (`execute-operation.ts:44`), so a variable-borne
   string is bounded solely by the body parser's default (~100 KB —
   `packages/bootstrap/server/src/lib/create-server.ts` sets no limit). REST caps
   it at `SEARCH_MAX_LENGTH`.
5. `{"query":"{ article(id:\"A\") { tags(pageSize: 100000) { items { id } } } }"}`
   → Observed: `relationLimit` = 100000 reaches the expansion unclamped.

**Blast radius:** every read-scoped token. Three distinct harms: (a) trivially
reachable 500s on inputs REST rejects cleanly, which is an availability and
error-quality regression; (b) unbounded `LIMIT` / `relationLimit` and unbounded
`search` on a public, un-throttled endpoint; (c) the protocols disagree about
what a token may ask for, which is exactly what ADR-0008 exists to prevent.
Note the complexity budget catches a **literal** oversized `pageSize` — but not a
variable-supplied or default-valued one (see `🐞 BUG-content-graphql-03`), and
never catches `page`, `search` or `filter` length at all.

**Suggested fix:** run `validateSync` on the assembled read DTOs, exactly as
`assertValid` already does for writes, and route the nested relation page size
through the existing `clampPageSize`.

### 🐞 BUG-content-graphql-03 — A variable's *default value* defeats the complexity budget · Severity: High · 🔒 SECURITY

**Location:** `packages/content/graphql/src/lib/execution/limits.ts:281-308`
(`pageSizeOf`), called from `estimateComplexity` (`:227`)
**Category:** permission-bypass (resource limits) / perf

**What the code does:** the estimator resolves a `pageSize` argument written as a
variable by looking it up in the **supplied** variables map:

```ts
if (node.kind === Kind.VARIABLE && node.name) {
    const supplied = variables[node.name.value];
    if (typeof supplied === 'number' && Number.isFinite(supplied)) {
        return Math.max(supplied, 1);
    }
}
return ASSUMED_PAGE_SIZE;   // 20
```

It never inspects the operation's `VariableDefinitionNode.defaultValue`. When the
caller declares `query Q($n: Int = 500)` and sends **no** `variables`, the
estimator falls back to 20 while graphql-js applies 500 at execution.

**Why it is wrong:** `maxComplexity` is described as "the one limit that catches a
shallow-but-enormous query, which a depth cap alone lets straight through"
(`types/config.ts:22-28`), and the estimator is documented as deliberately
**pessimistic** — "it assumes every list comes back full … the point is to refuse
the shapes that *can* be enormous" (`limits.ts:188-199`). A default value makes it
*optimistic* instead, which inverts the stated bias. The unit suite tests the
supplied-variable case (`limits.spec.ts:86`) and not the default case, which is
how the gap survived.

**Repro:**
1. `read`-scoped token.
2. POST, with **no `variables` key at all**:

```json
{"query":"query Q($n: Int = 500){ articles(pageSize: $n) { items { tags(pageSize: $n) { items { id } } } } }"}
```

→ Observed: `estimateComplexity` computes 20 (articles) + 20 × 20 (tags) = 420,
under the 1000 default, so the document is admitted. graphql-js then coerces
`$n` to its default 500 and the resolvers run at 500 outer rows × 500 links —
a budget overrun of roughly 600× (250 000 estimated records against a 1000
ceiling). Combined with `🐞 BUG-content-graphql-02` the `pageSize` is also never
clamped to `MAX_PAGE_SIZE`, so the outer `LIMIT` really is 500.
Expected: the estimator reads the default and refuses the document.
3. A related, milder variant: give a content type a **relation field named
   `items`**. `CONTAINER_FIELDS` matches on the field *name*
   (`limits.ts:214,278`), so that field is treated as the parent's page envelope
   and its own `pageSize` is never multiplied — a second way to slip a nested
   list past the budget. Field names are author-chosen and `items` is not in
   `ENVELOPE_FIELDS` (`build-schema.ts:208-217`), so nothing prevents it.

**Blast radius:** any read-scoped token, on an un-throttled public endpoint. Not
a data leak — the results are still `readableWhere`-filtered — but the cost
budget is the *only* structural bound GraphQL has, and it is one line of syntax
away from being optional.

**Suggested fix:** resolve a variable's value as
`variables[name] ?? defaultValueOf(operation, name)`, reading the default off
the operation's `variableDefinitions`; and key `CONTAINER_FIELDS` on the parent
type being a generated `…List`/`…Links` envelope rather than on the literal
field name.

### 🐞 BUG-content-graphql-04 — `maxAliases` counts every field, so the default of 30 refuses ordinary documents while its name and docs promise otherwise · Severity: Medium

**Location:** `packages/content/graphql/src/lib/execution/limits.ts:77-85`
and `countFields` (`:152-186`); default at `types/config.ts:69`; env var
`GRAPHQL_MAX_FIELDS` at `apps/server/ortha.config.ts:181`
**Category:** correctness / ux

**What the code does:**

```ts
const fields = countFields(operation.selectionSet, fragments, new Set());
if (fields > limits.maxAliases) {
    errors.push(new GraphQLError(
        `Query selects ${fields} fields; the limit is ${limits.maxAliases}.`, …));
}
```

`countFields` counts **every** field selection at every level, aliased or not,
including envelope fields, `__typename`, and every field inside every fragment
spread (once per spread site).

**Why it is wrong:** the name says aliases, the config JSDoc says "Field
selections allowed per operation" (`types/config.ts:29-34`) — two different
contracts in the same package — and the AGENTS.md limits table says it catches
"aliasing one expensive field N times" (`AGENTS.md`, Cost limits). The **host's
env var is named `GRAPHQL_MAX_FIELDS`**, which is the accurate one, so the
codebase already disagrees with itself in three places. The practical
consequence is the default: 30 total field selections is a plausible alias cap
and a tight document cap. A realistic Relay-style query — a list of articles
selecting a dozen scalars, an author, its fields, a tag list and its fields —
crosses 30 easily, and a client using a shared `...ArticleFields` fragment at two
call sites pays for it twice.

**Repro:**
1. Against the default limits, POST:

```graphql
{ articles(pageSize: 10) {
    total
    items { id title subtitle slug excerpt body createdAt updatedAt status publishedAt
            author { id name email bio }
            tags(pageSize: 5) { total items { id label slug } } } } }
```

→ Count: `articles`(1) + `total`(1) + `items`(1) + 10 scalars + `author`(1) + 4 +
`tags`(1) + `total`(1) + `items`(1) + 3 = **34** → refused with "Query selects 34
fields; the limit is 30." Observed for a single-page read that costs one SQL
query plus one expansion.
2. The same fields split across two requests both pass, so the limit does not
   bound cost — it bounds convenience.

**Blast radius:** integrators, not security. It makes the documented "GraphQL
lets you ask for exactly what you need" story fail for real client documents,
and the error message names a limit whose config key is called `maxAliases`
while the env var is `GRAPHQL_MAX_FIELDS`, so an operator raising it has to
guess. `public-graphql-limits.spec.ts:111` is titled "aliases past the field
limit", pinning the ambiguity rather than resolving it.

**Suggested fix:** either rename the key to `maxFields` everywhere (config,
AGENTS.md table, error message) and raise the default to something a real
document fits inside, or split it into a genuine alias count plus a separate,
larger field count.

### 🐞 BUG-content-graphql-05 — The playground's memo cache is keyed on the raw request URL, so ~9 MB is re-rendered and retained per URL spelling · Severity: Medium · 🔒 SECURITY

**Location:** `packages/content/graphql/src/lib/http/controllers/graphql-playground.controller.ts:41,49-61,73-78`
**Category:** perf / denial-of-service (unauthenticated)

**What the code does:**

```ts
private readonly rendered = new Map<string, string>();
…
const endpoint = endpointFor(request);
let html = this.rendered.get(endpoint);
if (!html) { html = renderGraphiQL({ endpoint, … }); this.rendered.set(endpoint, html); }
```

with

```ts
function endpointFor(request: Request): string {
    const url = (request.originalUrl || request.url || '').split('?')[0];
    return url.endsWith('/playground') ? url.slice(0, -'/playground'.length) : '/api/v1/graphql';
}
```

The key is the caller's **raw URL path**, and the map is unbounded and never
evicted — that much is plain in the cited lines and is the load-bearing half of
this finding. The amplification then rests on Express's router defaults, which
the host does not override (`packages/bootstrap/server/src/lib/create-server.ts`
is 44 lines and passes no `caseSensitive` / `strict` option to
`NestFactory.create`). *Unverified —* those defaults (`caseSensitive: false`,
`strict: false`) are Express's documented behaviour, not something this repo
pins, and `node_modules` is not installed here, so the casing variants below were
not executed. On those defaults,
`/api/v1/graphql/playground`, `/API/v1/graphql/playground`,
`/api/V1/GraphQL/PlayGround` and `/api/v1/graphql/playground/` all match the same
route while producing **different** `originalUrl` values.

**Why it is wrong:** the comment states the intent — memoise "per endpoint URL
(the URL varies only if the host changes its global prefix)" — and that
assumption is false: the URL varies per *request spelling*. Each miss costs a
full `renderGraphiQL` call (documented at ~9 MB of inlined HTML,
`AGENTS.md`: "Self-contained, no CDN … ~9 MB") plus permanent retention. Note
also the trailing-slash spelling breaks `endpointFor`'s `endsWith('/playground')`
check, so the page falls back to the hard-coded `/api/v1/graphql` — wrong under
a non-default global prefix.

**Repro:**
1. Run the host with `API_DOCS=true` (dev, staging, or any deployment that
   enables tooling).
2. `for i in $(seq 1 100); do curl -s -o /dev/null "http://localhost:3000/api/v1/graphql/playground?x=$i"; done`
   → no growth (the query string is stripped — correctly).
3. Now vary the **path**: request `/api/v1/graphql/playground`,
   `/API/v1/graphql/playground`, `/Api/V1/Graphql/Playground`, … Each distinct
   casing is a cache miss.
   → Observed: a fresh ~9 MB render **and** a permanent map entry per spelling.
   `playground` alone has 2¹⁰ casings; the full path has far more. A few hundred
   requests exhaust heap.
   Expected: one render, one entry, regardless of spelling.
4. `GET /api/v1/graphql/playground/` → the page is served, but the editor is
   pointed at `/api/v1/graphql` rather than the derived sibling path.

**Blast radius:** bounded by the playground being **off in production by
default** (`apps/server/src/plugins.ts:73` gates it on `docs.enabled`), which is
why this is Medium rather than High. But where it *is* on — every dev and
staging environment — the route is `@Public()` and completely unauthenticated,
so this is a remote, credential-free OOM of a shared environment.
`public-graphql-playground.spec.ts:69` asserts "a byte-identical page on a second
request", which passes because it repeats the *same* URL.

**Suggested fix:** normalise the key (lower-case, strip a trailing slash) or drop
the map entirely in favour of a single lazily-rendered page plus a derived
`<script>`-level endpoint, and cap the map at a handful of entries.

### 🐞 BUG-content-graphql-06 — A content field colliding with the GraphQL envelope fails at request time, not at boot · Severity: Medium

**Location:** `packages/content/graphql/src/lib/schema/build-schema.ts:274-278`,
versus the boot-time check in
`packages/content/graphql/src/lib/utils/content-graphql-plugin.ts:71`
**Category:** correctness / availability

**What the code does:** `entryFields` throws while **building** a schema:

```ts
for (const [fieldName, spec] of Object.entries(type.fields)) {
    if (ENVELOPE_FIELDS.includes(fieldName)) {
        throw new Error(
            `Content type "${type.name}" defines a field named "${fieldName}", which collides with the GraphQL entry envelope. Rename it.`);
    }
```

Schema building happens lazily, per grant set, inside a request
(`graphql.controller.ts:120` → `SchemaCache.get` → `buildContentSchema`), and
graphql-js runs field thunks lazily on top of that. The plugin's boot-time
assertion checks only **type-name** collisions
(`assertNoNameCollisions`), not field-vs-envelope ones.

**Why it is wrong:** the plugin file states the principle explicitly — the
registry is taken by value "so the **name check below runs at composition
time**: two content types that would collide in a GraphQL schema should fail the
host's boot, not the first request from the one workspace granted both"
(`content-graphql-plugin.ts:16-21`). The envelope check is the same class of
modelling bug and gets the opposite treatment. `ENVELOPE_FIELDS` includes
`id`, `createdAt`, `updatedAt`, `status`, `publishedAt`, `locale`,
`localeGroupId` and `translations` (`build-schema.ts:208-217`) — `status` and
`locale` in particular are plausible author-chosen field names.

**Repro:**
1. Add a field named `status` (or `locale`) to any content type.
2. Boot the server → **succeeds**; every REST route works; the admin works.
3. From a workspace granted that type, POST any GraphQL query.
→ Observed: `buildContentSchema` throws a plain `Error` inside the controller.
It is not an `HttpException`, so it escapes before `toGraphQLError` (which only
maps errors surfacing *from execution*, `execute-operation.ts:100-108`) and Nest
returns a **500** for every GraphQL request from that workspace, indefinitely —
including the `GET` SDL route. Other workspaces are unaffected, which makes it
look like a tenant-specific outage.
Expected: the host refuses to boot, naming the field, exactly as it does for a
type-name collision.
4. Same shape for the reserved shared-type names (`build-schema.spec.ts:185`
   pins the throw, not the boot).

**Blast radius:** a modelling mistake that ships. `apps/server-e2e` never
exercises it (the fixture types are well-behaved), and the unit test
`build-schema.spec.ts:168` asserts only that the build throws — which is exactly
the behaviour that makes it a runtime 500. Note also that `EntryLoader` and every
other consumer of the cached schema share this: the throw happens on every
request, since a failed build is never cached.

**Suggested fix:** move the envelope/reserved-name check into
`assertNoNameCollisions`'s caller at composition time, iterating
`content.registry.all()`'s fields — the registry is already in hand there.

### 🐞 BUG-content-graphql-07 — The error mapper masks by exception *class*, not by status, so any future `HttpException` carrying an internal message would be relayed verbatim · Severity: Low · 🔒 SECURITY

**Latent, not currently reachable.** The mechanism below is confirmed in the
cited lines. The reachability audit has now been run: the only
`InternalServerErrorException` / `ServiceUnavailableException` anywhere under
`packages/content/server/src` is
`public-api/http/decorators/current-api-token.decorator.ts:18`, and it carries a
fixed developer message (`'@CurrentApiToken() used on a route without
ApiTokenGuard.'`), not a caught error's text. **No live leak exists today** —
this is a defence-in-depth gap that the next 5xx throw site would open, which is
why it is Low rather than a security defect.

**Location:** `packages/content/graphql/src/lib/execution/errors.ts:54-63`,
`messageOf` at `:104-118`
**Category:** information disclosure

**What the code does:** the mapper branches on the *type* of the error, not on
its content:

```ts
if (error instanceof HttpException) {
    const status = error.getStatus();
    const response = error.getResponse();
    return new GraphQLError(messageOf(response, error.message), { extensions: { code: codeFor(status), status, … } });
}
logger.error('Unhandled error while executing a GraphQL operation', …);
return new GraphQLError('Internal server error.', { … });
```

Anything that is *not* an `HttpException` is correctly masked — the file's own
doc calls that out: "a Postgres error text or a stack trace is exactly the sort
of thing that turns a token into a reconnaissance tool" (`:26-29`), and
`errors.spec.ts:70` pins it. But an `InternalServerErrorException(err.message)`
or a `BadRequestException` built from a driver message *is* an `HttpException`,
so its text is relayed to the caller unchanged — including through
`codeFor`'s 5xx branch (`:99`), which happily produces
`INTERNAL_SERVER_ERROR` with a populated message.

**Why it is wrong:** the mapper's stated contract is "what a client never sees:
anything that is not a fact about the request". Type is a proxy for that, and
it is a leaky one. On REST the same exception would be relayed too, so this is
not a divergence — but the GraphQL surface is where the package chose to think
about it, and the masking is one condition short of matching its own comment.

**Repro (regression guard, not a live exploit):**
1. Add anywhere on the read path
   `throw new InternalServerErrorException(caughtDriverError.message)`.
2. Trigger it and read `errors[0].message` over GraphQL.
→ Observed: the driver's text, with `code: INTERNAL_SERVER_ERROR` and
`status: 500`. Expected: "Internal server error.", the same masking a bare
`Error` already gets.

**Blast radius:** none today (see above). Conditional on a future throw site that
embeds internals, at which point it is reachable by a low-privilege token from
outside the network — which is why the guard belongs in the mapper rather than in
a code-review convention.

**Suggested fix:** mask the message for any status ≥ 500 regardless of the
exception class, keeping `extensions.status` and `code` intact.

### Checked and cleared

Behaviours I specifically read and found **correct**:

- **The adapter rule (ADR-0008's premise).** No resolver touches the database.
  The only data access in the package is `context.entries.*`, `context.writes.*`
  and `context.loader` (which itself calls `entries.list`). There is no Drizzle
  import, no `@InjectDatabase`, and no SQL anywhere — the read path, the write
  path, `readableWhere`, the grant gate and the locale scope are all
  `content-server`'s, unchanged.
- **The `GET` SDL route is authenticated.** `@UseGuards(ApiTokenGuard,
  ApiTokenWorkspaceGuard)` and `@RequirePermissions(CONTENT_READ)` are declared
  on the **controller class** (`graphql.controller.ts:76-78`), so both `@Post()`
  and `@Get()` inherit them. Only the separate `GraphqlPlaygroundController` is
  `@Public()`, and it renders a static page that reads nothing.
- **Per-workspace schema isolation.** The cache key is the sorted grant set and
  the schema is a pure function of `(registry, granted)`, so a schema can only be
  shared between workspaces whose grants are identical — in which case the
  schemas are identical too. E2E-pinned (`public-graphql-api.spec.ts:244`). The
  only theoretical hole is the space delimiter noted in EC-28.
- **The TTL is not the authorization.** `resolveType` → `resolveGrantedType`
  runs on every read and write resolver against the live grant set
  (`entry-resolvers.ts:280-288`, called at `:34,52,78,178,195,228,255` and
  from all four mutation resolvers), so a stale schema can describe a revoked
  type but never read it.
- **The draft rule is correctly wired.** `assertVisibility` compares against
  `'draft'` / `'any'` (`entry-resolvers.ts:301`), which are exactly the
  **values** `EntryVisibilityEnum` maps its `DRAFT`/`ANY` names to
  (`schema/field-types.ts:86-90`) — the classic case-mismatch bug is not present.
  It is asserted on all three read entry points (single, list, page).
- **Mutations validate their DTO.** `assertValid` runs `validateSync` with
  `whitelist` + `forbidNonWhitelisted` (`mutation-resolvers.ts:159-171`), so the
  delta caps survive the missing `ValidationPipe`. Each mutation asserts its own
  permission through the same `AccessPolicy`/`tokenActor` pair the guard uses.
- **Partial-update semantics.** `saveDtoFrom` copies `input` by key presence
  only, and no generated input field declares a `defaultValue`
  (pinned by `build-schema.spec.ts:149`) — so an omitted field is not an
  overwrite and an explicit `null` clears.
- **`EntryLoader` is per-request.** Constructed fresh in `contextFor`
  (`graphql.controller.ts:177`) with a comment saying exactly why; its `pending`
  map is instance state, so no request can be served another's rows.
- **Unexpected errors are masked.** Non-`HttpException` failures are logged with
  their stack and replaced with a fixed message and a 500
  (`errors.ts:65-74`), unit-pinned.
- **Multi-operation documents.** Refused unless `operationName` names one
  (`limits.ts:40-49`), so one request cannot multiply every other budget.
- **Batched-array request bodies.** `GraphqlRequestDto` is a single object under
  a `forbidNonWhitelisted` pipe, so the GraphQL-over-HTTP array-batching
  amplification vector is closed by construction (EC-46).
- **Introspection is on, deliberately, and safely.** The schema handed to
  `validate`/`execute` is already the pruned one, so `__schema` cannot enumerate
  a type the workspace was not granted. The endpoint is authenticated, so
  introspection is not a public capability.
- **The playground does not weaken the API.** It is a separate controller,
  registered only when the host asks, serving a static page that carries no
  content and reads nothing; `public-graphql-api.spec.ts:877` asserts the API
  keeps working with it off.

**Defect tally:** `7 🐞 · 1 Critical · 2 High · 3 Medium · 1 Low · 5 🔒`
(BUG-01 Critical and BUG-02 High both re-confirmed against the source on
verification; BUG-07 re-framed as latent-not-reachable, staying Low.)

**Accessibility tally:** `1 ♿ · 0 Supports · 0 Partially Supports · 1 Does Not
Support · 0 Not Applicable` (schema-level). The §4A provision table additionally
records 2 **Partially Supports** and 4 **Not Applicable** provisions that produced
no finding — this unit renders no UI.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | package unit (`execution/__test__/limits.spec.ts`) | Add a **non-cyclic fragment amplification** case: 9 levels × 10 spreads, asserted to complete under a hard timeout (e.g. 50 ms) and to report a limit error | The cost checker is linear in the document, not exponential in the spread graph | `🐞 BUG-content-graphql-01` |
| 2 | `apps/server-e2e` testcontainer + supertest | `public-graphql-limits.spec.ts`: post the same fragment bomb and assert a response within a timeout — the end-to-end proof that the event loop survives | The same, through the real controller | `🐞 BUG-content-graphql-01` |
| 3 | `apps/server-e2e` | `public-graphql-api.spec.ts` → a new `read argument bounds` block: `pageSize: -1`, `pageSize: 0`, `page: 0`, `pageSize: MAX_PAGE_SIZE + 1`, a 90 KB `search` via variables — each asserted to return the **same status and shape as the equivalent REST call** | Read arguments meet the DTO's constraints; no opaque 500s | `🐞 BUG-content-graphql-02`, EC-08 to EC-11, EC-17 |
| 4 | package unit | `limits.spec.ts`: a `pageSize` supplied only as a **variable default** (`query Q($n: Int = 500)`, no variables sent) is costed at 500, not 20; and a relation field literally named `items` still multiplies | The estimator's pessimism holds for every spelling of a page size | `🐞 BUG-content-graphql-03` |
| 5 | `apps/server-e2e` | `public-graphql-api.spec.ts`: revoke a content grant, then within the schema-cache TTL assert the SDL **still lists** the type while a query for it returns a `NOT_FOUND` error | The TTL is a freshness knob and `resolveGrantedType` is the authorization — the load-bearing claim of ADR-0008's decision 1 | F11, EC-29 |
| 6 | `apps/server-e2e` | `public-graphql-api.spec.ts`: `GET /api/v1/graphql` with no `Authorization` → 401; with a token for a workspace outside the bucket → 403; and the same for a standard `{ __schema { types { name } } }` introspection query | The SDL route and introspection carry the same guards as `POST` — currently proven only by reading decorators | F2, F54, EC-27 |
| 7 | package unit (new `resolvers/__test__/entry-loader.spec.ts`) | With a stub `PublicEntriesQuery`: several `load()` calls in one tick coalesce into **one** `list` call; the filter is `{field:'id', op:'in'}`; >`MAX_PAGE_SIZE` ids chunk rather than truncate; two `EntryLoader` instances never share a batch | The loader — currently the largest completely untested surface in the package | F30, F31, F32, EC-15, EC-33 |
| 8 | `apps/server-e2e` | `public-graphql-playground.spec.ts`: request the page under a differently-cased path and with a trailing slash; assert the response is byte-identical and that the editor endpoint is still the derived sibling | One render per deployment, not per URL spelling | `🐞 BUG-content-graphql-05` |
| 9 | package unit or `apps/server-e2e` boot test | Registering a content type with a field named `status` (or a type shadowing a reserved schema name) makes `ContentGraphqlPlugin(...)` **throw at construction** | Modelling bugs fail boot, not the first request | `🐞 BUG-content-graphql-06` |
| 10 | `apps/server-e2e` | `public-graphql-api.spec.ts`: a relation delta exceeding `MAX_DELTA_IDS` over GraphQL returns the same 400 (as `extensions.status`) the REST body does | The `validateSync` seam is actually load-bearing | F40 |
| 11 | `apps/server-e2e` | `public-graphql-api.spec.ts`: `{ article(id: "x", localeGroupId: "y") }` → `BAD_REQUEST`; `{ article }` with neither → `BAD_REQUEST`; `updateArticle(id:, locale:)` updates the row the **id** names, not the locale's | The locator rules that REST expresses structurally as two routes | F17, F41 |
| 12 | `apps/server-e2e` | `public-graphql-api.spec.ts`: a document sent as a JSON **array** of operations → 400; `GET /v1/graphql?query={…}` → the SDL, never an executed operation | The two GraphQL-over-HTTP surface-expansion vectors stay closed | EC-46, EC-47 |
| 13 | `apps/server-e2e` | `public-graphql-api.spec.ts`: a relation read with `page: 2` returns the second page and matches `GET /v1/content/:type/:id/relations/:field?page=2` | The one deliberately-unbatched path, and its REST parity | F23 |
| 14 | `apps/server-e2e` | `public-graphql-api.spec.ts`: a query where one field errors and a sibling succeeds returns **both** `data` and `errors` | Partial results, the shape a REST-porting consumer is least prepared for | EC-39 |
| 15 | package unit (`errors.spec.ts`) | An `InternalServerErrorException('duplicate key value violates …')` is relayed with a **fixed** message, not the driver text | Masking is by status, not by exception class | `🐞 BUG-content-graphql-07` |

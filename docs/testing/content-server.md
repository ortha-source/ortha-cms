# @ortha-cms/content-server — Test Artifact

> **Unit:** `packages/content/server` · **Package:** `@ortha-cms/content-server` · **Kind:** server plugin
> **Source of truth:** `packages/content/server/AGENTS.md`
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns** the content-modelling engine: the `collection()` / `single()` + `field.*`
DSL that turns code-defined content types into physical Postgres tables; the
runtime `ContentTypeRegistry`; the generic entries pipeline (list / read /
create / update / publish / soft-delete / restore / purge / bulk); the generic
`content_entry_revisions` timeline; the **public content API** under
`/api/v1/*` with its API-token guards; the content insights aggregates; and the
copilot + MCP tool providers over its own services.

**Does NOT own:**

- **A database connection or any migrations.** The tables it defines
  (`content_<name>` and `content_entry_revisions`) are **HOST-owned** — the host
  re-exports them into its drizzle-kit schema and ships the SQL. This plugin has
  no `drizzle.config.ts`.
- **Field-value rules or the publish gate** — those live in
  `@ortha-cms/content-domain` and are delegated to
  (`validation/services/entry-validation.service.ts`).
- **What a locale means.** Locale slugs, scoping, sibling sync and fallbacks are
  behind the `CONTENT_ENTRY_EXTENSION` port that `i18n/server` binds; this
  package forwards `?locale=` / `localeGroupId` as opaque strings.
- **Media assets** — behind `MEDIA_ASSET_RESOLVER`, bound by the media plugin.
- **The tenancy boundary** — `WorkspaceGuard` / `CurrentWorkspace` come from
  `@ortha-cms/workspaces-server`.
- **The GraphQL protocol** — `@ortha-cms/content-graphql` adapts this package's
  `public-api/`.

- **Entry points — HTTP routes**

    *Admin API (session cookie + `X-Workspace-Id`), all `@UseGuards(… WorkspaceGuard)` unless noted:*

    | Verb + path | Controller | Permission |
    | --- | --- | --- |
    | `GET /api/content-schema` | `content-types/controllers/list-content-schema.controller.ts:30` | `content:read` · **no** `WorkspaceGuard` |
    | `GET /api/content-schema/:name` | `content-types/controllers/get-content-schema.controller.ts:34` | `content:read` · **no** `WorkspaceGuard` |
    | `GET /api/content-schema/:name/filter-fields` | `content-types/controllers/get-filter-fields.controller.ts:55` | `content:read` · **grant-checked** |
    | `GET /api/content/:typeName` | `entries/http/controllers/list-entries.controller.ts:43` | `content:read` |
    | `GET /api/content/:typeName/:id` | `entries/http/controllers/get-entry.controller.ts:50` | `content:read` |
    | `GET /api/content/:typeName/:id/media` | `get-entry.controller.ts:67` | `content:read` |
    | `GET /api/content/:typeName/:id/relations` | `get-entry.controller.ts:93` | `content:read` |
    | `GET /api/content/:typeName/:id/relations/:field` | `get-entry.controller.ts:113` | `content:read` |
    | `POST /api/content/:typeName` | `create-entry.controller.ts:37` | `content:create` |
    | `PATCH /api/content/:typeName/:id` | `update-entry.controller.ts:42` | `content:update` |
    | `DELETE /api/content/:typeName/:id` | `delete-entry.controller.ts:49` | `content:delete` |
    | `POST /api/content/:typeName/:id/restore` | `delete-entry.controller.ts:60` | `content:delete` |
    | `DELETE /api/content/:typeName/:id/permanent` | `delete-entry.controller.ts:70` | `content:delete` |
    | `POST /api/content/:typeName/:id/publish` | `publish-entry.controller.ts:50` | `content:publish` |
    | `POST /api/content/:typeName/:id/unpublish` | `publish-entry.controller.ts:61` | `content:publish` |
    | `POST /api/content/:typeName/bulk/publish/preview` | `bulk-entries.controller.ts:56` | `content:publish` |
    | `POST /api/content/:typeName/bulk/publish`\|`unpublish` | `bulk-entries.controller.ts:68,80` | `content:publish` |
    | `POST /api/content/:typeName/bulk/delete`\|`restore`\|`purge` | `bulk-entries.controller.ts:92,104,116` | `content:delete` |
    | `GET /api/content/:typeName/:id/revisions` | `revisions/http/controllers/revisions.controller.ts:51` | `content:read` |
    | `GET /api/content/:typeName/:id/revisions/:number` | `revisions.controller.ts:68` | `content:read` |
    | `POST /api/content/:typeName/:id/revisions/:number/restore` | `revisions/http/controllers/restore-revision.controller.ts:40` | `content:update` |
    | `POST /api/content/:typeName/:id/revisions/:number/publish` | `revisions/http/controllers/publish-revision.controller.ts:42` | `content:publish` |
    | `GET /api/insights/content/{totals,pipeline,velocity,stale,unshipped,punchcard}` | `insights/http/controllers/*.controller.ts` | insights permission |

    *Public API (bearer API token + `X-Workspace-Id`), guarded by
    `ApiTokenGuard` → `ApiTokenWorkspaceGuard` (+ `DraftVisibilityGuard` on reads):*

    | Verb + path | Controller |
    | --- | --- |
    | `GET /api/v1/content-types`, `.../:name` | `public-api/http/controllers/public-content-types.controller.ts` |
    | `GET /api/v1/content/:typeName`, `.../:id` | `public-api/http/controllers/public-entries.controller.ts` |
    | `POST`/`PATCH`/`DELETE` `/api/v1/content/:typeName[/:id]`, publish/unpublish | `public-api/http/controllers/public-entry-writes.controller.ts` |

    **DI ports declared here (bound elsewhere):** `CONTENT_ENTRY_EXTENSION`
    (`extension/entry-extension.ts`, bound by `i18n/server`),
    `MEDIA_ASSET_RESOLVER` (`extension/media-asset-resolver.ts`, bound by media).
    **Ports bound here:** workspaces' `CONTENT_CATALOG` and
    `CONTENT_ENTRY_COUNTER` (`entries/infrastructure/persistence/entry-counter.service.ts:20`),
    copilot's tool provider, MCP's tool provider.

- **Runtime prerequisites**
    - Postgres + the host's migrations for every `content_<name>` table and
      `content_entry_revisions` (`npx nx run server:db:migrate`).
    - Content types defined in `apps/server/src/collections` and
      `apps/server/src/pages` and registered — the registry is the source of
      truth for every route's `:typeName`.
    - Plugin order: `DatabasePlugin` → `IdentityPlugin` → `WorkspacesPlugin` →
      `ContentPlugin` → (`I18nServerPlugin` if any type sets `i18n: true`, or
      boot **fails**, `extension/entry-extension-boot-check.ts:36-42`).
    - Admin routes: a session + membership of the `X-Workspace-Id` workspace.
    - Public routes: an API token whose bucket contains the workspace, and a
      **content grant** for the type.

- **How to exercise it manually**

    ```bash
    docker compose up -d && npx nx run server:db:migrate && npm run dev
    curl -c /tmp/c -X POST localhost:3000/api/auth/login -H 'content-type: application/json' \
      -d '{"email":"admin@example.com","password":"SecurePass123!"}'
    WS=<workspace-uuid>
    # list
    curl -b /tmp/c -H "X-Workspace-Id: $WS" 'localhost:3000/api/content/test_article?page=1&pageSize=25'
    # create
    curl -b /tmp/c -H "X-Workspace-Id: $WS" -H 'content-type: application/json' \
      -X POST localhost:3000/api/content/test_article -d '{"values":{"title":"Hello"}}'
    # publish
    curl -b /tmp/c -H "X-Workspace-Id: $WS" -X POST localhost:3000/api/content/test_article/<id>/publish
    # revisions
    curl -b /tmp/c -H "X-Workspace-Id: $WS" localhost:3000/api/content/test_article/<id>/revisions
    # public API
    curl -H "Authorization: Bearer $TOKEN" -H "X-Workspace-Id: $WS" localhost:3000/api/v1/content/test_article
    ```

- **Dependencies that must be healthy:** `@ortha-cms/database` (connection,
  `UnitOfWork`, `OutboxWriter`), `@ortha-cms/identity-server` (guards,
  `PERMISSIONS`, `AccessPolicy`, API-token model), `@ortha-cms/workspaces-server`
  (`WorkspaceGuard`, `CurrentWorkspace`, `workspaceContent` schema,
  `lockWorkspaceShared`), `@ortha-cms/content-domain` (validation, publish gate,
  status machine), `@ortha-cms/utils-server` (`clampInt`, `violatedConstraint`,
  the filter engine), and — optionally — `i18n/server`, `media/server`,
  `copilot/server`, `tools/server`.

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | `collection()` / `single()` define a type + build its table | `src/lib/collection/define.ts`, `table-builder.ts` | 🧪 UNIT |
| F2 | `assertName` / `assertFields` reject reserved and malformed names | `src/lib/collection/define.ts` | 🧪 UNIT |
| F3 | The 12 `field.*` builders emit serialisable specs | `src/lib/fields/index.ts` | 🧪 UNIT |
| F4 | `relation({to})` lazy thunk; `onDelete` defaults by `required` | `src/lib/fields/index.ts`, `define.ts` | 🧪 UNIT |
| F5 | Required single relation + `onDelete:'set null'` rejected at define time | `src/lib/collection/define.ts` | 🧪 UNIT |
| F6 | `unique: true` ⇒ one-to-one; rejected with `many: true` | `define.ts`, `table-builder.ts` | 🧪 UNIT |
| F7 | `relationInverse` emits no storage; pairing validated at boot | `src/lib/registry/content-type-registry.ts` | 🧪 UNIT |
| F8 | `publishable` ⇒ `status` + `published_at` columns | `table-builder.ts` | ✅ E2E |
| F9 | `paranoid` ⇒ `deleted_at` column (soft delete) | `table-builder.ts` | ✅ E2E |
| F10 | `i18n` ⇒ `locale` + `locale_group_id` + the unique/list indexes | `table-builder.ts` | ⚠️ PARTIAL |
| F11 | `GET /api/content-schema` — summary of every type | `content-types/controllers/list-content-schema.controller.ts:30` | ✅ E2E |
| F12 | `GET /api/content-schema/:name` — full field schema | `get-content-schema.controller.ts:34` | ✅ E2E |
| F13 | `GET /api/content-schema/:name/filter-fields` — grant-pruned filter surface | `get-filter-fields.controller.ts:55` | ✅ E2E |
| F14 | Entries list: paginated envelope `{items,total,page,pageSize}` | `entries/infrastructure/queries/entries.service.ts:90` | ✅ E2E |
| F15 | Free-text ILIKE search over text-like columns | `entries/infrastructure/queries/entry-search.ts` | ✅ E2E |
| F16 | `?filter=` structured tree, incl. relation hops | `entries.service.ts:200-223`, `entry-filter-surface.ts` | ✅ E2E |
| F17 | Relation-hop budget; unknown path → 400 | `entry-filter-surface.ts` | ✅ E2E |
| F18 | `?sort=` whitelist with `id` tiebreaker; unknown → `updatedAt` desc | `entries.service.ts:251-273` | ⚠️ PARTIAL |
| F19 | `?deleted=only` trash view on paranoid types | `entries.service.ts:230-242` | ✅ E2E |
| F20 | `?relations=preview` batched relation preview | `entries.service.ts:118-135`, `relation-link.service.ts` | ✅ E2E |
| F21 | Workspace scope is in the `WHERE`, not only the guard | `entries.service.ts:181` | ✅ E2E |
| F22 | `GET /:type/:id` — one entry | `entries/http/controllers/get-entry.controller.ts:50` | ✅ E2E |
| F23 | `GET /:type/:id/relations[/:field]` — paginated link reads | `get-entry.controller.ts:93,113` | ✅ E2E |
| F24 | `GET /:type/:id/media` — media ids → display refs | `get-entry.controller.ts:67`, `media-refs.query.ts` | ✅ E2E |
| F25 | Create an entry, stamped with `workspace_id` | `entry-writer.service.ts:305` | ✅ E2E |
| F26 | Create takes the workspace **shared** advisory lock | `entry-writer.service.ts:372` | ❌ NONE |
| F27 | Create wraps the insert in `uniqueGuarded` ⇒ 409 on duplicate (group, locale) | `entry-writer.service.ts:369` | ⚠️ PARTIAL |
| F28 | Update replaces columns + relinks in **one** transaction | `entry-writer.service.ts:621-698` | ✅ E2E |
| F29 | Editing a published entry returns it to `draft`, keeping `published_at` | `entry-writer.service.ts:635-638` | ✅ E2E |
| F30 | A publishable type's save is not eagerly validated (drafts may be incomplete) | `entry-writer.service.ts:612-615` | ✅ E2E |
| F31 | A non-publishable type validates on every write | `entry-writer.service.ts:614-616` | ✅ E2E |
| F32 | `assertRelationTargets` — existence + workspace + same-locale, uniform 422 | `entry-writer.service.ts:345,598` | ✅ E2E |
| F33 | `assertUniqueRelations` — friendly 422 before the index's 500 | `entry-writer.service.ts:346,599` | ❌ NONE |
| F34 | `assertMediaTargets` — existence + `accept`, uniform 422 | `entry-writer.service.ts:360,606` | ✅ E2E |
| F35 | `assertRequiredRelations` post-delta, inside the transaction | `entry-writer.service.ts:664-670` | ⚠️ PARTIAL |
| F36 | Relation deltas: link / unlink / reorder, merged onto existing links | `relation-link.service.ts` | ✅ E2E |
| F37 | Whole-set many-relation replacement from `values` | `relation-link.service.ts` (`writeLinks`) | ✅ E2E |
| F38 | Publish: gate + `draft→published` transition + `published_at` | `entries/application/use-cases/publish-entry.use-case.ts` | ✅ E2E |
| F39 | Unpublish: `published→draft`, clears `published_at` | `entries/application/use-cases/unpublish-entry.use-case.ts` | ✅ E2E |
| F40 | Publish 400s a non-publishable type | `publish-entry.use-case.ts` | ✅ E2E |
| F41 | Publish 422s `{issues}` when the gate fails | `entries/domain/entry-publish-blocked.error.ts` | ✅ E2E |
| F42 | Soft delete / restore / purge on paranoid types | `entry-writer.service.ts`, `delete-entry.controller.ts` | ✅ E2E |
| F43 | Bulk publish preview reports per-id verdicts | `bulk-publish-preview.query.ts`, `bulk-publish-verdicts.ts` | ✅ E2E |
| F44 | Bulk publish / unpublish / delete / restore / purge, capped at 100 ids | `bulk-entries.controller.ts`, `entries.constants.ts:13` | ⚠️ PARTIAL |
| F45 | A revision is appended on every save, in the same transaction | `entry-writer.service.ts:680-696` | ✅ E2E |
| F46 | Revision numbering under an entry advisory lock + unique backstop | `drizzle-revision.store.ts:38-48`, `revision-table.ts:62-65` | ⚠️ PARTIAL |
| F47 | Revision list, newest first, paginated + clamped | `revisions.controller.ts:51` | ✅ E2E |
| F48 | Revision detail with relation ids resolved to refs | `revisions.controller.ts:68`, `revision-refs.query.ts` | ✅ E2E |
| F49 | Restore is append-only (a restore mints a new revision) | `restore-revision.use-case.ts` | ✅ E2E |
| F50 | Publish a specific earlier version, in place | `publish-revision.use-case.ts` | ✅ E2E |
| F51 | Revision statuses: draft / published / superseded | `revisions/domain/revision-status.ts` | ✅ E2E |
| F52 | `CONTENT_ENTRY_EXTENSION` called unconditionally, `@Optional()` | `entries.service.ts:77-81`, `entry-writer.service.ts:107-109` | ⚠️ PARTIAL |
| F53 | Boot fails when an `i18n` type has no extension bound | `entry-extension-boot-check.ts:30-43` | ❌ NONE |
| F54 | `CONTENT_ENTRY_COUNTER` — per-type and whole-workspace counts | `entry-counter.service.ts:32,43` | ✅ E2E |
| F55 | `CONTENT_CATALOG` — the registry as the workspace catalogue | `content.module.ts` | ✅ E2E |
| F56 | Public API: bearer token auth | `public-api/http/guards/api-token.guard.ts` | ✅ E2E |
| F57 | Public API: workspace resolved from the token bucket (403 outside it) | `api-token-workspace.guard.ts:37-71` | ✅ E2E |
| F58 | Public API: `resolveGrantedType` — ungranted type ⇒ same 404 as unknown | `resolve-granted-type.ts:45-57` | ✅ E2E |
| F59 | Public API: published-only by default; `?status=draft\|any` needs write scope | `draft-visibility.guard.ts:40-67` | ✅ E2E |
| F60 | Public API: sparse fieldsets (`?fields=`), unknown name ⇒ 400 | `public-api/infrastructure/field-selection.ts` | ✅ E2E |
| F61 | Public API: relation expansion, grant-pruned | `public-entries.query.ts:616-640`, `public-expansion.query.ts` | ✅ E2E |
| F62 | Public API writes: create / update / delete / publish / unpublish | `public-entry-writes.service.ts` | ✅ E2E |
| F63 | MCP tool provider (content CRUD over the public-API rules) | `mcp/content-tools.provider.ts` | ✅ E2E |
| F64 | Copilot read tools (`admin_content_types`/`_search`/`_get`) | `copilot/content-tool.provider.ts` | ✅ E2E |
| F65 | Copilot revision tools (`_revisions`, `_diff`) | `copilot/revision-tool.provider.ts` | ⚠️ PARTIAL |
| F66 | Copilot propose tools + appliers (no `status` parameter at any role) | `copilot/entry-proposal.provider.ts`, `entry-proposal.applier.ts` | ✅ E2E |
| F67 | Content insights aggregates (6 routes) | `insights/infrastructure/queries/content-insights.query.ts` | ✅ E2E |
| F68 | OpenAPI description generated from the registry | `docs/describe-content-api.ts`, `field-schema.ts` | 🧪 UNIT |

## 3. Manual Test Plan

Common preconditions: server up, migrations applied, logged in, `WS` = a
workspace you are a member of, `WS2` = a second workspace you also belong to,
`WS3` = one you do **not**. `test_article` is publishable + paranoid;
`test_page` is a self-referential type; `test_landing` is a `single`. Roles:
`ADMIN` (all content permissions), `CONTRIB` (create/update/publish, no delete),
`VIEWER` (read only).

Because this unit has no UI, each block's keyboard/screen-reader row is
**Not Applicable**; see §4A for what *is* in scope (the 504 modelling
questions).

### F11 / F12 / F13 — Content schema

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/content-schema` unauthenticated | `401` |
| 2 | as `VIEWER` | `200`, a summary array (name, kind, label, `i18n`, `publishable`, `paranoid`) for **every registered type** |
| 3 | Send **no** `X-Workspace-Id` | `200` — this route carries no `WorkspaceGuard` |
| 4 | `GET /api/content-schema/test_article` | `200`, the full field schema with per-field `type`, `required`, `validation`, `options`, `relation`, `localized` |
| 5 | `GET /api/content-schema/nope` | `404 Unknown content type "nope".` |
| 6 | `GET /api/content-schema/test_article/filter-fields` with `X-Workspace-Id: WS` where `WS` **was** granted `test_article` | `200`, the recursive filterable surface with relation hops pruned to granted targets |
| 7 | Same for a type `WS` was **not** granted | `404` — identical to the unknown-type message |
| 8 | Compare steps 4 and 7 | Step 4 returns the full schema for an ungranted type while step 7 refuses — see `🐞 BUG-content-server-01` |

### F14 / F15 / F16 / F17 / F18 / F19 / F21 — The list pipeline

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/content/test_article` with `X-Workspace-Id: WS` | `200 {items:[…], total:N, page:1, pageSize:25}` |
| 2 | `?page=2&pageSize=5` | `items.length ≤ 5`, `page:2`, `total` unchanged |
| 3 | `?pageSize=101` | `400` (`@Max(MAX_PAGE_SIZE)`, `entries.constants.ts:7`) |
| 4 | `?pageSize=0` / `?page=0` | `400` (`@Min(1)` on both) |
| 5 | `?page=9999` (beyond the last) | `200` with `items: []` and the true `total` — **not** an error and **not** clamped |
| 6 | `?search=hello` | Rows whose text/richtext/select columns ILIKE-match |
| 7 | `?search=%` | Treated as a literal, not a wildcard — verify the escaping |
| 8 | `?sort=-updatedAt` / `?sort=title` | Descending / ascending, always with `id` as tiebreaker |
| 9 | `?sort=tags` (a many-relation) | Falls back to `updatedAt desc` — not a 400 |
| 10 | `?sort=notacolumn` | Same silent fallback |
| 11 | `?sort=-status` on a **non-publishable** type | Silent fallback (status is not in the whitelist for that type) |
| 12 | `?filter={"op":"and","rules":[{"field":"author.name","op":"eq","value":"Ada"}]}` | Only entries whose related author matches |
| 13 | `?filter=` with a path deeper than the hop budget | `400` |
| 14 | `?filter=` naming an unknown field under a relation | `400` |
| 15 | `?filter=` longer than 4096 chars | `400` (`FILTER_MAX_LENGTH`) |
| 16 | `?filter=notjson` | `400`, not 500 |
| 17 | `?deleted=only` on `test_article` | Only soft-deleted rows |
| 18 | `?deleted=only` on a non-paranoid type | The normal list — the predicate collapses to `undefined` |
| 19 | Create an entry in `WS`, then list with `X-Workspace-Id: WS2` | The entry is **absent** — the workspace predicate is in the `WHERE` (`entries.service.ts:181`), not only in the guard |
| 20 | Omit `X-Workspace-Id` entirely | `400 Missing or malformed X-Workspace-Id header.` |
| 21 | `X-Workspace-Id: WS3` (not a member) | `403` |

### F20 / F23 / F24 — Relations and media reads

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?relations=preview` with no `relationFields` | `relations` omitted from every item |
| 2 | `?relations=preview&relationFields=author,tags` | Each item carries a capped preview for those two fields only |
| 3 | `?relations=preview&relationFields=nosuchfield` | Unknown names dropped; the request still succeeds |
| 4 | List a 1-row page and a 5-row page with the same preview | The **same** number of SQL queries — batched, not N+1 |
| 5 | `GET /:type/:id/relations` | Every field's links, first page each, with true totals |
| 6 | `GET /:type/:id/relations/tags?page=2` | The second page of that one field |
| 7 | `GET /:type/:id/relations` for an id in another workspace | `404` |
| 8 | `GET /:type/:id/media` | Media ids resolved to `{name, thumbnailUrl, kind}` refs |
| 9 | Same with the media plugin unregistered | An empty/no-op result, not a 500 |

### F25 / F27 / F32 / F33 / F34 — Create

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/content/test_article {"values":{"title":"Hello"}}` | `201`, record with `status:'draft'`, `publishedAt:null`, and `workspaceId` = the header's |
| 2 | `POST` with a value for an unknown field | `422` `unknown field on "test_article"` |
| 3 | `POST` with `status:'published'` in `values` | `422` unknown field — envelope columns are reserved and not in `type.fields` |
| 4 | `POST` with `workspaceId` in `values` | `422` unknown field |
| 5 | `POST` on a **non-publishable** type missing a required field | `422 {issues:[…]}` — a non-publishable type validates on every write |
| 6 | `POST` on a **publishable** type missing a required field | `201` — a draft may be incomplete |
| 7 | `POST` with `author` = an id in `WS2` | `422` (uniform — no not-found-vs-forbidden distinction) |
| 8 | `POST` with `author` = a non-existent uuid | `422`, the **same** message shape as step 7 |
| 9 | `POST` with `author` = a non-uuid string | `422` from the kernel (`must be an entry id`) |
| 10 | `POST` with a media id from `WS2` | `422` |
| 11 | `POST` with a media asset whose kind fails `accept` | `422` |
| 12 | `POST` twice with the same `localeGroupId` + `locale` on an `i18n` type | The second is `409`, not a 500 (`uniqueGuarded`) |
| 13 | `POST` claiming an already-taken `unique: true` relation target | `422` with a field-level message, not a 500 constraint error |
| 14 | `POST` on a `single` type that already has an entry | Verify the intended behaviour — a `single` should hold exactly one row per workspace |

### F28 / F29 / F30 — Update

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `PATCH /api/content/test_article/:id {"values":{"title":"Edited"}}` | `200`, `updatedAt` advanced |
| 2 | `PATCH` an entry that is currently `published` | `status` returns to `'draft'`; **`publishedAt` is kept** — the admin renders that pair as "Modified" |
| 3 | `PATCH` an id belonging to `WS2` using `X-Workspace-Id: WS` | `404` — `liveWhere` ANDs the workspace |
| 4 | `PATCH` a soft-deleted id | `404` — `liveWhere` excludes tombstones |
| 5 | `PATCH` with a relation delta on a **single** relation | `400` |
| 6 | `PATCH` with a malformed delta (non-array `unlink`) | `400`, not 500 |
| 7 | `PATCH` with a whole-set `values.tags = [ids]` | The link set is replaced wholesale |
| 8 | `PATCH` with `relations:{tags:{link:[id]}}` | The delta is **merged** onto existing links, not replacing them |
| 9 | Force a failure after the column update (e.g. a bad relation target in the same call) | Nothing is written — one transaction |
| 10 | Two clients `PATCH` the same entry concurrently with different titles | Both `200`; the second silently overwrites the first — see `🐞 BUG-content-server-02` |

### F38 / F39 / F40 / F41 — Publish lifecycle

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /:type/:id/publish` on a complete draft | `200`, `status:'published'`, `publishedAt` stamped; the latest revision becomes `published` |
| 2 | Publish an **incomplete** draft | `422 {issues:[…]}` from the publish gate |
| 3 | Publish an already-published entry | Verify: idempotent no-op or a transition error — `assertTransition` throws on a same-state pair (`content-domain` `entry-status.ts:72-76`), so callers must short-circuit |
| 4 | `POST /:type/:id/unpublish` | `status:'draft'`, `publishedAt` **cleared**; the published revision returns to `draft` |
| 5 | Publish on a non-publishable type | `400` |
| 6 | Publish an id from another workspace | `404` |
| 7 | Publish a draft with a required **many** relation that has no links | `422` — the link check is the other half of the gate |

### F42 — Soft delete / restore / purge

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `DELETE /:type/:id` on a paranoid type | `204`; the row disappears from the default list and appears under `?deleted=only` |
| 2 | `POST /:type/:id/restore` | The row returns to the live list |
| 3 | `DELETE /:type/:id/permanent` | The row is gone from both views; join-table links cascade away |
| 4 | Soft-delete a relation **target**, then read the source's links | The link is **kept** on soft delete |
| 5 | Purge that target | The link is dropped (FK cascade) |
| 6 | `DELETE` on a **non**-paranoid type | Verify: a hard delete, or a 400 — pin whichever it is |
| 7 | `DELETE` an id from another workspace | `404` |
| 8 | Restore an id that was never deleted | Verify: no-op 200/204, or 404 |

### F43 / F44 — Bulk

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /:type/bulk/publish/preview {"ids":[…]}` | A per-id verdict list distinguishing publishable from blocked, with the blocking issues |
| 2 | `POST /:type/bulk/publish` with a mix | Only the valid drafts publish; the rest are reported, and the route is `bulk/publish`, not `:id/publish` |
| 3 | `{"ids":[]}` | Verify: `400`, or a `200` no-op |
| 4 | `{"ids": [...101 ids]}` | `400` (`BULK_MAX_IDS = 100`) |
| 5 | `{"ids":["not-a-uuid"]}` | `400` |
| 6 | `{"ids":[<id in WS2>]}` | That id is silently skipped (workspace-scoped `WHERE`) — confirm it is not reported as published |
| 7 | `{"ids":[<same id twice>]}` | Verify the duplicate is de-duplicated, not double-counted |
| 8 | `bulk/delete` then `bulk/restore` the same set | Round-trips cleanly |

### F45 / F46 / F47 / F48 / F49 / F50 / F51 — Revisions

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Create an entry, then `GET /:type/:id/revisions` | One revision, `#1`, `status:'draft'`, `createdBy` = the acting user |
| 2 | Save three more times | Revisions `#4,#3,#2,#1` newest-first, `total: 4` |
| 3 | `?pageSize=200` | Clamped to `MAX_PAGE_SIZE` (100), not an error (`clampInt`, `revisions.controller.ts:64`) |
| 4 | `?page=abc` | Clamped to 1 |
| 5 | `GET .../revisions/2` | The full `{values, relations}` snapshot with relation ids resolved to titled refs |
| 6 | `GET .../revisions/999` | `404 No revision #999 for entry "…".` |
| 7 | `GET .../revisions/-1` | Verify: `404` (or `400` from `ParseIntPipe`) |
| 8 | `POST .../revisions/2/restore` | The live row matches v2's content **and** a new `#5` is appended — history is append-only |
| 9 | `POST .../revisions/2/publish` on an earlier version | v2's content is re-applied, v2 is marked `published`, the previously-published one `superseded`, and **no** new version is minted |
| 10 | `POST .../revisions/<latest>/publish` | Published in place, timeline length unchanged |
| 11 | Publish an earlier, **incomplete** version | `422 {issues}`; the content is already re-applied and left live as a draft (documented, recoverable) |
| 12 | `GET /api/content/<a *different* type>/:id/revisions/1` for the same entry id | Returns the entry's snapshot anyway — see `🐞 BUG-content-server-03` |
| 13 | `GET .../revisions` for an id in `WS2` | Empty list / 404 — the store ANDs `workspace_id` (`drizzle-revision.store.ts:86-87,149-150,183-184,209-210`) |
| 14 | Two concurrent saves of the same entry | Both succeed with distinct revision numbers (advisory lock + `(entry_id, revision_number)` unique) |

### F52 / F53 — The `CONTENT_ENTRY_EXTENSION` port

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Boot with `I18nServerPlugin` **removed** and no `i18n: true` type registered | Server boots normally |
| 2 | Boot with `I18nServerPlugin` removed and an `i18n: true` type registered | Boot **fails** with `Content type(s) "x" declare i18n: true, but no CONTENT_ENTRY_EXTENSION is bound…` (`entry-extension-boot-check.ts:36-42`) |
| 3 | With the port unbound, `GET /api/content/test_article` | `200` — `listScope` and `filterExtension` are optional-chained (`entries.service.ts:182,205`) |
| 4 | With the port unbound, `POST /api/content/test_article` | `201` — `createColumns` and `afterUpdate` are optional-chained (`entry-writer.service.ts:328`, `:670`) |
| 5 | With the port unbound, `GET /api/content/test_article?locale=fr` | `200` with **unlocalized** rows — the param is accepted by the DTO and silently ignored (documented at `list-entries-query.dto.ts:172`) |
| 6 | With the port unbound, `POST` with `locale` / `localeGroupId` in the body | Accepted and **dropped**; confirm no column is written and no error is raised |
| 7 | With the port unbound, `?filter=` naming a virtual extension field (e.g. `translationStatus`) | `400` unknown field — the surface has no `extensionFields` |

### F54 / F55 — The ports content binds for workspaces

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/content-types` | The registry, not workspaces' mock catalogue |
| 2 | Create one entry, then `GET /api/workspaces/:id/content/test_article/entry-count` | `{"count":1}` |
| 3 | Soft-delete it, re-read the count | Still `1` — tombstoned rows keep the grant (`entry-counter.service.ts:27-30`) |
| 4 | `GET /api/workspaces/:id/entry-count` | The sum over **every registered type**, including types the workspace was never granted (`entry-counter.service.ts:43-50`) |

### F56 – F62 — The public API

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/v1/content/test_article` with no `Authorization` | `401` |
| 2 | With a revoked or malformed token | `401` |
| 3 | With a valid single-workspace token and **no** `X-Workspace-Id` | `200` — the bucket's only workspace is used |
| 4 | With a multi-workspace token and no header | `400`, naming the count |
| 5 | With `X-Workspace-Id` outside the bucket | `403 This token does not cover that workspace.` |
| 6 | With a malformed `X-Workspace-Id` | `400` |
| 7 | `GET /api/v1/content/<ungranted type>` | `404`, identical to an unknown type (`resolve-granted-type.ts:53-55`) |
| 8 | `GET /api/v1/content/test_article` with a read-only token | Only `published` rows |
| 9 | Add `?status=draft` with a read-only token | `403 status=draft requires a token with write scope.` |
| 10 | Same with a write-scoped token | `200`, drafts included |
| 11 | `?status=bogus` | `400` from the DTO's `@IsIn` — the guard deliberately steps aside (`draft-visibility.guard.ts:43-52`) |
| 12 | `?fields=title,slug` | Only those keys in `values`, plus the envelope |
| 13 | `?fields=nosuchfield` | `400` — unlike the copilot tools, a typo is surfaced |
| 14 | `?expand=author` where `author`'s target is **not** granted | The expansion is pruned (`public-entries.query.ts:630`) |
| 15 | `POST /api/v1/content/test_article` with a read-only token | `403` |
| 16 | Write, then read back with the same token | The response is the read-back through the same grant-pruned query |

### F63 – F66 — Agent surfaces

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `MCP_ENABLED=true`, call `tools/list` over `POST /api/v1/mcp` | The content CRUD tools appear |
| 2 | Call a content tool with a token lacking the permission | A legible `HttpException`-derived error, not an opaque 500 (BUGBOT: "Bare `Error` in a shared tool's handler") |
| 3 | Copilot `admin_content_search` with `filter` as an **object** | The tool stringifies it; an unknown path is rejected |
| 4 | Copilot `admin_content_search` with `fields:['nosuch']` | The name is **ignored** (not a 400) — deliberately different from the public API |
| 5 | Copilot `content_propose_update` with an unknown field | An **error** — a human must not approve a change that writes nothing |
| 6 | Copilot `content_propose_*` with a `status` argument | Rejected — no `status` parameter exists at any role (ADR-0005 §7) |
| 7 | Copilot tools with `locale:'zz'` | A tool error, never a silent read of the default |

### F67 — Content insights

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/insights/content/totals?from=…&to=…` | Aggregates scoped to the workspace |
| 2 | `from` after `to` | `400` from `insights-range-query.dto.ts` |
| 3 | An enormous range | Verify the query is bounded |
| 4 | Same request against `WS2` | Disjoint numbers — confirm the aggregates carry the workspace predicate, not just the guard |

## 4. Edge Cases & Negative Paths

**Empty / zero**

- **EC-01 — A type with zero entries.** `✅ E2E` `{items:[], total:0, page:1, pageSize:25}` — not a 404.
- **EC-02 — `values: {}` on a create.** `❌ NONE` A publishable type accepts it (empty draft); a non-publishable one 422s each required field.
- **EC-03 — `relations: {}` on a save.** `❌ NONE` No-op.
- **EC-04 — A workspace granted no content types at all.** `❌ NONE` The public API 404s everything; the **admin** API still serves every type — `🐞 BUG-content-server-01`.
- **EC-05 — An entry whose every value is `null`.** `❌ NONE` Round-trips as `null`s; confirm the revision snapshot records them rather than omitting the keys.

**Boundary & pagination**

- **EC-06 — `pageSize` 1 / 100 / 101.** `⚠️ PARTIAL` 101 → 400 is asserted (`apps/server-e2e/src/server/content/list-entries.spec.ts:174`); the exactly-at-cap case is not.
- **EC-07 — `page` beyond `pageCount`.** `❌ NONE` Returns an empty `items` with the true `total`. The server does **not** clamp — clamping is the admin's job, which is where the classic stranded-pager bug lives (see `content-admin.md`).
- **EC-08 — `page` = `Number.MAX_SAFE_INTEGER`.** `❌ NONE` `offset` becomes astronomically large; Postgres accepts it and returns nothing, but the count query still runs. Confirm no overflow error.
- **EC-09 — Revisions `?pageSize=1000` / `?page=-5`.** `❌ NONE` `clampInt` bounds both (`revisions.controller.ts:63-64`) — a nicer contract than the entries list's hard 400. The inconsistency between the two is worth pinning.
- **EC-10 — `?filter=` at exactly 4096 / 4097 chars.** `❌ NONE`
- **EC-11 — Bulk with exactly 100 / 101 ids.** `❌ NONE`
- **EC-12 — Relation hop budget exactly at / one past the limit.** `✅ E2E` `list-entries-relation-filter.spec.ts:432`.

**Size & encoding**

- **EC-13 — A 10 MB richtext body.** `❌ NONE` No length cap unless the field declares `maxLength`; it is also copied verbatim into every revision snapshot, so N saves store N copies. Storage growth is unbounded and untested.
- **EC-14 — Emoji / RTL / CJK in a text field.** `❌ NONE` See `🐞 BUG-content-domain-04` for the length-counting consequence.
- **EC-15 — `<script>` in a text or richtext value.** `❌ NONE` Stored and returned verbatim — correct for an API, but it means the **public** API hands unsanitised HTML to arbitrary consumers.
- **EC-16 — `?search=%` / `_` / `\`.** `❌ NONE` These are ILIKE metacharacters. Verify `entry-search.ts` escapes them; an unescaped `%` turns a search into a match-all.
- **EC-17 — A `:typeName` containing a path traversal or SQL fragment.** `❌ NONE` Safe by construction — `registry.get(typeName)` is a map lookup and a miss is a 404, so the value never reaches SQL.
- **EC-18 — A `:field` path param on `/relations/:field` naming a non-relation.** `❌ NONE` Expected `400`/`404`, verify it is not a 500.

**Permission matrix** (admin API; membership assumed)

| Route | unauth | viewer | contributor | admin |
| --- | --- | --- | --- | --- |
| `GET /api/content-schema[/:name]` | 401 ✅ | 200 ⚠️ | 200 ❌ | 200 ✅ |
| `GET /api/content/:type` | 401 ✅ | 200 ✅ | 200 ❌ | 200 ✅ |
| `POST /api/content/:type` | 401 ✅ | 403 ✅ | 201 ✅ | 201 ✅ |
| `PATCH /api/content/:type/:id` | 401 ✅ | 403 ❌ | 200 ❌ | 200 ✅ |
| `DELETE /api/content/:type/:id` | 401 ✅ | 403 ✅ | **403** ✅ | 204 ✅ |
| `POST .../publish` | 401 ❌ | 403 ❌ | 200 ❌ | 200 ✅ |
| `POST .../revisions/:n/restore` | 401 ❌ | 403 ❌ | 200 ❌ | 200 ❌ |
| `POST .../revisions/:n/publish` | 401 ❌ | 403 ❌ | 200 ❌ | 200 ❌ |
| `POST .../bulk/*` | 401 ❌ | 403 ❌ | mixed ❌ | 200 ⚠️ |

- **EC-19 — A contributor can create but not delete.** `✅ E2E` `content-entries-write.spec.ts:829`.
- **EC-20 — A viewer is refused create and delete.** `✅ E2E` `content-entries-write.spec.ts:808`.
- **EC-21 — Every permission is a `PERMISSIONS.*` constant.** `✅` Verified: `grep -rn "RequirePermissions('" packages/content/server/src` returns no inline string.
- **EC-22 — The revision restore/publish routes' permissions.** `❌ NONE` Restore requires `content:update` and publish `content:publish` — a defensible split, entirely untested by role.

**Tenant isolation** — the headline risk

- **EC-23 — List with another workspace's header.** `✅ E2E` `list-entries.spec.ts:209`.
- **EC-24 — Read one entry by id from another workspace.** `✅ E2E` `content-entries-write.spec.ts:165` (404 on unknown id) plus the write suite's cross-workspace cases.
- **EC-25 — The `total` **count** is scoped, not just the page.** `✅` Verified structurally: the count and page queries share one `where` (`entries.service.ts:99-110`), so a leak in one is impossible without the other.
- **EC-26 — Relation **subqueries** are workspace-scoped.** `✅ E2E` `list-entries-relation-filter.spec.ts:152` asserts a target in another workspace is excluded; the code comment at `entries.service.ts:169-176` states the same invariant.
- **EC-27 — Relation **preview** is workspace-scoped.** `⚠️ PARTIAL` `workspaceId` is threaded into `previewForEntries` (`entries.service.ts:130`), but no e2e proves a cross-workspace target is hidden from the preview specifically.
- **EC-28 — Writing a relation to a target in another workspace.** `✅ E2E` `content-entries-write.spec.ts:204,354,536` — 422 on create, on many-to-many, and via a delta.
- **EC-29 — Media assets from another workspace.** `✅ E2E` `content-media-fields.spec.ts:115`.
- **EC-30 — Revision history across workspaces.** `⚠️ PARTIAL` Every store method ANDs `workspace_id` — verified by reading `drizzle-revision.store.ts:86,135,149,183,209`. No e2e exercises a cross-workspace revision read.
- **EC-31 — Insights aggregates across workspaces.** `❌ NONE` Verify each of the six queries carries the workspace predicate in SQL, not merely the guard.
- **EC-32 — Bulk actions with ids from another workspace mixed in.** `❌ NONE` They should be silently skipped by the scoped `WHERE`; confirm the response does not report them as succeeded (which would be an existence oracle).
- **EC-33 — Public API expansion into a granted type in a *different* workspace.** `❌ NONE` Should be impossible (every subquery is workspace-scoped); worth an explicit test given how many query paths exist.

**Content grants (`workspace_content`) — the access-control mapping**

- **EC-34 — Read a type the workspace was never granted, via the admin API.** `❌ NONE` **Succeeds.** `resolveType` (`entries/http/controllers/resolve-type.ts:10-19`) only checks the registry. `🐞 BUG-content-server-01`.
- **EC-35 — Create an entry of an ungranted type.** `❌ NONE` Also succeeds — same root cause. The entry is then invisible in the admin (whose nav renders from `workspace.content`) yet counts toward the workspace-delete guard.
- **EC-36 — Revoke a grant, then create entries of that type.** `❌ NONE` The revoke is only allowed at count 0 (`workspaces-server`), and nothing stops a create immediately after — so the "revoke never orphans records" invariant can be re-broken from the other side.
- **EC-37 — `GET /api/content-schema/:name` for an ungranted type.** `❌ NONE` Returns the full field schema. Its sibling `/filter-fields` 404s (`list-entries-relation-filter.spec.ts:501`). Three endpoints, three answers.

**Concurrency**

- **EC-38 — Two editors save the same entry.** `❌ NONE` **Last write wins silently** — `🐞 BUG-content-server-02`.
- **EC-39 — Concurrent saves and revision numbering.** `⚠️ PARTIAL` Correctly handled: `nextNumber` runs under `pg_advisory_xact_lock` keyed on the entry id (`drizzle-revision.store.ts:38-48`) with a `(entry_id, revision_number)` unique constraint as the backstop (`revision-table.ts:62-65`). This is the BUGBOT count-then-write pattern done **right**. No test proves the interleaving.
- **EC-40 — Concurrent create + workspace delete.** `⚠️ PARTIAL` Creates take `lockWorkspaceShared` (`entry-writer.service.ts:372`); the workspace delete takes the exclusive lock. Correct by construction, untested.
- **EC-41 — Concurrent claim of a `unique: true` relation target.** `❌ NONE` `assertUniqueRelations` runs before the transaction for the friendly message and the partial unique index is the real guarantee; `uniqueGuarded` reads the violated constraint name to tell the two indexes on a localized table apart. A well-designed race, entirely untested.
- **EC-42 — Concurrent publish of the same entry.** `❌ NONE` Both may pass the gate; verify the revision `published`/`superseded` bookkeeping converges rather than leaving two `published` versions.
- **EC-43 — Double-submit of a create.** `❌ NONE` There is no idempotency key, so two identical POSTs create two entries. Correct for a CMS, worth documenting.
- **EC-44 — Concurrent bulk publish and single unpublish on the same id.** `❌ NONE`

**State after mutation**

- **EC-45 — Delete the last entry on the last page.** `❌ NONE` The server just returns fewer rows; the pager consequence is the admin's (see `content-admin.md`).
- **EC-46 — Filters surviving a refetch.** Not applicable server-side — every request is stateless.
- **EC-47 — Editing a published entry.** `✅ E2E` `content-entries-write.spec.ts:129,661` — returns to draft, keeps `publishedAt`.
- **EC-48 — Restoring a revision of an entry that has since been soft-deleted.** `❌ NONE` `writer.update` uses `liveWhere`, so it should 404. Verify it is not a 500.
- **EC-49 — Purging an entry that other entries link to.** `✅ E2E` `content-entries-write.spec.ts:605` — links drop via FK cascade on purge, survive a soft delete.
- **EC-50 — Purging an entry with a `restrict` relation pointing at it.** `❌ NONE` Should be a 409-shaped refusal, not a raw FK 500.

**Content-type shape changes after entries exist**

- **EC-51 — Add a required field to a type with existing entries.** `❌ NONE` Existing rows have `NULL`; they still list and read, but every **publish** now 422s and every non-publishable save fails until the field is filled. There is no migration story for this and no test.
- **EC-52 — Remove a field from a type.** `❌ NONE` The column is dropped by the host migration, but **old revision snapshots still carry the key**. Restoring such a revision passes the stale key into `values` → `unknown field` 422, making history un-restorable. Untested and untriaged.
- **EC-53 — Rename a field.** `❌ NONE` Equivalent to remove + add; every prior revision snapshot becomes partially unrestorable.
- **EC-54 — Change a field's type (text → number).** `❌ NONE` Old snapshots hold the wrong runtime type; a restore 422s.
- **EC-55 — Tighten `validation` (raise `minLength`).** `❌ NONE` Existing rows become unpublishable with no signal until someone tries.
- **EC-56 — Flip `publishable` off on a type with published entries.** `❌ NONE` The `status`/`published_at` columns disappear; verify reads do not 500 on a missing column.
- **EC-57 — Flip `paranoid` off with tombstoned rows present.** `❌ NONE` The tombstones become live rows.

**Relations**

- **EC-58 — Self-referential relation (`test_page.parent`).** `✅ E2E` `list-entries-relation-filter.spec.ts:352-398`, including two self-hops and the "does not match a page against its own row" case.
- **EC-59 — A cycle (A.parent = B, B.parent = A).** `❌ NONE` Nothing forbids it. Filter traversal is bounded by the hop budget, so it terminates, but confirm the relation **preview** and the public API's `expand` do not recurse.
- **EC-60 — An entry pointing at itself.** `❌ NONE`
- **EC-61 — A dangling relation target (row purged out from under the FK).** `❌ NONE` FK `cascade`/`set null` should prevent it; verify for the `jsonb`-stored **media** ids, which have **no FK** — an asset deleted in the media plugin leaves a dangling uuid in the values bag with nothing to clean it.
- **EC-62 — `onDelete: 'restrict'` on a required relation.** `❌ NONE` See EC-50.
- **EC-63 — Cross-locale link on an `i18n` type.** `⚠️ PARTIAL` `assertSameLocale` forbids it (`entry-writer.service.ts` + `same-locale.spec.ts` unit); the i18n e2e touches it indirectly.

**Failure & partiality**

- **EC-64 — DB error mid-save.** `❌ NONE` One transaction covers columns + links + extension `afterUpdate` + the revision append (`entry-writer.service.ts:621-698`), so a failure should leave nothing — including no orphan revision.
- **EC-65 — Extension `afterUpdate` throws.** `❌ NONE` Runs inside the transaction, so the whole save rolls back. Documented, untested.
- **EC-66 — `MEDIA_ASSET_RESOLVER` unbound.** `⚠️ PARTIAL` Media fields shape-validate and store but skip existence/`accept` — a documented degradation that silently weakens a security check when the media plugin is absent.
- **EC-67 — `CONTENT_ENTRY_EXTENSION` unbound.** `⚠️ PARTIAL` Fully handled: boot check for `i18n` types, optional chaining on all four hooks. `?locale=` is silently ignored rather than 400 — documented at `list-entries-query.dto.ts:172`, but a caller who mistakenly believes localisation is on gets the default locale's rows with no signal.
- **EC-68 — Two `CONTENT_ENTRY_EXTENSION` bindings.** `❌ NONE` Only one is supported; a second silently replaces the first (AGENTS.md). No boot check catches it.
- **EC-69 — A second copilot tool registrar.** `❌ NONE` Same shape of hazard; the AGENTS.md documents that a second binder would silently replace this one.

### 4A. Accessibility & Section 508 Conformance

This unit renders **no UI**, so Chapter 4 and the WCAG
Perceivable/Operable/Understandable criteria are **Not Applicable**. What is in
scope is **508 Chapter 5 / 504 Authoring Tools** — Ortha is an authoring tool
and this package is its content **API and storage engine**, so 504.2 ("can an
author produce conformant content?") and 504.2.1 ("is accessibility information
preserved across save, reload, revision restore, locale copy and export?") both
land here. 504.2.1 in particular is a *server* question: the admin can prompt
for alt text all it likes, but if the API does not accept, store and return it
— and return it identically after a revision restore or a locale copy — the
information is not preserved.

Standards: Revised Section 508 (36 CFR Part 1194, App. A–C), incorporating WCAG
2.0 A+AA (E205.4 / 504.2); the repo's `accessibility` skill targets WCAG 2.1 AA
(`.agents/skills/accessibility/SKILL.md:10`).

| Provision | Verdict | Basis |
| --- | --- | --- |
| 508 E205.4 → WCAG 1.x / 2.x / 3.x / 4.x | **Not Applicable** | No rendered content |
| 508 502.2 / 502.3 / 503.2 | **Not Applicable** | No platform UI |
| **504.2** — enables conformant content | **Does Not Support** | ♿ A11Y-content-server-01, -02 |
| **504.2.1** — preserves accessibility information | **Partially Supports** | ♿ A11Y-content-server-03 |
| **504.3** — prompts for accessibility information | **Not Applicable here** | No authoring surface; the API's job is to *accept* what the editor prompts for, which is ♿-01 |
| **504.4** — templates support conformant output | **Does Not Support** | ♿ A11Y-content-server-02 |

#### ♿ A11Y-content-server-01 — The API accepts and returns a media field as a bare asset id, so there is no wire shape for per-usage alt text

- **WCAG:** `1.1.1 Non-text Content (A)` · **508:** `504.2 / 504.2.1` · **Verdict:** **Does Not Support**
- **Location:** `packages/content/server/AGENTS.md` (Media fields section) —
  *"a single field is a `uuid('<field>')` column, a `multiple: true` field a
  `jsonb('<field>')` array of ids"* — and
  `packages/content/server/src/lib/entries/infrastructure/persistence/media-accept.ts`,
  which validates only the asset's **kind/MIME** against `accept`, never a text
  alternative. `GET /:type/:id/media` (`media-refs.query.ts`) resolves ids to
  `{name, thumbnailUrl, kind}` — a *filename*, not alt text.
- **Repro:** `PATCH /api/content/test_article/:id` with
  `{"values":{"hero":"<asset-uuid>","hero_alt":"A red bicycle"}}`.
  → Observed: `422 unknown field on "test_article"` — there is nowhere on the
  wire to put it. Read the entry back: the `hero` value is a bare uuid.
- **Effect on a disabled user:** every downstream consumer of this API — the
  admin preview, the public REST API, the GraphQL adapter, an MCP client, a
  static site generator — receives an image reference with no text alternative
  it could render as `alt`. The best any of them can do is fall back to the
  asset's filename, which 1.1.1 explicitly does not accept as a text
  alternative.
- **Remediation:** widen the stored media value to an object
  (`{id, alt?, decorative?}`), accept and return it through the same values bag
  (which gets revision capture and locale sync for free — see ♿-03), and extend
  `assertMediaTargets` to require `alt` **or** `decorative` on a required media
  field before publish.
- **Cross-reference:** the model-level half is `♿ A11Y-content-domain-01`. This
  finding is the API half — they must be fixed together.

#### ♿ A11Y-content-server-02 — Neither the field-type system nor the shipped content-type definitions provide a caption, summary, or heading-structure channel

- **WCAG:** `1.3.1 Info and Relationships (A)` · **508:** `504.2 / 504.4` · **Verdict:** **Does Not Support**
- **Location:** the field-type vocabulary at
  `packages/content/server/src/lib/types/fields.ts` / `src/lib/fields/index.ts`
  (twelve builders: `text`, `richtext`, `number`, `money`, `boolean`, `date`,
  `datetime`, `select`, `multiselect`, `json`, `relation`, `media`), and the
  reference definitions under `apps/server/src/collections` +
  `apps/server/src/pages`.
- **Why it matters (504.4 specifically):** the shipped content types are the
  templates every installation starts from. None of them models a table caption,
  a figure caption, a long description, or a language marker; `richtext` is a
  single opaque string as far as this package is concerned
  (`validation/services/entry-validation.service.ts` delegates to the kernel,
  which type-checks it as `string`). An installation that copies these
  definitions therefore *starts* unable to express the structures 1.3.1 needs.
- **Repro:** `GET /api/content-schema/test_article` and read the field list —
  no field carries or permits a caption/alt/lang member; `GET /api/content-schema`
  shows the same for every shipped type.
- **Effect on a disabled user:** downstream tables have no caption and no
  programmatic header association; figures have no caption; a foreign-language
  quotation carries no `lang`.
- **Remediation:** add the missing modelling primitives to the DSL (a `caption`
  member on `media`, structured rich text, an optional `lang` on text-like
  fields), and update the reference collections so the default templates
  demonstrate them.

#### ♿ A11Y-content-server-03 — Accessibility information would be preserved by the existing revision/locale machinery, but only for values that ride the values bag — which is exactly what alt text does not

- **WCAG:** `1.1.1 (A)`, `3.1.2 (AA)` · **508:** `504.2.1` · **Verdict:** **Partially Supports**
- **Location:** `packages/content/server/src/lib/revisions/infrastructure/persistence/revision-snapshot.ts`
  (the `{values, relations}` snapshot), `entry-writer.service.ts:680-696` (the
  revision append inside the save transaction), and the shared-field locale sync
  behind `CONTENT_ENTRY_EXTENSION` (`extension/entry-extension.ts` `afterUpdate`).
- **The good half:** the design is genuinely sound for this requirement. AGENTS.md
  states it directly of media fields: *"Because media values ride the values bag,
  they are captured by the **revision snapshot**, synced across locale siblings
  when **shared**, and per-locale when `localized: true` — all for free, like any
  scalar."* So the moment alt text lives in the values bag (♿-01's fix), it is
  automatically preserved across save, revision restore and locale copy, with no
  further work. `content-media-fields.spec.ts:208` already proves media ids
  survive into the snapshot.
- **The failing half:** today there is nothing to preserve, and one concrete
  regression already exists — **EC-52**: when a field is removed from a
  content type, old revision snapshots still carry the key, so restoring such a
  revision fails with `unknown field`. Any accessibility metadata added later
  and then renamed would be lost the same way. That is a 504.2.1 preservation
  failure in the machinery itself, independent of ♿-01.
- **Repro (the preservation failure that exists now):** 1) create an entry with
  a value in field `x`; 2) remove `x` from the type definition and migrate;
  3) `POST /:type/:id/revisions/1/restore`.
  → Observed: `422 unknown field on "<type>"` — the version is permanently
  unrestorable. Expected: unknown keys in a **stored snapshot** are dropped with
  a warning, not treated as client input.
- **Remediation:** make revision restore tolerant of snapshot keys that no longer
  exist on the type (drop-and-report rather than 422), and land ♿-01 so there is
  accessibility information for this machinery to carry.

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F11/F12 Schema | `apps/server-e2e/src/server/content/content-schema.spec.ts:66,72,78,91,127,152` | 401 list/detail; 403 without `content:read`; the summary and full-field shapes; 404 unknown | ✅ E2E — **no** grant case, and no `X-Workspace-Id` case (the route has no `WorkspaceGuard`) |
| F13 Filter fields | `apps/server-e2e/src/server/content/list-entries-relation-filter.spec.ts:488,494,501,525,548` | 401; 404 unknown; **404 a real type the workspace was not granted**; relations pruned by grant; the recursive surface | ✅ E2E — the only place grants are tested, and it is the endpoint the entries routes do **not** match |
| F14 List envelope | `content/list-entries.spec.ts:113` | `{items,total,page,pageSize}` | ✅ E2E |
| F15 Search | `list-entries.spec.ts:126` | ILIKE across text-like columns | ⚠️ PARTIAL — no metacharacter-escaping case (EC-16) |
| F18 Sort | `list-entries.spec.ts:137` | descending via `-` | ⚠️ PARTIAL — the fallback for an unknown/non-sortable column is never asserted |
| F16/F17 Filter | `list-entries.spec.ts:150`; `list-entries-relation-filter.spec.ts:120-446` | root filter; many-to-one; many-to-many EXISTS; negation/NOT EXISTS; is-empty / is-not-empty; self-referential to two hops; OR composition; 400 unknown field; 400 past the hop budget | ✅ E2E — outstanding coverage, the best in the repo |
| F21 Workspace isolation | `list-entries.spec.ts:209,239,249,259` | no leak with another workspace's header; 400 missing header; 400 malformed header; 403 non-member | ✅ E2E |
| F16 relation scoping | `list-entries-relation-filter.spec.ts:131,152` | soft-deleted target excluded; **target in another workspace excluded** | ✅ E2E |
| F14 authz | `list-entries.spec.ts:91,97` | 401 unauthenticated; 403 without `content:read` | ✅ E2E |
| F14 bounds | `list-entries.spec.ts:169,174` | 404 unknown type; 400 over the page-size cap | ⚠️ PARTIAL — no page-beyond-end, no `page=0` |
| F8 status column | `list-entries.spec.ts:184,193` | `status` omitted on non-publishable; 400 filtering it there | ✅ E2E |
| F20 Relation preview | `content/relation-preview.spec.ts:121-291` | opt-in; named fields only; unknown names dropped; all three storage forms; page cap with true total; continuation on the per-field route; **constant query count across page sizes** | ✅ E2E — the batching assertion at `:285` is a genuinely good perf regression guard |
| F25/F28 CRUD | `content/content-entries-write.spec.ts:84,109,129,154,165` | create/read/update; incomplete draft saved but 422 on publish; edit-to-incomplete and published→draft on edit; 422 invalid non-publishable create; 404 unknown id | ✅ E2E |
| F32 Relation targets | `content-entries-write.spec.ts:194,204,224,354,536` | same-workspace target accepted; **cross-workspace 422**; non-existent 422; many-to-many cross-workspace 422; delta cross-workspace 422 | ✅ E2E |
| F36/F37 Relations | `content-entries-write.spec.ts:271-604` | m2m persisted and read back; slug resolution; whole-set replace; link/unlink deltas; append-not-override; reorder; pagination; 400 delta on a single relation; 400 malformed delta; 400 non-uuid id; inverse-side delta; combined link+unlink+order | ✅ E2E |
| F42 Soft delete | `content-entries-write.spec.ts:605,705` | link kept on soft delete, dropped on purge; the full soft-delete → trash → restore → purge cycle | ✅ E2E |
| F38-F41 Publish | `content-entries-write.spec.ts:633,648,661` | publish then unpublish; 400 non-publishable; `publishedAt` kept through an edit, cleared on unpublish | ✅ E2E |
| F43/F44 Bulk | `content-entries-write.spec.ts:756,786` | preview then publish only the valid drafts, hitting the bulk route; bulk soft delete | ⚠️ PARTIAL — no id-cap case, no empty-array case, no cross-workspace-id case |
| F25 authz | `content-entries-write.spec.ts:801,808,829` | 401 writes; 403 viewer create+delete; contributor may create but not delete | ✅ E2E |
| F34 Media | `content/content-media-fields.spec.ts:93-232` | store/read a single id; 422 non-existent; **422 cross-workspace**; 422 failing `accept`; order preserved across an update; derivative urls; `GET /:id/media` refs; **ids captured in the revision snapshot** | ✅ E2E |
| F45-F51 Revisions | `content/entry-revisions.spec.ts:62-447` | revision on create keyed to the user; incrementing, newest-first; whole document incl. m2m links; ids → titled refs; restore appends; 404 unknown number; publish promotes/supersedes/reverts; bulk publish promotes; published version stays live under a newer draft; publish a specific earlier version; publish newest in place; 404 unknown version | ✅ E2E — thorough on the happy paths |
| F46 revision numbering | — | — | ⚠️ PARTIAL — the advisory lock and unique backstop are never exercised concurrently |
| F54/F55 Ports to workspaces | `content/content-types.spec.ts:77,97`; `apps/server-e2e/src/server/workspaces/workspace-content.spec.ts:167,229` | registry served, not the mock; grants expand to real slugs; revoke 409 with entries; live entry count | ✅ E2E |
| F56-F62 Public API | `apps/server-e2e/src/server/api-tokens/public-content-api.spec.ts` (1870 lines), `public-content-writes.spec.ts` (1034 lines) | token auth, bucket resolution, grant 404s, published-only default, draft gating, sparse fieldsets, expansion pruning, and the whole write surface | ✅ E2E |
| F63 MCP | `apps/server-e2e/src/server/mcp/mcp.spec.ts` | the tool set and its surface boundary | ✅ E2E |
| F64/F66 Copilot | `apps/server-e2e/src/server/copilot/copilot-read-catalogue.spec.ts`, `copilot-proposals.spec.ts` | which tools each surface sees; the propose/apply path | ✅ E2E |
| F65 Copilot revisions | — | not named in either surface spec | ⚠️ PARTIAL |
| F67 Insights | `apps/server-e2e/src/server/insights/content-insights.spec.ts` | the six aggregates | ✅ E2E — cross-workspace scoping unasserted (EC-31) |
| F10 i18n columns | `apps/server-e2e/src/server/i18n/i18n-content.spec.ts` | exercised from the i18n plugin's suite | ⚠️ PARTIAL |
| F26 shared lock, F33 unique relations, F53 boot check, F52 unbound extension | — | — | ❌ NONE |
| F1-F7 DSL | `packages/content/server/src/lib/collection/define.spec.ts`, `registry/content-type-registry.spec.ts` | name/field assertions, relation defaults, inverse pairing | 🧪 UNIT |
| F68 OpenAPI | `docs/describe-content-api.spec.ts`, `docs/field-schema.spec.ts` | the generated description | 🧪 UNIT |
| Kernel delegation | `validation/services/entry-validation.service.spec.ts` | the service delegates to `content-domain` | 🧪 UNIT |
| Copilot pure helpers | `copilot/diff-snapshots.spec.ts`, `filter-schema.spec.ts`, `project-entry.spec.ts` | diffing, filter grammar, projection | 🧪 UNIT |
| Media accept, same-locale, relation-locale-sync, filter surface, field selection, public entry row | `media-accept.spec.ts`, `same-locale.spec.ts`, `relation-locale-sync.spec.ts`, `entry-filter-surface.spec.ts`, `field-selection.spec.ts`, `public-entry-row.spec.ts` | the pure rules | 🧪 UNIT |

**Coverage tally:** `68 features · 44 ✅ · 11 ⚠️ · 4 ❌ · 9 🧪`

## 6. 🐞 Potential Bugs

### 🐞 BUG-content-server-01 — The admin content API ignores `workspace_content` grants entirely, so a workspace can read and write content types it was never granted · Severity: Medium · 🔒

**Location:** `packages/content/server/src/lib/entries/http/controllers/resolve-type.ts:10-19`
(used by all seven entries controllers plus both revision write controllers),
and `packages/content/server/src/lib/content-types/controllers/get-content-schema.controller.ts:34-39`
**Category:** permission-bypass

**What the code does:**

```ts
export function resolveType(
    registry: ContentTypeRegistry,
    typeName: string
): AnyContentType {
    const type = registry.get(typeName);
    if (!type) {
        throw new NotFoundException(`Unknown content type "${typeName}".`);
    }
    return type;
}
```

A registry lookup and nothing else. `WorkspaceGuard` has established that the
caller is a **member** of the workspace, and `PermissionsGuard` that they hold
`content:read`/`:create`/… — but no code path consults `workspace_content`.

**Why it is wrong:** `workspace_content` is defined across the repo as an
**access-control mapping**, not a preference: `CONTENT-MAP.md:104-105`
(*"⚠️ an access-control mapping (workspace → code-defined content slug)"*),
`packages/workspaces/server/src/lib/workspace/infrastructure/schema/workspace-content.ts:19-23`
(*"this table only **links** a workspace to the slugs it may access"*). Three
sibling endpoints in this very package disagree about whether that is true:

| Endpoint | Grant-checked? |
| --- | --- |
| `GET /api/content-schema/:name/filter-fields` | **yes** — `get-filter-fields.controller.ts:64-67` |
| `GET /api/v1/content/:typeName` (public) | **yes** — `resolve-granted-type.ts:53-55` |
| `GET`/`POST`/`PATCH`/`DELETE` `/api/content/:typeName/*` (admin) | **no** |
| `GET /api/content-schema[/:name]` | **no**, and no `WorkspaceGuard` either |

The asymmetry is deliberate and documented — `resolve-granted-type.ts:39-43`
says *"Grants are enforced here even though the admin's own entries list doesn't
check them: the admin caller is a member of the workspace looking at its own
CMS."* That reasoning is defensible for **reads**; it does not survive contact
with three consequences on the **write** side:

1. **The revoke invariant is defeated from the other side.** `workspaces-server`
   refuses to revoke a grant while the type holds entries
   (`packages/workspaces/server/src/lib/workspace/domain/workspace.ts:258-265`)
   precisely so a revoke never orphans records. But after a clean revoke,
   `POST /api/content/<revoked-type>` still succeeds — recreating exactly the
   state the invariant exists to prevent.
2. **The entries become invisible but load-bearing.** The admin's Content
   Library renders its nav from `workspace.content`, so entries of an ungranted
   type appear in no list a user can reach. Yet
   `EntryCounterService.countWorkspaceEntries` sums over `registry.all()`
   (`entries/infrastructure/persistence/entry-counter.service.ts:43-50`),
   **ignoring grants**, so those invisible rows make
   `DELETE /api/workspaces/:id` return `409 Workspace still has content entries`
   forever, with no UI anywhere that can find or delete them.
3. **The schema route leaks the full content model.**
   `GET /api/content-schema/:name` returns every field, validation rule and
   relation target of any type to any member of any workspace — while its own
   sibling `/filter-fields` 404s the same request. Both are `content:read`.

**Repro:**
1. As an admin of workspace `WS`, revoke the `test_article` grant while it is
   empty → `200`.
2. `POST /api/content/test_article` with `X-Workspace-Id: WS` →
   **`201`**. Expected: `404`, matching the public API.
3. `GET /api/workspaces/WS/entry-count` → `{"count":1}`.
4. `DELETE /api/workspaces/WS` → `409 Workspace still has content entries`.
5. Open the admin: `test_article` appears in no nav, no list, and no settings
   screen. The workspace is now undeletable with no in-product path to fix it.
6. Separately: `GET /api/content-schema/test_article` (still ungranted) →
   `200` with the full schema, while
   `GET /api/content-schema/test_article/filter-fields` → `404`.

**Blast radius:** any workspace member holding content permissions — no
cross-tenant reach, since every query still ANDs `workspace_id`. The impact is
(a) an access-control mapping that does not control access on the surface most
people use, (b) a workspace that can be wedged into an undeletable state, and
(c) full content-model disclosure to every member of every workspace.

**Suggested fix:** route the admin entries and schema-detail controllers through
the same `resolveGrantedType` the public API uses (or a membership-aware
equivalent), and — independently of that decision — make
`countWorkspaceEntries` and the delete guard agree with whatever the read path
does, so a workspace can never be wedged by rows no UI can reach.

### 🐞 BUG-content-server-02 — Entry updates have no optimistic-concurrency check: two editors silently clobber each other · Severity: Medium

**Location:** `packages/content/server/src/lib/entries/infrastructure/persistence/entry-writer.service.ts:621-643`
**Category:** data-loss

**What the code does:**

```ts
const row = await this.db.transaction(async (tx) => {
    const [updated] = await tx
        .update(type.table)
        .set({
            ...toColumns(type, coerced),
            ...(type.publishable ? { status: ENTRY_STATUS.Draft } : {}),
            updatedAt: new Date()
        } as never)
        .where(this.liveWhere(type, id, workspaceId))
        .returning();
    if (!updated) throw this.notFound(type, id);
```

`liveWhere` is `id AND workspace_id AND deleted_at IS NULL`. There is no version
column, no `updated_at` precondition, and no `If-Match`/ETag anywhere — I
confirmed the save DTO carries no version field
(`grep -n "version\|expected\|ifMatch" entries/http/dto/save-entry.dto.ts` →
no match).

**Why it is wrong:** this is a **multi-user CMS**, and the same package invests
heavily in getting *other* contended invariants right — the revision counter
runs under `pg_advisory_xact_lock` with a unique backstop
(`revisions/infrastructure/persistence/drizzle-revision.store.ts:38-48`,
`revision-table.ts:62-65`), creates take the workspace shared lock
(`entry-writer.service.ts:372`), and unique relations are guarded twice over.
The one place a user's *work* can be destroyed has no protection at all. Two
editors on one article: A loads, B loads, A saves the introduction, B saves the
conclusion — B's `PATCH` carries A-era values for every field it did not change
(the admin sends the whole `values` bag), so A's introduction is overwritten and
**both requests return `200`**. Neither user is told.

Mitigating factor, stated fairly: the loss is **recoverable**, because each save
appends a full snapshot to the revision timeline, so A's version survives as
`#n` and can be restored. But nobody knows to look — there is no conflict
signal, so the loss is only discovered if someone notices the missing text.

**Repro:**
1. `GET /api/content/test_article/<id>` in two sessions.
2. Session A: `PATCH` with `{"values":{"title":"A's title","body":"<A's body>"}}` → `200`.
3. Session B (holding the pre-A values): `PATCH` with
   `{"values":{"title":"B's title","body":"<pre-A body>"}}` → `200`.
4. `GET` the entry.
→ Observed: B's values entirely; A's edit is gone from the live row with no
warning to either party. `GET .../revisions` shows both versions, so the
content exists but nothing surfaced the conflict.
Expected: a `409 Conflict` on step 3 (or a documented, tested last-write-wins
policy the admin surfaces as "someone else edited this").

**Blast radius:** every multi-editor installation, on the most common operation
in the product. Silent, and the larger the team the more often it fires.

**Suggested fix:** add an `updatedAt` (or `revisionNumber`) precondition to the
save DTO and AND it into `liveWhere`; a zero-row result then means "someone else
saved" → `409`, distinguishable from `404` by re-probing the id. The revision
number is already tracked per entry and is the natural version token.

### 🐞 BUG-content-server-03 — Revision routes never check `:typeName` against the revision's stored `content_type` · Severity: Low

**Location:** `packages/content/server/src/lib/revisions/http/controllers/revisions.controller.ts:51-85`,
`packages/content/server/src/lib/revisions/infrastructure/persistence/drizzle-revision.store.ts:81-90,143-151,173-190,201-211`
**Category:** correctness

**What the code does:** the list handler resolves the type only to validate that
the name exists, then **discards it**:

```ts
resolveType(this.registry, typeName);
return this.revisions.list(id, workspaceId, …);
```

and every store method scopes on `entry_id` **and** `workspace_id` only:

```ts
const scope = and(
    eq(revisions.entryId, entryId),
    eq(revisions.workspaceId, workspaceId)
);
```

even though the table has a `content_type` column that is written on every
append (`revision-table.ts:36`, `drizzle-revision.store.ts:61`) and indexed
(`revision-table.ts:72-75`).

**Why it is wrong:** the `:typeName` segment is load-bearing in every other
route in the package and decorative here. Two concrete consequences:

1. **The detail handler enriches with the wrong schema.**
   `revisions.controller.ts:84` calls `this.refs.enrich(type, detail, workspaceId)`
   with the type from the **path**, not the type the revision belongs to. Given
   `GET /api/content/test_page/<article-id>/revisions/1`, `RevisionRefsQuery`
   walks `test_page`'s relation fields against `test_article`'s snapshot. Fields
   present in one and absent in the other are silently skipped; a field name
   shared by both with different targets resolves refs from the **wrong table**.
2. **`RestoreRevisionUseCase` builds its values bag from the wrong specs**
   (`restore-revision.use-case.ts:53-63` reads `type.fields[field]`), then calls
   `writer.update(type, id, …)`. That second call is scoped to the wrong table
   so it should 404 — which is why this is Low rather than Medium — but the
   failure is incidental, not designed.

This is **not** a tenant leak: `workspace_id` is ANDed on every read, and a
caller who can reach the mismatched URL already holds `content:read` for the
workspace and could read the same revision under the correct type name. The
defect is contract correctness and a wrong-schema enrichment path.

**Repro:**
1. Create a `test_article`, note its `id` and let it accumulate revision `#1`.
2. `GET /api/content/test_page/<article-id>/revisions` → **`200`** with the
   article's timeline, under a completely unrelated type name.
3. `GET /api/content/test_page/<article-id>/revisions/1` → the article's
   snapshot, with its relations enriched against `test_page`'s field specs.
→ Expected: `404` at step 2.

**What I could not confirm:** whether step 3's mismatched enrichment throws (a
500) or silently returns wrong/empty refs — that depends on
`RevisionRefsQuery.enrich`'s handling of a snapshot key with no matching spec,
which I did not trace to the end. The 200 at step 2 is confirmed by reading the
query scope directly.

**Blast radius:** low — no data leaves the workspace and no write succeeds. It
is an API-contract hole that any client (or an agent constructing URLs) can trip
into and get a confusing answer from.

**Suggested fix:** AND `eq(revisions.contentType, type.name)` into the store's
`scope` and pass the resolved type into `list`; the composite index
`(workspace_id, content_type)` already exists to serve it.

### Checked and cleared

- **Workspace scope is in the query, not only the guard.** Verified on the read
  path: `entries.service.ts:181` puts `eq(table['workspaceId'], workspaceId)`
  into the shared `where` that **both** the `count()` and the page query use
  (`:99-110`), so the total and the rows cannot disagree. Verified on the write
  path: `liveWhere` ANDs the workspace on update
  (`entry-writer.service.ts:641`), and the same predicate backs
  `findLive`/read-relations/read-media. Verified on revisions: every one of the
  five store methods ANDs `workspace_id`.
- **Relation traversal cannot cross workspaces.** Asserted at
  `apps/server-e2e/src/server/content/list-entries-relation-filter.spec.ts:152`
  and stated as the invariant at `entries.service.ts:169-176`.
- **The filter surface is not grant-pruned, deliberately, and that is safe.**
  `entries.service.ts:160-176` explains it: the SQL surface is a **whitelist**,
  not a visibility boundary, and pruning it by grant would make the same saved
  filter change meaning between workspaces. Grant pruning is applied where it
  belongs — on the `/filter-fields` surface the picker renders
  (`get-filter-fields.controller.ts:64-70`) and in the public API's expansion
  (`public-entries.query.ts:630`). Every relation subquery is workspace-scoped
  regardless. This is a correct and well-argued design; I checked it because it
  looks like a hole and is not.
- **Sort injection.** `orderBy` resolves against a whitelist `Set` built from
  the envelope columns plus the type's **scalar** fields, and additionally
  guards `table[columnId]` being `undefined`
  (`entries.service.ts:251-273`) — a sort key can never reach `asc(undefined)`
  and never reaches SQL as a string.
- **Pagination bounds.** `page ≥ 1`, `1 ≤ pageSize ≤ 100`, `filter ≤ 4096`
  chars, `search ≤ 255`, bulk `ids ≤ 100` — all DTO-enforced
  (`list-entries-query.dto.ts:92-111`, `entries.constants.ts`).
- **Permission-by-constant.** No inline permission literal anywhere:
  `grep -rn "RequirePermissions('" packages/content/server/src` → no hits.
- **Uniform 422 with no enumeration signal.** A missing, cross-workspace, or
  disallowed relation/media target all produce the same 422 shape
  (`assertRelationTargets` / `assertMediaTargets`), asserted at
  `content-entries-write.spec.ts:204,224` and `content-media-fields.spec.ts:106,115`.
- **Audit/revision inside the transaction.** The revision append runs on `tx`
  inside the same transaction as the column update and the link writes
  (`entry-writer.service.ts:621,680-696`), so a save and its version commit
  together — the BUGBOT "audit outside the transaction" pattern does not occur.
- **Count-then-write on revision numbers.** Done correctly: advisory lock keyed
  on the entry id, plus a `(entry_id, revision_number)` unique constraint as the
  backstop. Worth citing as the reference implementation for the pattern.
- **Public-API guards.** `ApiTokenWorkspaceGuard` refuses a workspace outside
  the token bucket with a flat 403 and refuses to guess when the bucket has
  several (`api-token-workspace.guard.ts:47-67`); `DraftVisibilityGuard` gates
  `?status=draft|any` on `content:update` and deliberately steps aside for an
  unrecognised value so the DTO's 400 reports the real problem
  (`draft-visibility.guard.ts:43-52`). Both read carefully and both are e2e-covered.
- **`CONTENT_ENTRY_EXTENSION` unbound.** Behaves correctly: `@Optional()` on
  both injection sites, optional chaining on all four hooks, and a boot check
  that fails loudly rather than 500ing on the first create when an `i18n` type
  has no extension (`entry-extension-boot-check.ts:30-43`). The only rough edge
  is that `?locale=` is silently ignored rather than 400 — documented, and
  arguably right for a forward-compatible param.
- **`MEDIA_ASSET_RESOLVER` unbound.** No-ops, so media fields shape-validate and
  store. Noted as EC-66 rather than filed, because it is documented — but it is
  a security check that quietly disappears when a plugin is absent.

**Defect tally:** `3 🐞 · 0 Critical · 0 High · 2 Medium · 1 Low · 1 🔒`

**Accessibility tally:** `3 ♿ · 0 Supports · 1 Partially Supports · 2 Does Not Support · 4 Not Applicable provisions`
No axe or keyboard coverage applies. All three are 504 Authoring-Tool findings
at the API/storage level, invisible to any UI-level test.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` | `content/content-grants.spec.ts` (new file) | `GET`/`POST` `/api/content/<ungranted type>` behaves as decided (404 like the public API, or documented-and-pinned as allowed); `GET /api/content-schema/<ungranted>` matches `/filter-fields` | 🐞 BUG-content-server-01, EC-34/35/37 |
| 2 | `apps/server-e2e` | `content/content-grants.spec.ts` (new case) | Revoke a grant, create an entry of that type, then `DELETE /api/workspaces/:id` — assert the workspace is not left permanently undeletable | 🐞 BUG-content-server-01 consequence 2, EC-36 |
| 3 | `apps/server-e2e` | `content/content-concurrency.spec.ts` (new file) | Two `PATCH`es from stale reads: the second gets `409`, or the test pins last-write-wins **and** asserts the clobbered content is recoverable from the timeline | 🐞 BUG-content-server-02, EC-38 |
| 4 | `apps/server-e2e` | `content/entry-revisions.spec.ts` (new case) | `GET /api/content/<wrong type>/<id>/revisions[/:n]` returns `404` | 🐞 BUG-content-server-03, F47/F48 |
| 5 | `apps/server-e2e` | `content/entry-revisions.spec.ts` (new case) | Remove a field from a type, then restore a revision that carries it: the restore succeeds and drops the stale key rather than 422ing | ♿ A11Y-content-server-03, EC-52 |
| 6 | `apps/server-e2e` | `content/content-concurrency.spec.ts` (new case) | Ten concurrent saves of one entry produce ten distinct revision numbers, no duplicate and no 500 | F46 ⚠️, EC-39 |
| 7 | `apps/server-e2e` | `content/content-concurrency.spec.ts` (new case) | Two concurrent claims of a `unique: true` relation target: one 200, one **422** (not a 500 constraint error) | F33 ❌, EC-41 |
| 8 | `apps/server-e2e` | `content/content-entries-write.spec.ts` (new cases) | Bulk: empty `ids`, 100 ids, 101 ids (400), a non-uuid, an id from another workspace (skipped and **not** reported as succeeded) | F44 ⚠️, EC-11, EC-32 |
| 9 | `apps/server-e2e` | `content/list-entries.spec.ts` (new cases) | `page` beyond `pageCount` returns `items:[]` with the true total; `page=0` and `pageSize=0` 400; `pageSize=100` succeeds; `?sort=tags` and `?sort=nonsense` fall back to `updatedAt desc` | F18 ⚠️, EC-06, EC-07 |
| 10 | `apps/server-e2e` | `content/list-entries.spec.ts` (new case) | `?search=%` and `?search=_` are matched literally, not as ILIKE wildcards | F15 ⚠️, EC-16 |
| 11 | `apps/server-e2e` | `content/content-media-fields.spec.ts` (new case) | Once ♿-01 lands: alt text round-trips through create → read → revision restore → locale copy unchanged | ♿ A11Y-content-server-01/-03, 504.2.1 |
| 12 | `apps/server-e2e` | `content/entry-revisions.spec.ts` (new cases) | A viewer is 403 on restore and publish; a contributor's access matches the declared `content:update` / `content:publish` split | EC-22 |
| 13 | `apps/server-e2e` | `insights/content-insights.spec.ts` (new case) | Each of the six aggregates returns disjoint numbers for two workspaces seeded with different data | EC-31 |
| 14 | `apps/server-e2e` | `content/content-extension.spec.ts` (new file) | Boot with an `i18n` type and no extension **fails** with the documented message; with the extension absent and no `i18n` type, list/create/`?locale=` all behave as documented | F53 ❌, F52 ⚠️, EC-67 |
| 15 | `apps/server-e2e` | `content/relation-preview.spec.ts` (new case) | A relation target in another workspace never appears in a preview | EC-27 |
| 16 | `apps/server-e2e` | `content/content-entries-write.spec.ts` (new case) | Purging an entry that a `restrict` relation points at returns a 409-shaped refusal, not a raw FK 500 | EC-50, EC-62 |
| 17 | `apps/server-e2e` | `content/content-schema-evolution.spec.ts` (new file) | Adding a required field to a type with existing entries: reads still work, publish 422s with a clear issue list | EC-51 |

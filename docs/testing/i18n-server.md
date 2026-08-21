# @orthacms/i18n-server — Test Artifact

> **Unit:** `packages/i18n/server` · **Package:** `@orthacms/i18n-server` · **Kind:** server plugin
> **Source of truth:** `packages/i18n/server/AGENTS.md`
> **Findings verified:** 2026-08-11 — 2 confirmed · 0 deleted · 5 corrected · 0 unverified
> **Generated:** 2026-08-11

## 1. Scope & Preconditions

**Owns:** all locale *behaviour* for `i18n: true` content types — the configured
locale set and its validation, the `CONTENT_ENTRY_EXTENSION` binding (list
scoping, create-time stamping, shared-field + relation sync to siblings, the
virtual filter fields), the read-only locale panel and batched summary routes, the
localization coverage read-model, and three agent tools.

**Owns NO tables and no migrations.** The `locale` / `locale_group_id` columns live
on the **host-owned** generated content tables — content-server's table builder
adds them from the `i18n: true` flag — and the available locales live in this
plugin's **config**. There is no `drizzle.config.ts` and no `migrations/`
directory. It also does not own: what a content type is, revision numbering (that
stays on content's side, serialized by an advisory lock), publish state, or
authorization (identity's guards).

- **Entry points**
  - `GET /api/i18n/locales` — `packages/i18n/server/src/lib/locales/controllers/list-locales.controller.ts:21`
    (session only, **no `WorkspaceGuard`, no `@RequirePermissions`** — the global
    `AuthGuard` is the whole gate; locales carry no per-workspace data)
  - `GET /api/i18n/content/:typeName/:id/locales` — `.../content/controllers/get-entry-locales.controller.ts:41`
    (`content:read` + `WorkspaceGuard`)
  - `POST /api/i18n/content/:typeName/locale-summary` — `.../content/controllers/locale-summary.controller.ts:37`
    (`content:read` + `WorkspaceGuard`, **no `OriginGuard`** — it reads)
  - `GET /api/insights/i18n/coverage` — `.../insights/http/controllers/localization-coverage.controller.ts:32`
    (`content:read` + `WorkspaceGuard`)
  - DI port **bound**: `CONTENT_ENTRY_EXTENSION` ← `EntryLocaleExtensionService`
    (`.../content/services/entry-locale-extension.service.ts:102`), in a
    `global: true` module.
  - Agent tools: `i18n_locales_list` (**both surfaces**), `i18n_translations_get`
    (**copilot only**), `i18n_propose_translation` (`effect: 'propose'`) —
    `.../copilot/i18n-tool.provider.ts`, `.../copilot/translation-proposal.provider.ts`.
  - Exported: `I18nServerPlugin({ locales })`, `LocaleRegistryService`, the domain
    value objects and errors.

- **Runtime prerequisites**
  - Postgres + migrations; at least one `i18n: true` content type. The reference
    host declares three locales — `en` (default), `de`, `fr`
    (`apps/server/ortha.config.ts:147-151`).
  - Registered in `buildPlugins` **after** `ContentPlugin` (it binds content's port
    and reads `CONTENT_REGISTRY`). A boot check in content-server fails start-up if
    an `i18n: true` type has no extension bound.
  - Config is validated **eagerly at construction**: ≥1 locale, unique
    well-formed slugs (`^[a-z]{2,3}(-[a-z0-9]+)*$`, ≤35 chars), **exactly one**
    default (`LocaleSet.create`, `domain/value-objects/locale-set.ts:30`).
  - `content:read` for every route. `content:create` (via content's own route) to
    create a sibling translation.

- **How to exercise it manually**
  ```bash
  docker compose up -d && npx nx run server:db:migrate && npm run dev
  curl -b j localhost:3000/api/i18n/locales
  curl -b j -H "X-Workspace-Id: $WS" \
    "localhost:3000/api/content/article?locale=de"
  curl -b j -H "X-Workspace-Id: $WS" \
    "localhost:3000/api/i18n/content/article/$ID/locales"
  curl -b j -H "X-Workspace-Id: $WS" -H 'content-type: application/json' \
    -X POST localhost:3000/api/i18n/content/article/locale-summary \
    -d '{"groupIds":["'$GID'"]}'
  curl -b j -H "X-Workspace-Id: $WS" localhost:3000/api/insights/i18n/coverage
  ```
  Creating a sibling is content-server's route, not one of this plugin's:
  `POST /api/content/article` with `{ values, locale: "de", localeGroupId: "<gid>" }`.

- **Dependencies that must be healthy:** `@orthacms/content-server` (the port,
  `toColumns`/`toRecord`, `EntryValidationService`, `RelationLinkService`,
  `relationLocaleSync`, `CONTENT_REGISTRY`, `WorkspaceGrantsQuery`),
  `@orthacms/identity-server` (guards, `lockWorkspaceShared`),
  `@orthacms/workspaces-server` (`WorkspaceGuard`), `@orthacms/database`,
  `@orthacms/utils-server` (`isUniqueViolation`, the filter engine).

## 2. Feature Inventory

| # | Feature | Where it lives | Coverage |
| --- | --- | --- | --- |
| F1 | Eager config validation (≥1, unique, well-formed, exactly one default) | `packages/i18n/server/src/lib/domain/value-objects/locale-set.ts:30-52`, `.../value-objects/locale.ts:33-48` | 🧪 UNIT |
| F2 | `GET /api/i18n/locales` — the configured set in display order | `.../locales/controllers/list-locales.controller.ts:21` | ✅ E2E |
| F3 | `listScope` — strict `locale = X`, defaulting when absent | `.../content/services/entry-locale-extension.service.ts:115-132` | ✅ E2E |
| F4 | `listScope` — `?localeFallback=default` widens to the default row | `.../entry-locale-extension.service.ts:133-151` | ✅ E2E |
| F5 | Unknown `?locale=` → 400 | `.../locales/services/locale-registry.service.ts:56-65` | ✅ E2E |
| F6 | `createColumns` — stamps the validated locale | `.../entry-locale-extension.service.ts:163-181` | ✅ E2E |
| F7 | `createColumns` — joining a group by `localeGroupId`, unknown group → 404 | `.../entry-locale-extension.service.ts:189-211` | ✅ E2E |
| F8 | Fresh create gets its own group (column default `gen_random_uuid()`) | content-server's table builder | ✅ E2E |
| F9 | Duplicate `(group, locale)` → 409 via the unique index | content-server's `uniqueGuarded` | ✅ E2E |
| F10 | **Shared-field sync** — non-`localized` columns fan out to siblings, in-tx | `.../entry-locale-extension.service.ts:254-436` | ✅ E2E |
| F11 | A rewritten **published** sibling is demoted to `draft`, keeping `published_at` | `.../entry-locale-extension.service.ts:398-407` | ✅ E2E |
| F12 | A rewritten published sibling is **re-validated**; failure → 422 + rollback | `.../entry-locale-extension.service.ts:416-432` | ✅ E2E |
| F13 | An unchanged sibling is left completely untouched (`IS DISTINCT FROM`) | `.../entry-locale-extension.service.ts:363-386` | ✅ E2E |
| F14 | Rewritten siblings are returned so content appends a revision for each | `.../entry-locale-extension.service.ts:433-435` | ✅ E2E |
| F15 | Relation sync — shared links verbatim, mirrored mapped per locale | `.../entry-locale-extension.service.ts:590-633` | ✅ E2E |
| F16 | A mirrored link with no translation in a locale is **unset**, never a failure | `.../entry-locale-extension.service.ts:537-577` | ✅ E2E |
| F17 | A **create** inherits relations inward from a donor sibling | `.../entry-locale-extension.service.ts:460-525` | ✅ E2E |
| F18 | Virtual filters `hasLocale` / `missingLocale` / `localeCount` | `.../entry-locale-extension.service.ts:636-715` | ✅ E2E |
| F19 | Unsupported operator on a virtual field → 400 | `.../entry-locale-extension.service.ts:660-665` | ❌ NONE |
| F20 | Every method no-ops for a non-i18n type | `.../entry-locale-extension.service.ts:120, 168, 222, 637` | ✅ E2E |
| F21 | `GET …/:id/locales` — one item per **configured** locale, present or null | `.../content/services/locale-group.service.ts:74-130` | ✅ E2E |
| F22 | `POST …/locale-summary` — batched per-group members, capped at 100 | `.../locale-group.service.ts:137-183` | ✅ E2E |
| F23 | A non-localized `:typeName` on either route → 400; unknown → 404 | `.../content/controllers/resolve-type.ts:13-27` | ✅ E2E |
| F24 | Coverage: per-locale translated/missing, workspace-wide | `.../insights/infrastructure/queries/localization-coverage.query.ts:57-127` | ✅ E2E |
| F25 | Coverage: the unit is a **record** (`locale_group_id`), never a row | `.../localization-coverage.query.ts:138-157` | ✅ E2E |
| F26 | Coverage: rows in an **unconfigured** locale are filtered out | `.../localization-coverage.query.ts:218-229` | ❌ NONE |
| F27 | Coverage: `notLocalized` forced to `0` with a single configured locale | `.../localization-coverage.query.ts:98, 123` | ❌ NONE |
| F28 | Coverage: per-type rows partition the workspace figures | `.../localization-coverage.query.ts:93-101` | ✅ E2E |
| F29 | Coverage: a never-used type is omitted, not listed at zero | `.../localization-coverage.query.ts:92` | ✅ E2E |
| F30 | Tool `i18n_locales_list` — shared with MCP | `.../copilot/i18n-tool.provider.ts` | ⚠️ PARTIAL |
| F31 | Tool `i18n_translations_get` — copilot-only (it reports draft siblings) | `.../copilot/i18n-tool.provider.ts` | ⚠️ PARTIAL |
| F32 | Tool `i18n_propose_translation` + its applier (seeds shared values) | `.../copilot/translation-proposal.{provider,applier}.ts` | ⚠️ PARTIAL |

## 3. Manual Test Plan

Seed for every block: a localized, publishable, paranoid collection (`article`)
with `title` **localized** and `slug`/`category` **shared**; locales `en` (default),
`de`, `fr`; a workspace `$WS`.

### F1 — Config validation

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `I18nServerPlugin({ locales: [] })` | throws `InvalidLocaleSetError` "A locale set requires at least one locale." **at construction** |
| 2 | Two locales both `isDefault: true` | "Exactly one locale must set isDefault (got 2)." |
| 3 | No locale with `isDefault` | "(got 0)." |
| 4 | Duplicate slug `en` twice | `Duplicate locale slug "en".` |
| 5 | `slug: 'EN'` / `'e'` / `'english'` / `'en_GB'` | `InvalidLocaleError` — the regex is `^[a-z]{2,3}(-[a-z0-9]+)*$` |
| 6 | `slug: 'pt-br'`, `'zh-hans'`, `'en-us-x-foo'` | accepted |
| 7 | A 36-character slug | rejected (`LOCALE_SLUG_MAX_LENGTH = 35`) |
| 8 | `name: '   '` | `Locale "xx" has an empty name.` |
| 9 | Boot the server with any of the above | **the process fails before serving a request** |

### F2 — `GET /api/i18n/locales`

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `curl -b j localhost:3000/api/i18n/locales` | `200`, `{ items: [ {slug:'en',name:'English',isDefault:true}, {slug:'de',…,isDefault:false}, {slug:'fr',…} ] }` in **config order** |
| 2 | Omit `X-Workspace-Id` | still `200` — no `WorkspaceGuard` |
| 3 | As a `viewer` | `200` — no `@RequirePermissions` on this route |
| 4 | With no session | `401` from the global `AuthGuard` |

### F3–F5 — List scoping

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Seed one record with `en` + `de` rows, and one `en`-only | — |
| 2 | `GET /api/content/article` (no `?locale=`) | both `en` rows; **no** `de` row (default scoping) |
| 3 | `GET /api/content/article?locale=de` | the single `de` row — the `en`-only record is **hidden** (strict) |
| 4 | `GET /api/content/article?locale=de&localeFallback=default` | two rows: the `de` row, plus the `en` row of the group that has no `de` (the relation picker's mode) |
| 5 | `GET /api/content/article?locale=en&localeFallback=default` | identical to step 2 — nothing to widen to |
| 6 | `GET /api/content/article?locale=zz` | `400` `Unknown locale "zz"` |
| 7 | `GET /api/content/article?locale=` (empty) | `400` — an empty string is not `undefined`, so it is looked up and misses |
| 8 | `GET /api/content/comment?locale=de` (a non-i18n type) | `200`, the parameter is ignored (`listScope` returns `undefined`) |

**Keyboard-only / screen reader:** Not Applicable — JSON API.

### F6–F9 — Create and grouping

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `POST /api/content/article` `{"values":{…}}` | `201`; the row has `locale: "en"` and a **fresh** `localeGroupId` |
| 2 | `POST` with `{"values":{…},"locale":"de"}` | `locale: "de"`, still a fresh group |
| 3 | `POST` with `{"values":{…},"locale":"de","localeGroupId":"<gid>"}` | `201`; the row joins that group |
| 4 | Repeat step 3 with the same `(gid, de)` | `409` — the `(locale_group_id, locale)` unique index is the arbiter |
| 5 | `POST` with a `localeGroupId` that names no group in this workspace | `404` `No translation group "…" on "article".` |
| 6 | `POST` with a `localeGroupId` belonging to **another workspace** | `404` — `assertGroupExists` is workspace-scoped |
| 7 | `POST` with `{"locale":"zz","localeGroupId":"<gid>"}` | `400` before the group is even checked (`resolve` runs first) |

### F10–F14 — Shared-field sync

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Create `en`, then `de` and `fr` siblings | three rows, one group |
| 2 | `PATCH` the `en` row changing `title` (**localized**) only | the `de`/`fr` rows are untouched — no `updatedAt` change, no new revision |
| 3 | `PATCH` the `en` row changing `slug` (**shared**) | `de` and `fr` both get the new `slug`, a new `updatedAt`, **and one revision each** |
| 4 | Re-send the same `slug` unchanged | siblings untouched (`IS DISTINCT FROM` finds nothing) |
| 5 | Publish `de`, then `PATCH` `en`'s `slug` | the `de` row moves to `status: draft` with `published_at` **kept** → the admin reads it as **Modified** |
| 6 | Make the shared change one that invalidates a **published** sibling (e.g. blank a required shared field) | `422 "Shared fields would invalidate the published \"de\" translation"` with `issues`, and the **whole save rolls back** — the `en` row is unchanged too |
| 7 | Do the same when every sibling is a draft | it succeeds; drafts may be temporarily invalid |
| 8 | `PATCH` a shared **jsonb array** field (multiselect/json/multiple-media) | it syncs; no `operator does not exist: jsonb = record` error (`sql.param` binds with the column's own encoder) |
| 9 | Check the revision timeline of a rewritten sibling | one new version describing the synced values |

### F15–F17 — Relation sync

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Link the `en` article to a **non-i18n** `author` | every sibling holds the same author id (`shared`) |
| 2 | Link it to an **i18n** `tag` | each sibling holds that tag's row **in its own locale** (`mirrored`) |
| 3 | Do the same where the tag has no `fr` translation | the `fr` sibling's link is **unset**, and the save still succeeds |
| 4 | Unlink a shared many-relation on `en` | the unlink travels to every sibling |
| 5 | Change only the links (no columns) | each sibling is still written — it earns its revision and its draft demotion |
| 6 | Create a new `fr` sibling into a group that already has links | the new row inherits them from the donor (the `en` row, deterministically) |
| 7 | Create the sibling sending **no** relations | it is not treated as "the group has no links" — inward inheritance runs instead |
| 8 | Mark a relation `syncAcrossLocales: false` | it stays independent per locale |

### F18–F19 — Virtual filters

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `?filter={"and":[{"field":"hasLocale","op":"eq","value":"de"}]}` | only records whose group holds a `de` row |
| 2 | `missingLocale eq fr` | only records with no `fr` row |
| 3 | `localeCount gte 2` | records translated at least once |
| 4 | `localeCount eq 1` | untranslated records |
| 5 | `hasLocale in ["de","fr"]` | records with a `de` **or** an `fr` row |
| 6 | `missingLocale in ["de","fr"]` | records missing **both** (a `notExists` over the union) — read the semantics carefully |
| 7 | `hasLocale gt "de"` | `400 Operator "gt" is not supported on "hasLocale".` |
| 8 | `hasLocale eq "zz"` | `400` from the filter engine's enum check (`enumValues` = the configured slugs) |
| 9 | `localeCount eq 2` on a paranoid type with a soft-deleted sibling | the deleted row is **excluded** (`isNull(deletedAt)` in `groupScope`) |

### F21–F23 — The panel and the batch

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/i18n/content/article/<en id>/locales` | `{ localeGroupId, items: [ {locale:'en',isDefault:true,entry:{id,status,publishedAt,updatedAt}}, {locale:'de',…}, {locale:'fr',isDefault:false,entry:null} ] }` — **one item per configured locale**, `null` where missing |
| 2 | Same on a **non-publishable** type | `entry` carries `id` + `updatedAt` only; no `status`/`publishedAt` |
| 3 | Same with an id from another workspace | `404` |
| 4 | Same with a soft-deleted entry | `404` |
| 5 | Same with `:typeName` = a non-i18n type | `400 Content type "comment" is not localized.` |
| 6 | Same with an unknown `:typeName` | `404` |
| 7 | `POST …/locale-summary` `{"groupIds":["g1","g2"]}` | `{ groups: { g1: [...], g2: [...] } }`, members in **config order** |
| 8 | Include a group id from another workspace | its key is present with `[]` — indistinguishable from unknown |
| 9 | `{"groupIds":[]}` | `200`, `{ groups: {} }` |
| 10 | 101 group ids | `400` — `@ArrayMaxSize(100)` |
| 11 | `{"groupIds":["not-a-uuid"]}` | `400` — `@IsUUID(undefined, { each: true })` |
| 12 | Send it with a hostile `Origin` | `200` — this POST is a read and carries no `OriginGuard` by design |

### F24–F29 — Coverage

**Seed:** 4 records — A in `en`/`de`/`fr`, B in `en`/`de`, C in `en` only, D in
`de` only. Plus one `page` (localized single) never used.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `GET /api/insights/i18n/coverage` | `records: 4` (groups, **not** the 8 rows) |
| 2 | Read `localized` | `1` (only A is in all three) |
| 3 | Read `notLocalized` | `2` (C and D are each in exactly one) |
| 4 | Read `requiresLocalization` | `3` (`records - localized`) — note it **overlaps** `notLocalized` by design |
| 5 | Read `locales` | `en: translated 3 / missing 1`; `de: 3 / 1`; `fr: 1 / 3` |
| 6 | Read `types` | one row for `article` with `records: 4`; `page` is **omitted** |
| 7 | Sum the per-type figures | they equal the envelope's |
| 8 | Empty workspace | `records: 0`, every figure `0`, `locales` still lists all three at `0/0`, `types: []` — **no NaN, no division anywhere** (the server returns counts only) |
| 9 | Soft-delete A's `fr` row and re-read | A drops to `localized: 0`; the deleted row is excluded |
| 10 | Reconfigure to a single locale and restart | `notLocalized` is forced to `0` |
| 11 | Add a fourth locale `es` after the data exists | every record's `localized` drops; `es` reports `translated: 0 / missing: 4` — **no backfill, and none is claimed** |
| 12 | Insert a row in an unconfigured slug `it` by hand | it is filtered out; a group made **only** of such rows disappears from `records` |
| 13 | Call it as a non-member / with no header / with no session | `403` / `400` / `401` |

### F30–F32 — Agent tools

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | `MCP_ENABLED=true`, `tools/list` with a `read` token | `i18n_locales_list` present; `i18n_translations_get` **absent**; `i18n_propose_translation` **absent** |
| 2 | Copilot catalogue for an admin | all three present |
| 3 | `i18n_translations_get` on a group with a draft `de` sibling | it reports the sibling **and its status** — the reason it is copilot-only |
| 4 | Either tool with a `typeName` the workspace was **not granted** | the same message as "does not exist" |
| 5 | Either tool on a non-localized type | an explicit error, not `[]` |
| 6 | `i18n_propose_translation` into a locale the group already has | a `409`-shaped tool error |
| 7 | `i18n_propose_translation` naming a **shared** field | refused |
| 8 | Accept a translation proposal on a type with a required shared field (`tag.slug`) | the applier seeds the create from the source row's shared values, so the create validates and **no sibling is blanked** |

## 4. Edge Cases & Negative Paths

### Locale resolution

- **EC-01 — `?locale=` absent.** `✅ E2E` Defaults to the configured default
  (`LocalePolicy.resolve`, `domain/locale-policy.ts:20-25`).
- **EC-02 — `?locale=zz`.** `✅ E2E` `400`, uniform message.
- **EC-03 — `?locale=` present but empty.** `❌ NONE` `''` is not `undefined`, so it
  is looked up, misses, and `400`s. Arguably right; undocumented.
- **EC-04 — `?locale=EN` (wrong case).** `❌ NONE` `400` — the registry is
  case-sensitive and slugs are lowercase by the regex. No normalisation anywhere,
  so a client sending a canonical BCP-47 `en-GB` gets a `400` for a locale
  configured as `en-gb`.
- **EC-05 — `?locale=en&locale=de` (repeated).** `❌ NONE` Express yields an array;
  `resolve` receives it, `bySlug.get(['en','de'])` misses → `400`. Acceptable.
- **EC-06 — A 10 kB `?locale=` value.** `❌ NONE` One map miss, `400`. The message
  echoes the slug (`UnknownLocaleError`), so a very long value is reflected in the
  response body — no injection risk (JSON-encoded), but noted.
- **EC-07 — `?localeFallback=` anything but `default`.** `❌ NONE` Silently ignored;
  strict mode. A typo (`?localeFallback=defualt`) therefore changes the result set
  with no error.

### Row-per-locale scoping — the duplicate-rows class

- **EC-08 — Every read path applies the locale scope.** `✅ E2E`
  Verified by reading each: the list goes through `listScope`
  (`entry-locale-extension.service.ts:115`); the public API AND-s it into
  `readableWhere`; `entryLocales` and `summaries` are **deliberately** unscoped by
  locale because they *are* the group view (`locale-group.service.ts:74, 433`).
  There is no list path that forgets the filter and returns one row per locale.
  **Checked and cleared** — this is the bug the brief flags as common, and it is not
  present.
- **EC-09 — Coverage counts rows instead of records.** `✅ E2E`
  `count(distinct locale_group_id)` throughout (`localization-coverage.query.ts:152`),
  pinned by `localization-insights.spec.ts:135` ("counts records, not rows").
  Cleared.
- **EC-10 — A single (`page`) type with i18n.** `✅ E2E` Still one row per locale;
  the list envelope stays honest. Cleared.

### Group integrity

- **EC-11 — A group spanning two workspaces.** `❌ NONE`
  Not constructible through the API: `assertGroupExists` requires a live row in
  **this** workspace, and every sibling read AND-s `workspaceId`
  (`entry-locale-extension.service.ts:200-203, 305, 475`). If one existed (a bad
  import), the sync would silently only ever touch the same-workspace half — which
  is the safe failure. Cleared as unreachable.
- **EC-12 — An orphaned group (every row soft-deleted).** `❌ NONE`
  `assertGroupExists` filters `deletedAt IS NULL` on a paranoid type, so a new
  sibling cannot join a fully-trashed group → `404`. But `propagateToSiblings`
  **deliberately includes** soft-deleted siblings (no `deletedAt` filter at
  `:298-308`) so a restore comes back consistent. The two rules are deliberately
  asymmetric and the comment says so. Cleared.
- **EC-13 — Delete one locale of a group vs the whole group.** `❌ NONE`
  Content's delete is per **row**; there is no group-delete anywhere. Soft-deleting
  the `de` row leaves the group intact and the panel reports `de: null`. Hard
  deleting the **default-locale** row leaves a group with no default — nothing
  forbids it, and `inheritRelationsFromGroup` then falls back to the
  alphabetically-first donor (`:482-486`). Consistent, if unstated.
- **EC-14 — Adding a new locale after entries exist.** `❌ NONE`
  No backfill: existing groups simply gain a missing slot. Coverage reports it
  correctly (`translated: 0`), the panel shows `entry: null`, and `hasLocale`
  filters work. **The silent gap is in the opposite direction** — see EC-15.
- **EC-15 — Removing a locale from the config while rows exist.** `❌ NONE`
  The rows stay in the database and are **invisible everywhere**: `listScope` can
  never name the slug (`resolve` 400s it), the panel iterates configured locales
  only, and coverage filters them out (`configuredScope`, `:226`). `LocaleSet.remove`
  guards against removing the *default* but is never called by the plugin — the
  config is a literal array. So a host can drop `de` from `ortha.config.ts` and
  silently orphan every German row. → `🐞 BUG-i18n-server-03`.
- **EC-16 — Two rows in the same `(group, locale)`.** `❌ NONE`
  Prevented by the unique index — **partial** (`WHERE deleted_at IS NULL`) on a
  paranoid type, so a trashed row plus a live row in one locale is legal. Every
  consumer either filters deleted rows or uses `count(distinct locale)`, so nothing
  double-counts. Cleared.

### Shared-field sync — concurrency and partiality

- **EC-17 — Two concurrent saves on two locales of one group.** `❌ NONE`
  Each transaction updates its own row first (content's `entry-writer.service.ts:623`,
  taking that row's lock), then `propagateToSiblings` takes `FOR UPDATE` on the
  others in **unordered** result order (`:298-308`). A ↔ B is a textbook lock-order
  inversion → Postgres deadlock. → `🐞 BUG-i18n-server-01`.
- **EC-18 — Can the sync partially apply?** `❌ NONE`
  No — everything runs on `tx`, and a re-validation failure throws
  `UnprocessableEntityException` inside it, rolling the whole save back. Cleared;
  pinned by `i18n-content.spec.ts:520`.
- **EC-19 — Can one save clobber a concurrent edit on another locale?** `❌ NONE`
  The `FOR UPDATE` serializes them, and the loser re-reads. Cleared (modulo EC-17's
  deadlock, which aborts rather than clobbers — the safe failure).
- **EC-20 — A shared field the caller did not send.** `❌ NONE`
  Filtered out of `shared` (`:267-269`), so it is not in `.set()` and not in the
  change predicate. Cleared — this is the fix for "comparing against a missing bind
  parameter".
- **EC-21 — A save with no shared field and no syncing relation.** `❌ NONE`
  Returns before touching the database (`:289`), so no locks are taken. Cleared —
  and load-bearing: without it every save of a localized type would lock its whole
  group.
- **EC-22 — A group of 20 locales.** `❌ NONE`
  The sibling loop issues one `UPDATE … RETURNING` per sibling plus one
  `replaceLinks` per syncing relation per sibling, all inside one transaction, and
  content then appends 19 revisions each taking a per-entry advisory lock. Linear,
  but the transaction is long and holds `FOR UPDATE` on the whole group throughout.
  Not a bug at three locales; worth knowing.
- **EC-23 — A shared field on a type with **no** other members.** `❌ NONE`
  `if (!siblings.length) return []` (`:309`). Cleared.
- **EC-24 — `linksMoved` with zero columns.** `❌ NONE`
  `differs` would collapse to `undefined` and widen the UPDATE to every sibling —
  guarded at `:361` and `:384`. Cleared; the comment names the exact hazard.

### Virtual filters

- **EC-25 — `localeCount` counts rows in **unconfigured** locales.** `❌ NONE`
  `groupScope` (`:670-674`) filters workspace and soft-delete but **not** the
  configured set, while the coverage query does filter it (`configuredScope`).
  So `localeCount eq 3` and the coverage card can disagree about the same record
  after a locale is removed from config. → `🐞 BUG-i18n-server-04`.
- **EC-26 — `hasLocale ne "de"`.** `❌ NONE`
  Renders `EXISTS(sibling WHERE locale <> 'de')` — "the group has some locale other
  than de", **not** "the group lacks de". `missingLocale` is the operator for that.
  Both are permitted (`LOCALE_FIELD_OPS`), neither is documented, and the admin's
  filter UI offers `ne` on `hasLocale`. Confusing; folded into
  `🐞 BUG-i18n-server-04`.
- **EC-27 — `missingLocale in [...]`.** `❌ NONE` `notExists` over the union → "missing
  **all** of these". A reader would expect "missing any". Same finding.
- **EC-28 — `localeCount lt 0` / a non-number.** `❌ NONE`
  The filter engine coerces by `ScalarFieldType.Number`; a non-number is a `400`
  there. `lt 0` renders and matches nothing. Fine.
- **EC-29 — An unsupported operator.** `❌ NONE` `400` with the field named
  (`:661-665`). Correct, untested.

### Coverage arithmetic at the boundaries

- **EC-30 — Zero entries.** `❌ NONE`
  `records: 0`; `missing: 0 - 0 = 0`; `requiresLocalization: 0 - 0 = 0`. **There is
  no division on the server** — every field is a count, and percentages are the
  admin widget's job (`share()` there guards `total > 0`). So no NaN and no
  divide-by-zero is reachable here. **Checked and cleared**, which is the honest
  answer to the brief's boundary question: the risk lives in `i18n-admin`, not here.
- **EC-31 — 0% (nothing translated).** `✅ E2E` Every locale but the default reports
  `translated: 0`. Pinned by `localization-insights.spec.ts:110`.
- **EC-32 — 100%.** `✅ E2E` `localized === records`, `requiresLocalization: 0`.
- **EC-33 — Is it workspace-scoped?** `✅ E2E`
  `configuredScope` AND-s `workspaceId` on every per-type query
  (`localization-coverage.query.ts:225`), and
  `localization-insights.spec.ts:313` pins "counts only the workspace named by the
  header". Cleared.
- **EC-34 — Does it respect the workspace's **content grants**?** `❌ NONE`
  It does **not**: `this.registry.all().filter(type => type.i18n)`
  (`:60`) walks every registered localized type. But neither does content-server's
  own session-side entries list — grants are enforced on the **public/token** API
  and on `/content-schema/:name/filter-fields`, not on the session routes
  (verified by grepping `WorkspaceGrantsQuery` usage). So this is **consistent with
  its siblings**, not a leak specific to i18n. Recorded, not filed.
- **EC-35 — `missing` can exceed a type's own records.** `❌ NONE`
  `locales[].missing = records - covered` uses the **workspace-wide** `records`
  while `covered` sums per type — both are workspace-wide sums, so they match.
  Cleared by reading `:85, 106-113`.

### Permissions and tenancy

- **EC-36 — `GET /api/i18n/locales` has no permission decorator.** `❌ NONE`
  Any authenticated user, in any role, with no workspace, learns the deployment's
  configured locale set. Deliberate ("locales carry no per-workspace data") and
  low-value information. Recorded, not filed.
- **EC-37 — `viewer` on the panel / summary / coverage.** `❌ NONE`
  All three require `content:read`, which a viewer holds → `200`. Untested for the
  panel and the summary.
- **EC-38 — Non-member of `$WS`.** `⚠️ PARTIAL` `403` from `WorkspaceGuard`; pinned
  for coverage (`localization-insights.spec.ts:350`), untested for the other two.
- **EC-39 — Same entry id, different workspace, on the panel.** `❌ NONE`
  `liveWhere` AND-s `workspaceId` → `404`, the right shape (no 403 enumeration
  signal). Untested.
- **EC-40 — Group ids from another workspace in a summary batch.** `❌ NONE`
  Returned as empty arrays — **the request's own keys are echoed back**, so a caller
  learns nothing they did not supply. Cleared.

### 4A. Accessibility & Section 508 Conformance

`i18n-server` renders no UI, so WCAG applies to it only through the data it makes
expressible. That turns out to matter a great deal: **localization is an
accessibility requirement**, and two success criteria are decided at this layer,
not in the admin.

**Baseline:** ❌ — no a11y suite, and none is applicable to a JSON API. The
findings below are schema/model-level.

#### ♿ A11Y-i18n-server-01 — A configured locale cannot express text direction, so an RTL locale is unrepresentable
**WCAG:** 1.3.2 Meaningful Sequence (A), 1.4.10 Reflow (AA) · **508:** 504.2, E205.4 · **Verdict: Does Not Support**
**Location:** `packages/i18n/server/src/lib/domain/value-objects/locale.ts:5-12` (`LocaleInput = { slug, name, isDefault? }`), `packages/i18n/server/src/lib/types/locale.ts` (`LocaleDef`), `packages/i18n/server/src/lib/locales/controllers/list-locales.controller.ts:23-31`
A locale is three fields: `slug`, `name`, `isDefault`. There is no `dir`, no
`direction`, and no way to derive one — the slug regex `^[a-z]{2,3}(-[a-z0-9]+)*$`
happily accepts `ar` and `he`, so an RTL locale can be *configured*, and nothing
anywhere records that it is RTL. `GET /api/i18n/locales` is the admin's single
source for the switcher, the title chip and the widget, so no consumer can set
`dir="rtl"` on anything — and `grep -rn "dir=\|rtl" packages/i18n packages/wysiwyg
packages/media apps/admin/src` returns **no matches** across all three of my UI
units.
**Repro:** add `{ slug: 'ar', name: 'العربية' }` to `apps/server/ortha.config.ts`,
restart, and create an Arabic entry. → The record lists and the entry editor render
Arabic content in an LTR layout; the rich-text editor's `dir` is inherited from
`<html lang="en">` (`apps/admin/index.html:2`, hardcoded and never updated); the
stored `richtext` HTML carries no `dir`, so the **published** page inherits whatever
the consuming site sets.
**Keyboard / SR experience:** reading order, cursor movement, and the visual order
of punctuation are all wrong for an RTL author working in the CMS, and the
published content carries no direction information for a consumer to honour.
**Remediation:** add an optional `dir?: 'ltr' | 'rtl'` to `LocaleInput` /
`LocaleDef` (defaulting from the slug's language subtag), validate it in `Locale`,
and return it from `GET /api/i18n/locales` so `i18n-admin` can set `dir` on the
editor surface and the previews.

#### ♿ A11Y-i18n-server-02 — A locale slug is never propagated as a `lang` value onto rendered content
**WCAG:** 3.1.1 Language of Page (A), 3.1.2 Language of Parts (AA) · **508:** 504.2, E205.4 · **Verdict: Does Not Support**
**Location:** `packages/i18n/server/src/lib/content/services/locale-group.service.ts:104-129` (the panel's wire shape), `packages/i18n/server/src/lib/insights/types/i18n-insights-view.ts` — and by omission, everything the plugin returns
The plugin's slugs (`en`, `de`, `pt-br`) are already BCP-47-shaped, so they *could*
be `lang` values directly. Nothing does it: no response carries a `lang` field, the
`richtext` HTML stored per locale carries no `lang` attribute, and there is no hook
for the admin or a consuming site to learn a row's language other than by reading
the `locale` column and knowing what it means.
**Repro:** create a German article, open it in the admin, and inspect the DOM.
→ The body renders inside `<html lang="en">` with no `lang` override anywhere on
the field, the preview, or the editor surface. A screen reader announces German
text with English pronunciation rules.
**Keyboard / SR experience:** wrong voice and wrong pronunciation for every
non-default locale, in the CMS and (unless the consuming site does the work
itself) on the published page.
**Remediation:** state in the wire contract that `locale` **is** the BCP-47 language
tag, expose it on the entry payloads the editor already reads, and have
`i18n-admin` set `lang` on the entry editor's field region and on
`WysiwygPreview` — see `♿ A11Y-i18n-admin-01` and `♿ A11Y-wysiwyg-admin-07`, which
are the two halves that consume it.

#### ♿ A11Y-i18n-server-03 — Coverage figures are counts, not percentages, which is the accessible choice
**WCAG:** 1.4.1 Use of Colour (A) (indirect) · **508:** E205.4 · **Verdict: Supports**
**Location:** `packages/i18n/server/src/lib/insights/types/i18n-insights-view.ts:11-85`
Every figure the coverage endpoint returns is an integer with a named meaning
(`translated`, `missing`, `records`, `localized`, `notLocalized`,
`requiresLocalization`), and each carries documentation explaining that the three
headline numbers **overlap** rather than partition. Because the server hands the
widget numbers rather than a rendered proportion, the admin is free to state them
as text beside the bars — which is exactly what 1.4.1 requires of a chart. Recorded
as a positive: the boundary is drawn in the right place, and the remaining risk is
purely in the widget (`♿ A11Y-i18n-admin-04`).

## 5. E2E Coverage Map

| Feature | Spec | Asserts | Verdict |
| --- | --- | --- | --- |
| F1 config validation | `packages/i18n/server/src/lib/utils/i18n-plugin.spec.ts`, `.../domain/value-objects/locale.spec.ts`, `locale-set.spec.ts`, `.../domain/locale-policy.spec.ts` | slug format, blank name, non-empty set, exactly-one-default, remove guards, fallback chain | 🧪 UNIT |
| F2 locales endpoint | `apps/server-e2e/src/server/i18n/i18n-content.spec.ts:109` | the configured set with exactly one default | ⚠️ PARTIAL — no unauthenticated/viewer case |
| F3 strict scoping | `i18n-content.spec.ts:154`, `:170` | default when no `?locale=`; only the requested locale otherwise | ✅ E2E |
| F4 default fallback | `i18n-content.spec.ts:187` | falls back to the default row where the requested locale is missing | ✅ E2E |
| F5 unknown locale | `i18n-content.spec.ts:137`, `:182`, `:225` | 400 on create, on list, and on a sibling create | ✅ E2E |
| F6 create stamping | `i18n-content.spec.ts:124`, `:131` | defaults to `en`; stamps an explicit locale | ✅ E2E |
| F7 join a group / unknown group | `i18n-content.spec.ts:205`, `:231` | sibling shares the group; a bad `localeGroupId` is 404 | ✅ E2E |
| F8 fresh group | `i18n-content.spec.ts:145` | a plain create gets its own group | ✅ E2E |
| F9 duplicate locale | `i18n-content.spec.ts:218` | 409 | ✅ E2E |
| F10 shared sync | `i18n-content.spec.ts:245`, `:276`, `:319` | shared travels, localized does not; a jsonb array syncs; an unchanged resend is a no-op | ✅ E2E |
| F11 draft demotion | `i18n-content.spec.ts:551`, `:613` | a rewritten published sibling → draft with `publishedAt` kept; a draft sibling is left alone | ✅ E2E |
| F12 re-validation | `i18n-content.spec.ts:520` | 422 and full rollback | ✅ E2E |
| F13 untouched siblings | `i18n-content.spec.ts:319`, `:393`, `:919` | history left alone when nothing moved | ✅ E2E |
| F14 sibling revisions | `i18n-content.spec.ts:360`, `:946` | a revision per rewritten sibling; a links-only change still versions | ✅ E2E |
| F15 relation sync | `i18n-content.spec.ts:700`, `:719`, `:768`, `:787` | shared many; unlink across the group; mirrored many and single | ✅ E2E |
| F16 unresolvable mirrored link | `i18n-content.spec.ts:431`, `:823` | left unset, and the save still succeeds | ✅ E2E |
| F17 inward inheritance | `i18n-content.spec.ts:740`, `:755` | a new translation gets the group's links and does not wipe them | ✅ E2E |
| F18 virtual filters | `i18n-content.spec.ts:1072`, `:1102` | `hasLocale`/`missingLocale` by group membership; `localeCount` by number | ⚠️ PARTIAL — only `eq`; no `in`/`nin`/`ne`, no comparison ops beyond one |
| F19 bad operator | — | — | ❌ NONE |
| F20 non-i18n no-op | `i18n-content.spec.ts:1007`, `:1169` | the schema says nothing about locales; `?locale=` is ignored | ✅ E2E |
| F21 locale panel | `i18n-content.spec.ts:1119` | one item per configured locale, present or null | ⚠️ PARTIAL — no non-publishable type, no cross-workspace id, no soft-deleted entry |
| F22 batched summary | `i18n-content.spec.ts:1138` | a page of rows batched | ⚠️ PARTIAL — no cap/DTO-bound case, no foreign group id |
| F23 non-i18n type on the routes | `i18n-content.spec.ts:1153` | 400 | ✅ E2E |
| F24 coverage per locale | `apps/server-e2e/src/server/insights/localization-insights.spec.ts:110` | every configured locale listed, translated or not | ✅ E2E |
| F25 records not rows | `localization-insights.spec.ts:135` | the group is the unit | ✅ E2E |
| F26 unconfigured slugs filtered | — | — | ❌ NONE — the rule AGENTS calls load-bearing ("what makes 'complete' mean what it says") is unasserted |
| F27 single-locale `notLocalized: 0` | — | — | ❌ NONE — needs a per-suite config override |
| F28 per-type partition | `localization-insights.spec.ts:210` | the per-type figures repeat the envelope's and sum to it | ✅ E2E |
| F29 unused type omitted | `localization-insights.spec.ts:244`, `:256` | omitted, and types ordered by size | ✅ E2E |
| coverage: soft delete | `localization-insights.spec.ts:271` | a trashed translation drops out | ✅ E2E |
| coverage: empty + scope + authz | `localization-insights.spec.ts:294`, `:313`, `:334-350` | empty workspace; header scoping; 401/400/403 | ✅ E2E |
| F30–F32 tools | `apps/server-e2e/src/server/mcp/mcp.spec.ts`, `.../copilot/copilot-read-catalogue.spec.ts` | which surface sees which tool | ⚠️ PARTIAL — the propose tool's shared-field refusal and the applier's shared-value seeding are unasserted |
| a11y | — | — | ❌ NONE (no UI) |

**Coverage tally:** `32 features · 21 ✅ · 6 ⚠️ · 4 ❌ · 1 🧪`

## 6. 🐞 Potential Bugs

### 🐞 BUG-i18n-server-01 — Concurrent saves on two locales of one record deadlock, because siblings are locked in unordered result order · Severity: Medium

**Location:** `packages/i18n/server/src/lib/content/services/entry-locale-extension.service.ts:298-308`, with `packages/content/server/src/lib/entries/infrastructure/persistence/entry-writer.service.ts:622-702`
**Category:** race / concurrency

**What the code does:** content's update transaction rewrites the edited row
first — `tx.update(type.table).set(…).where(liveWhere(id))` at
`entry-writer.service.ts:623-642` — which takes that row's write lock. It then calls
`afterUpdate`, which reaches:
```typescript
const siblings = (await tx
    .select()
    .from(type.table)
    .where(and(
        eq(table['localeGroupId'], row['localeGroupId'] as string),
        ne(table['id'], row['id'] as string),
        eq(table['workspaceId'], workspaceId)
    ))
    .for('update')) as Record<string, unknown>[];
```
There is **no `ORDER BY`**, so the rows are locked in whatever order the plan
returns them — which differs between transactions and can differ between plans for
the same query.

**Why it is wrong:** two transactions editing different locales of the same record
acquire the same two locks in opposite orders. Tx A holds `en` (from its own
UPDATE) and waits for `de`; Tx B holds `de` and waits for `en`. Postgres detects the
cycle and aborts one with `40P01 deadlock detected`, which surfaces as an unmapped
**500**. The codebase already knows this pattern and guards against it twice, three
lines apart in the calling file: `appendRevisionsFor` sorts rows by id before taking
each one's advisory lock, with the comment "a stable order across concurrent savers
is what keeps two of them from deadlocking on the pair"
(`entry-writer.service.ts:261-275`), and `RelationLinkService`'s inverse loop "locks
its owners in sorted order to stay deadlock-free" (content-server AGENTS.md). The
sibling lock is the one that did not get the treatment. The service's own comment at
`:296-297` claims this `FOR UPDATE` "serializes two concurrent saves in different
locales of the same record" — it does, but into a deadlock rather than a queue.

**Repro:**
1. Create a record with `en` and `de` rows in a group, with at least one **shared**
   field so the sync actually runs.
2. Fire two `PATCH`es simultaneously — one on the `en` row, one on the `de` row —
   each changing that shared field to a different value:
   ```bash
   curl -b j -X PATCH .../api/content/article/$EN -d '{"values":{"slug":"a"}}' &
   curl -b j -X PATCH .../api/content/article/$DE -d '{"values":{"slug":"b"}}' &
   ```
3. Repeat under load (a dozen pairs) to widen the window.
→ Observed: one request intermittently returns `500`, with
`deadlock detected … Process A waits for ShareLock on transaction …` in the
Postgres log.
→ Expected: one wins and one waits, then re-reads — exactly what a consistent lock
order produces.

**Blast radius:** two editors working on different translations of the same record
at the same time — the *normal* workflow for a localization team, and the workflow
this plugin exists to support. The failure is a 500 with no useful message; no data
is corrupted (the loser rolls back), so it presents as a flaky save.

**Suggested fix:** add `.orderBy(asc(table['id']))` to the sibling select — the same
one-line fix `appendRevisionsFor` already applies — so every transaction takes the
group's locks in the same order. (Locking the edited row itself in that order too
would close the remaining window, since content's UPDATE always goes first.)

---

### 🐞 BUG-i18n-server-02 — `POST …/locale-summary` is a state-changing verb exempted from `OriginGuard`, and it echoes back publish state for arbitrary group ids · Severity: Low · 🔒

**Location:** `packages/i18n/server/src/lib/content/controllers/locale-summary.controller.ts:27-46`
**Category:** correctness / CSRF-surface

**What the code does:**
```typescript
@UseGuards(PermissionsGuard, WorkspaceGuard)
@RequirePermissions(PERMISSIONS.CONTENT_READ)
@Controller('i18n/content')
export class LocaleSummaryController {
    @Post(':typeName/locale-summary')
    summarize(@Param('typeName') typeName: string, @Body() body: LocaleSummaryDto, …)
```
No `OriginGuard`, deliberately — the JSDoc says "it reads, mutates nothing, so no
`OriginGuard`".

**Why it is wrong:** the reasoning is sound for CSRF *writes*, and this genuinely
mutates nothing. The residual risk is that it is the one **cross-origin-reachable
POST** in the deployment that returns workspace data: a simple `POST` with
`Content-Type: text/plain` is not preflighted, so a hostile page can issue it with
the victim's cookies. It cannot *read* the response without CORS, so no data
crosses — which is why this is Low, not High. What it does provide is a
credentialed, unthrottled, permission-checked amplification primitive: 100 group
ids per request, one query fanning out over the type's whole table, with
`X-Workspace-Id`… which a simple request cannot set, so `WorkspaceGuard` 400s it
first. **That last clause is what actually saves it** — and it saves it by accident
rather than by design, since the exemption's stated reason ("it reads") would still
hold if the workspace ever moved into the body or the path.

Two smaller things in the same route:
- the request's own group ids are used as **object keys** on a plain `{}`
  (`locale-group.service.ts:142-143`), which would be a prototype-pollution shape
  were `@IsUUID` not in front of it (`locale-summary.dto.ts:19-22`);
- there is no `@ArrayNotEmpty`, so an empty batch is a valid `200` (harmless).

**Repro:** from a page on another origin, `fetch('http://localhost:3000/api/i18n/content/article/locale-summary', { method:'POST', credentials:'include', headers:{'content-type':'text/plain'}, body:'{"groupIds":[…]}' })`.
→ Observed: `400` from `WorkspaceGuard` (no `X-Workspace-Id`), so nothing happens.
→ Expected: the same, but by an explicit rule rather than as a side effect.

**Blast radius:** none today. It is filed because the exemption's justification does
not cover the case that is actually holding the line, so a future refactor that
moves the workspace out of a header would silently open it.

**Suggested fix:** either add `OriginGuard` (it costs a header the admin already
sends) or amend the JSDoc to say the workspace **header** is what makes this
unreachable cross-origin, so the next reader does not remove the load-bearing part.

---

### 🐞 BUG-i18n-server-03 — Removing a locale from the config silently orphans every row in it · Severity: Low

**Location:** `packages/i18n/server/src/lib/domain/value-objects/locale-set.ts:88-101` (`remove`, never called), `packages/i18n/server/src/lib/locales/services/locale-registry.service.ts:31-34`, `apps/server/ortha.config.ts:144-152`
**Category:** data-loss (visibility)

**What the code does:** the configured set is a literal array read once at
construction. `LocaleSet` implements a careful `remove(slug)` that refuses to drop
the default and validates the resulting set — and **nothing ever calls it**
(`grep -rn "\.remove(" packages/i18n` finds only its own unit test). Removing a
locale is done by editing `ortha.config.ts` and restarting.

**Why it is wrong:** after the restart, every row in the dropped slug becomes
unreachable through every surface at once, with no warning at boot and no report
anywhere:
- `listScope` can never name it — `resolve('de')` now 400s, so the rows cannot be
  listed even deliberately;
- the locale panel iterates configured locales, so the row does not appear as a
  slot at all (`locale-group.service.ts:106`);
- coverage filters it out by design
  (`insights/infrastructure/queries/localization-coverage.query.ts:218-229`,
  `configuredScope`) and, per the
  AGENTS.md rationale, a group made **entirely** of such rows "drops out, which is
  the right answer" — so the *record count itself* silently falls;
- the rows still occupy the `(locale_group_id, locale)` unique index, so re-adding
  the locale later and creating a translation gives a **409** for a row nobody can
  see.

The plugin validates its config eagerly and thoroughly at construction — ≥1 locale,
unique slugs, exactly one default — precisely so "a misconfigured host fails before
boot". The one config change that destroys reachability is the one it does not
check.

**Repro:**
1. With `en`/`de`/`fr` configured, create a record translated into all three.
2. Delete `{ slug: 'de', … }` from `apps/server/ortha.config.ts` and restart.
3. `GET /api/content/article?locale=de` → `400`. The panel shows two slots. Coverage
   reports the record as `localized` (2 of 2). `SELECT count(*) … WHERE locale='de'`
   still returns the row.
4. Re-add `de` and `POST` a `de` sibling into that group → **`409`**.
→ Expected: a boot-time check that refuses to start (or at minimum logs loudly)
when the database holds rows in a slug the config no longer declares.

**Blast radius:** an operational foot-gun, not a runtime bug. The data is intact and
recoverable by re-adding the slug — but the 409 at step 4 is genuinely confusing.

**Suggested fix:** add an `onPluginInit` check that selects the distinct `locale`
values across localized tables and fails (or warns) on any slug absent from the
config, mirroring content-server's `EntryExtensionBootCheck`.

---

### 🐞 BUG-i18n-server-04 — `localeCount` counts unconfigured locales and `hasLocale ne` / `missingLocale in` mean the opposite of what a reader expects · Severity: Low

**Location:** `packages/i18n/server/src/lib/content/services/entry-locale-extension.service.ts:660-715`, compared with `packages/i18n/server/src/lib/insights/infrastructure/queries/localization-coverage.query.ts:218-229`
**Category:** correctness

**What the code does:**
```typescript
const groupScope = and(
    eq(s['localeGroupId'], table['localeGroupId']),
    eq(s['workspaceId'], workspaceId),
    ...(type.paranoid ? [isNull(s['deletedAt'])] : [])
);
```
Workspace and soft-delete, **but not the configured locale set** — whereas the
coverage query's `configuredScope` adds `inArray(columns['locale'], slugs)` and its
JSDoc explains at length why that filter is what makes "complete" mean what it says.
Separately, `hasLocale` admits `ne` and `nin`, and `missingLocale` admits `in`
(`LOCALE_FIELD_OPS`, `:60-76`), rendering:
- `hasLocale ne "de"` → `EXISTS(sibling WHERE locale <> 'de')` = "has **some other**
  locale", not "lacks de";
- `missingLocale in ["de","fr"]` → `NOT EXISTS(sibling WHERE locale IN (…))` =
  "missing **both**", not "missing either".

**Why it is wrong:** two surfaces answer the same question differently. After a
locale is dropped from config (see `🐞 BUG-i18n-server-03`) or before a
config change propagates, `localeCount eq 3` matches records the coverage card
counts as having 2 — and `localeCount` can exceed the configured total, which
coverage explicitly guards against ("leaving it in would push a group's
distinct-locale count past the configured total"). The operator semantics are worse
because they are *plausible*: `i18n-admin`'s filter UI offers `ne` on `hasLocale`
from the enum, and a user reading "Has locale — is not — German" will conclude the
opposite of what they get.

**Repro:**
1. Insert a row with `locale = 'it'` (unconfigured) into an existing group of 2.
2. `?filter={"and":[{"field":"localeCount","op":"eq","value":3}]}` → the record
   matches.
3. `GET /api/insights/i18n/coverage` → the same record counts as 2 locales.
4. `?filter={"and":[{"field":"hasLocale","op":"ne","value":"de"}]}` on a record that
   **has** `de` and `en` → it **matches** (because `en <> 'de'`).
→ Expected: `localeCount` scoped to configured locales, and either the confusing
operators removed from `LOCALE_FIELD_OPS` or their semantics documented on the
filter field.

**Blast radius:** wrong filter results in the records table and for the two agent
tools that reach the same query surface. No security or data impact.

**Suggested fix:** add `inArray(s['locale'], this.locales.all().map(l => l.slug))`
to `groupScope`, and drop `Ne`/`Nin` from `hasLocale` and `In` from `missingLocale`
(the admin's UI offers only `eq` for the two enums anyway) or document them
explicitly.

---

**Tally:** 4 🐞 — 0 Critical, 1 Medium, 3 Low (one 🔒).
**♿ tally:** 3 — 1 Supports · 0 Partially Supports · 2 Does Not Support · 0 Not Applicable.

**Checked and cleared:** **every read path applies the locale scope** — there is no
list that forgets it and returns one row per locale (the specific bug class the
brief names); the coverage query counts `distinct locale_group_id` everywhere, so
records are never inflated by rows; **no division exists on the server**, so the
zero-entries / 0% / 100% boundaries produce clean zeros rather than NaN; coverage is
workspace-scoped on every per-type query and pinned by e2e; the shared-field sync is
fully transactional and cannot partially apply, with `FOR UPDATE` capturing
pre-write statuses before the demotion so the re-validation reads the right state;
`IS DISTINCT FROM` with `sql.param` binds through each column's own encoder, so
array-valued shared fields sync correctly; the early return at `:289` keeps the lock
footprint proportional to what the save actually propagates; `assertGroupExists` is
workspace-scoped so a group cannot be joined across tenants; a duplicate
`(group, locale)` is a clean 409 from the unique index rather than a corrupt group;
`resolveI18nType` returns 404 for unknown and 400 for non-localized, matching the
content routes' enumeration posture; and the summary endpoint echoes back only the
caller's own group ids.

**Recorded, not filed:** `GET /api/i18n/locales` has no permission decorator (any
authenticated user learns the configured locale set — deliberate, low value); the
coverage query does not consult `WorkspaceGrantsQuery`, which is **consistent** with
content-server's own session-side entries routes (grants gate the public/token API
and the filter-fields endpoint, not the session list) and is therefore not an
i18n-specific leak.

## 7. Recommended E2E Tests

| Priority | Harness | Proposed spec | Asserts | Closes |
| --- | --- | --- | --- | --- |
| 1 | `apps/server-e2e` testcontainer + supertest | `src/server/i18n/i18n-concurrency.spec.ts` (new) | fire N pairs of simultaneous `PATCH`es on two locales of one group, each touching a shared field; assert **no** request returns 500 and both values converge — fails today on the deadlock | 🐞 BUG-i18n-server-01, EC-17 |
| 2 | `apps/server-e2e` | extend `src/server/insights/localization-insights.spec.ts` | insert a row in an unconfigured slug and assert it is excluded from `records`, from `localized`, and from every `locales[]` figure; assert a group made **only** of such rows disappears | F26 ❌, EC-15 |
| 3 | `apps/server-e2e` | new suite with a per-suite config override (one locale) | `notLocalized` is forced to `0` and `localized === records` | F27 ❌ |
| 4 | `apps/server-e2e` | extend `src/server/i18n/i18n-content.spec.ts` | the full virtual-filter matrix: `hasLocale` with `eq`/`ne`/`in`/`nin`, `missingLocale` with `eq`/`in`, `localeCount` with all six comparisons, an unsupported operator → 400, an unconfigured slug in `localeCount` | F18 ⚠️, F19 ❌, 🐞 BUG-i18n-server-04 |
| 5 | `apps/server-e2e` | extend `i18n-content.spec.ts` | the panel and the summary on a **non-publishable** localized type (no `status`/`publishedAt`), with a cross-workspace id (404), with a soft-deleted entry (404), with 101 group ids (400), and with a foreign group id (empty array) | F21 ⚠️, F22 ⚠️, EC-39, EC-40 |
| 6 | `apps/server-e2e` | `src/server/i18n/i18n-locale-lifecycle.spec.ts` (new) | add a locale after data exists → every group reports it missing, no backfill, coverage figures move as expected; then simulate removal and assert the boot check refuses (once implemented) | 🐞 BUG-i18n-server-03, EC-14, EC-15 |
| 7 | `apps/server-e2e` | extend `src/server/copilot/copilot-proposals.spec.ts` | `i18n_propose_translation` refuses a **shared** field and a duplicate locale; the applier seeds shared values from the source so a required shared field (`tag.slug`) is not blanked across a group of drafts | F32 ⚠️ |
| 8 | `apps/server-e2e` | extend `i18n-content.spec.ts` | `?locale=` empty, repeated, wrong-case, and a mistyped `?localeFallback=` — assert each is a 400 or a documented no-op rather than a silent behaviour change | EC-03…EC-07 |
| 9 | `apps/server-e2e` | extend `i18n-content.spec.ts` | a group of 5+ locales: one shared-field save writes 4 siblings, appends 4 revisions, demotes only the published ones, and completes in one transaction | EC-22 |
| 10 | package unit | `src/lib/domain/value-objects/locale.spec.ts` (extend) | once `dir` exists: an RTL slug carries `dir: 'rtl'` and it survives `LocaleRegistryService.all()` | ♿ A11Y-i18n-server-01 |

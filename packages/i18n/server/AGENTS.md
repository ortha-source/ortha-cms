# @ortha-cms/i18n-server

> **Layout: layered (ADR-0003).** A **light** application of tactical DDD — this
> is a small, low-invariant context, so it gets a `domain/` layer for value
> objects and the pure locale policy, but **not** a full aggregate /
> unit-of-work / outbox split (there is no write aggregate here — the plugin
> owns no tables). The defining feature stays a **synchronous open-host port**
> (see below). Follow the `workspaces-server` pilot for the layered idioms and
> the `server-plugin` skill for the plugin mechanics.

## Layering (ADR-0003)

```
domain/                       # framework-free core — imports NOTHING from
                              # @nestjs/*, drizzle-orm, class-validator
  value-objects/locale.ts     # Locale — the slug-format + non-blank-name rule
  value-objects/locale-set.ts # LocaleSet — non-empty, unique, exactly-one-default,
                              #   can't-remove-the-default guards
  locale-policy.ts            # LocalePolicy — pure fallback-chain resolution
                              #   (resolve / shouldWidenToDefault / fallbackChain)
                              #   + requiredLocalesForPublish
  errors/                     # transport-agnostic domain errors
locales/services/             # LocaleRegistryService — wraps LocaleSet/LocalePolicy,
                              #   exposes the plain LocaleDef shape, maps
                              #   UnknownLocaleError → HTTP 400
content/ + locales/controllers# thin HTTP surface (unchanged)
```

The raw slug regex and the config invariants that used to live inline on the
plugin factory now live on `Locale` / `LocaleSet`; `assertConfig` is just
`LocaleSet.fromDefs(config.locales)`, and the runtime services resolve locales
through `LocalePolicy`. The `domain/` classes are plain (no `@Injectable`) — the
registry is the single `@Injectable()` seam that adapts them to DI.

### Decision — `CONTENT_ENTRY_EXTENSION` stays a synchronous port

`EntryLocaleExtensionService` binds content-server's `CONTENT_ENTRY_EXTENSION`
port to add per-locale row scoping **in-transaction, synchronously**. This is
**deliberately left as-is** and is **not** turned into a domain-event /
subscriber: the extension must run _inside_ content's entries pipeline
(list scoping, create stamping, shared-field sync + re-validation, virtual
filters), so a port — not an event — is the right integration. ADR-0003 is
explicit that the layering does **not** force events where an open-host port is
correct; the port's shape, wiring, and synchronous contract are unchanged by
this refactor. `LocalePolicy` is the pure re-expression of the fallback rule the
adapter's SQL encodes; the adapter keeps rendering the query.

`afterUpdate` **returns the sibling rows it rewrote**. Content-server appends a
revision for each, in the same transaction — a sibling whose shared values moved
gets the history entry it earned, instead of its timeline skipping the change
(and a later restore silently undoing it). Revision writing stays on content's
side on purpose: numbering is serialized per entry by an advisory lock, so a
second writer allocating numbers out-of-band is how duplicate versions happen.

The content-**localization** plugin for the Ortha CMS server. It makes
`i18n: true` content types multilingual — **one row per locale**, siblings
sharing a `locale_group_id` — **without the content library knowing what a
locale means**. It owns **no tables and no migrations**: the `locale` /
`locale_group_id` columns live on the host-owned generated content tables (the
`i18n: true` type flag adds them via content-server's table builder), and the
available locales live in this plugin's **config**.

## How it plugs in — the `CONTENT_ENTRY_EXTENSION` port

content-server declares a DI port (`CONTENT_ENTRY_EXTENSION` + the
`ContentEntryExtension` interface) and consults it **optionally** from the
entries pipeline; this plugin **binds** the implementation
(`EntryLocaleExtensionService`) in a `global: true` module. Same inversion as
identity's `CONTENT_CATALOG`, roles swapped: the consumer of the behavior
declares the port, the provider binds it. Every method **no-ops for non-i18n
types**, so binding the extension never changes an unrelated type's behavior.

The extension owns all locale _behavior_:

- **`listScope`** — the extra `WHERE` AND-ed into the entries list. Validates
  `?locale=` (unknown → 400), defaults to the configured default locale when
  absent, and scopes **strictly** (`locale = X` — untranslated groups are
  hidden). `?localeFallback=default` widens it to "the requested locale OR the
  default-locale row of a group that has no requested-locale row" (the relation
  picker's mode).
- **`createColumns`** — stamps the validated `locale` on a create. With no
  `localeGroupId` the group id comes from the column default (a plain create
  starts a fresh group); **with** a `localeGroupId` the new row **joins that
  group** as a sibling translation — verified to name a real group in the
  workspace first (else **404**), so a typo can't spawn a stray one-row group.
  This is why sibling creation needs no dedicated endpoint (see HTTP surface).
- **`afterUpdate`** — runs inside **both the create and update** transactions
  (so a newly-created sibling lands consistent with its group, not just later
  edits). Syncs every **non-`localized`** column-backed field to the group's
  sibling rows, **moves a rewritten published sibling back to `draft`** (keeping
  `published_at`, exactly as a direct edit does — so it reads as *Modified*, not
  as a never-published draft), then **re-validates any sibling that was
  published** via content-server's `EntryValidationService` — a failure throws
  422 and rolls the whole save back (a draft edit can't silently invalidate a
  live translation). The demotion is what keeps a shared field's publish state
  consistent across the group: leaving siblings `published` made the same edit
  live in the untouched locales while still pending in the edited one, and left
  each sibling's freshly-appended **draft** version describing a row that
  claimed to be live. Because the guard's `published` test would then always
  read the just-demoted status, the pre-write statuses are captured with a
  `SELECT … FOR UPDATE` before the sync. A no-op when the
  group has no other members (a fresh create). Join-backed relation links are
  per-row in v1 (copied at translation creation, not synced), and a **single
  relation whose target is itself i18n** is excluded too (`isPerLocaleRelation`)
  — its FK is per-locale, so a cross-locale link is never synced onto a sibling.
- **`filterExtension`** — the virtual filter fields `hasLocale` /
  `missingLocale` (enum of slugs) and `localeCount` (number), resolved to
  `EXISTS` / correlated-count subqueries over the group (ridden by the
  `(locale_group_id, locale)` unique index). Wired through the filter engine's
  `extensionFields` + `resolveExtension` seam.

## Config — the single source of truth for locales

`I18nServerPlugin({ locales: [{ slug, name, isDefault }] })` validates
**eagerly at construction** (like `ContentPlugin`'s registry): ≥1 locale;
unique, well-formed slugs (`^[a-z]{2,3}(-[a-z0-9]+)*$`); **exactly one**
default. A misconfigured host fails before boot. `LocaleRegistryService`
exposes `all()` / `get(slug)` / `default()` / `resolve(slug?)` (the uniform
unknown-→400 gate). Register it in `apps/server/ortha.config.ts` under
`plugins.i18n` and in `buildPlugins` **after** `ContentPlugin` (it binds
content's port and reads its `CONTENT_REGISTRY`).

## HTTP surface (`/api/i18n`)

This plugin's content routes are **reads only** — sibling _creation_ goes
through content-server's `POST /api/content/:type` with a `localeGroupId` (see
`createColumns` above). All are workspace-scoped (identity's `WorkspaceGuard`)
and permission-gated; a `:typeName` that isn't localized is a **400**
(`resolveI18nType`).

- `GET /api/i18n/locales` — the configured locales (session only; no
  per-workspace data).
- `GET /api/i18n/content/:typeName/:id/locales` — one entry's **locale panel**:
  one item per configured locale with the group's row (id, status,
  **publishedAt**, updatedAt) or null (`content:read`).
- `POST /api/i18n/content/:typeName/locale-summary` — the records table's
  **batched** per-page read: `{ groupIds }` (cap 100) → per-group live members
  with status **+ publishedAt**. A POST because a page of uuids outgrows a query string; it reads,
  so no `OriginGuard` (`content:read`).

**Creating a sibling translation:** `POST /api/content/:typeName` with
`{ values, locale, localeGroupId }` — the client supplies the source's values,
the extension validates + stamps the group, and the row lands as a fresh draft.
A duplicate locale in the group is a **409** (the `(locale_group_id, locale)`
unique index is the arbiter); an unknown group is a **404**. Many-relation
join-copy is **not** performed (relations are per-locale in v1).

## Architecture / conventions

- Feature-then-kind layout (`locales/`, `content/{services,controllers,dto}`),
  thin controllers, permission-by-constant, `interface` for contracts, JSDoc on
  exports — the `server-plugin` skill.
- Depends on `@ortha-cms/content-server` (the port + `toColumns`/`toRecord` +
  `EntryValidationService` + `CONTENT_REGISTRY`), `@ortha-cms/identity-server`
  (guards + `lockWorkspaceShared`), `@ortha-cms/database` (`@InjectDatabase()`),
  `@ortha-cms/utils-server` (`isUniqueViolation`), `@ortha-cms/bootstrap-server`.
- **No `drizzle.config.ts`, no `migrations/`** — nothing to own. A future
  per-locale settings table would be the first candidate.

## Commands

- `npx nx typecheck @ortha-cms/i18n-server` / `npx nx lint @ortha-cms/i18n-server`
- `npx nx test @ortha-cms/i18n-server` (config-validation unit tests)
- End-to-end: `apps/server-e2e/src/server/i18n/` (needs Docker).

# @ortha-cms/i18n-server

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

The extension owns all locale *behavior*:

- **`listScope`** — the extra `WHERE` AND-ed into the entries list. Validates
  `?locale=` (unknown → 400), defaults to the configured default locale when
  absent, and scopes **strictly** (`locale = X` — untranslated groups are
  hidden). `?localeFallback=default` widens it to "the requested locale OR the
  default-locale row of a group that has no requested-locale row" (the relation
  picker's mode).
- **`createColumns`** — stamps the validated `locale` on a create (the group id
  comes from the column default: a plain create starts a fresh group).
- **`afterUpdate`** — inside the save transaction, syncs every **non-`localized`**
  column-backed field to the group's sibling rows, then **re-validates any
  published sibling** via content-server's `EntryValidationService` — a failure
  throws 422 and rolls the whole save back (a draft edit can't silently
  invalidate a live translation). Join-backed relation links are per-row in v1
  (copied at translation creation, not synced).
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

All content routes are workspace-scoped (identity's `WorkspaceGuard`) and
permission-gated like the content routes; a `:typeName` that isn't localized is
a **400** (`resolveI18nType`).

- `GET /api/i18n/locales` — the configured locales (session only; no
  per-workspace data).
- `GET /api/i18n/content/:typeName/:id/locales` — one entry's **locale panel**:
  one item per configured locale with the group's row (id, status, updatedAt)
  or null (`content:read`).
- `POST /api/i18n/content/:typeName/locale-summary` — the records table's
  **batched** per-page read: `{ groupIds }` (cap 100) → per-group live members
  with status. A POST because a page of uuids outgrows a query string; it reads,
  so no `OriginGuard` (`content:read`).
- `POST /api/i18n/content/:typeName/:id/translations` — **create a
  translation**: a new draft sibling in the target locale, all field columns +
  owning many-relation join rows copied as a starting point, same
  `locale_group_id`. `OriginGuard` + `content:create`; a duplicate locale is a
  **409** (the `(locale_group_id, locale)` unique index is the arbiter — a
  concurrent double-create loses cleanly, not a pre-check race).

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

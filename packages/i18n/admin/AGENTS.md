# @ortha-cms/i18n-admin

The admin counterpart to `@ortha-cms/i18n-server` — content localization in the
Content Library UI. It contributes **only** to `@ortha-cms/content-admin`'s
extension slots: **no routes, no layout, no nav item**. Register it in
`createAdmin({ plugins })` **after** `ContentPlugin()` (it fills slots the
content plugin owns).

## What it contributes (the five slots)

- **`RECORDS_TOOLBAR_SLOT` → `LocaleSwitcher`** — a searchable dropdown
  (design-system `Popover` + `Command`) of the configured locales, shown **only
  when `schema.i18n`**. It owns the `?locale=` list param (`listParamKeys`), so
  the records list is scoped to the active locale server-side; the **default
  locale keeps a clean URL** (no `?locale=`), matching the server's default
  scoping.
- **`RECORDS_COLUMN_SLOT` → `LocalesColumnCell`** — an optional **Locales**
  column (`appliesTo: s => !!s.i18n`; hidden by default, toggled in the column
  picker) showing one status-tinted badge per live locale of the row's
  translation group, each linking to that locale's editor. Data is **batched per
  page** by the item's `useRowsData` (`useLocaleSummaries` →
  `POST …/locale-summary`) — never a request per row.
- **`ENTRY_SIDEBAR_WIDGET_SLOT` → `LocaleWidget`** — the entry editor's **locale
  panel**: one row per configured locale with per-locale publish status. The
  open row is marked; an existing sibling **opens** on click; a missing one
  offers **Create translation** (gated `content:create`; a 409 → toast +
  refetch). On a **single page**, switching locales drives the `?locale=` URL
  param instead (one row per locale, same editor); a missing locale is reached
  by switching, and the blank-create form stamps the locale on save.
- **`RECORDS_FILTER_FIELDS_SLOT` → `useLocaleFilterFields`** — **Has locale /
  Missing locale / Locale count** filter fields, resolved server-side by the
  i18n plugin's virtual-field subqueries. Empty for a non-i18n type.
- **`ENTRY_PARAMS_SLOT`** — non-visual plumbing: the single-mode one-entry read
  and the **create body** carry the active locale (`listParamKeys` /
  `createBodyKeys` = `['locale']`), and relation-picker candidates are scoped to
  the source entry's locale with default fallback
  (`{ locale, localeFallback: 'default' }`) when the target is localized.

## Data layer

Per-hook (the `admin-plugin` convention), each owning its `apiClient` request +
TanStack Query key:

- `useLocales` — `GET /api/i18n/locales`, cached **forever** (server config).
  Exposes `locales` + `defaultLocale`.
- `useEntryLocales` — `GET /api/i18n/content/:type/:id/locales` (the widget).
- `useLocaleSummaries` — `POST …/locale-summary` batched over a page's unique
  group ids (the column); sorted ids key the cache.
- `useCreateTranslation` — creates a sibling via the **normal create**
  endpoint, `POST /content/:type` with `{ values, locale, localeGroupId }`
  (the `LocaleWidget` copies the source's `entry.values` + `entry.localeGroupId`;
  many-relation links are per-locale in v1, not copied). A duplicate locale is a
  **409**, an unknown group a **404**. On success invalidates the type's records
  lists (`contentEntriesPrefix`, re-exported by content-admin), locale panels,
  and summaries.

## Conventions

- `type` over `interface`; `<name>/index.ts(x)` folders; co-located
  `react-intl` messages namespaced `i18n.<area>.<key>`; UI from
  `@ortha-cms/design-system` only; wire types **mirror** the server without
  importing across the boundary (`src/lib/types/locale`).
- **One component per file.** A child used by one parent nests in its folder
  (e.g. `LocalesColumnCell/LocaleBadge`, `LocaleWidget/LocaleRow`).
- Slot **item ids** and **URL params** are named constants in
  `src/lib/constants` — no magic literals.
- The plugin factory (`utils/i18nPlugin`) types each slot item **explicitly**
  (the `AdminPlugin.slots` array is heterogeneous, so a bare object literal
  wouldn't infer the callback parameter types).

## Package

- Consumed from source (`exports` → `./src/index.ts`); no build step.
- Register **after** `ContentPlugin()` in `apps/admin/src/main.tsx`.

## Commands

- `npx nx typecheck @ortha-cms/i18n-admin` / `npx nx lint @ortha-cms/i18n-admin`
- E2E: `apps/admin-e2e/src/content/i18n.spec.ts` (mocked API, no backend).
